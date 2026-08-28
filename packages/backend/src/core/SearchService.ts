/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { type Config, FulltextSearchProvider } from '@/config.js';
import { bindThis } from '@/decorators.js';
import { MiNote } from '@/models/Note.js';
import type { NotesRepository } from '@/models/_.js';
import { MiUser } from '@/models/_.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { isUserRelated } from '@/misc/is-user-related.js';
import { CacheService } from '@/core/CacheService.js';
import { QueryService } from '@/core/QueryService.js';
import { IdService } from '@/core/IdService.js';
import type Logger from '@/logger.js';
import { UserEntityService } from './entities/UserEntityService.js';
import { LoggerService } from '@/core/LoggerService.js';
import type { Index, MeiliSearch } from 'meilisearch';
import type { Client as OpenSearch } from '@opensearch-project/opensearch';

type K = string;
type V = string | number | boolean;
type Q =
	{ op: '=', k: K, v: V } |
	{ op: '!=', k: K, v: V } |
	{ op: '>', k: K, v: number } |
	{ op: '<', k: K, v: number } |
	{ op: '>=', k: K, v: number } |
	{ op: '<=', k: K, v: number } |
	{ op: 'is null', k: K } |
	{ op: 'is not null', k: K } |
	{ op: 'and', qs: Q[] } |
	{ op: 'or', qs: Q[] } |
	{ op: 'not', q: Q };

export type SearchOpts = {
	userId?: MiNote['userId'] | null;
	channelId?: MiNote['channelId'] | null;
	host?: string | null;
};

export type SearchPagination = {
	untilId?: MiNote['id'];
	sinceId?: MiNote['id'];
	limit: number;
};

function compileValue(value: V): string {
	if (typeof value === 'string') {
		return `'${value}'`; // TODO: escape
	} else if (typeof value === 'number') {
		return value.toString();
	} else if (typeof value === 'boolean') {
		return value.toString();
	}
	throw new Error('unrecognized value');
}

function compileQuery(q: Q): string {
	switch (q.op) {
		case '=': return `(${q.k} = ${compileValue(q.v)})`;
		case '!=': return `(${q.k} != ${compileValue(q.v)})`;
		case '>': return `(${q.k} > ${compileValue(q.v)})`;
		case '<': return `(${q.k} < ${compileValue(q.v)})`;
		case '>=': return `(${q.k} >= ${compileValue(q.v)})`;
		case '<=': return `(${q.k} <= ${compileValue(q.v)})`;
		case 'and': return q.qs.length === 0 ? '' : `(${ q.qs.map(_q => compileQuery(_q)).join(' AND ') })`;
		case 'or': return q.qs.length === 0 ? '' : `(${ q.qs.map(_q => compileQuery(_q)).join(' OR ') })`;
		case 'is null': return `(${q.k} IS NULL)`;
		case 'is not null': return `(${q.k} IS NOT NULL)`;
		case 'not': return `(NOT ${compileQuery(q.q)})`;
		default: throw new Error('unrecognized query operator');
	}
}

@Injectable()
export class SearchService {
	private readonly meilisearchIndexScope: 'local' | 'global' | string[] = 'local';
	private readonly meilisearchNoteIndex: Index | null = null;
	private readonly opensearchNoteIndex: string;
	private readonly opensearchIdField: string;
	private readonly logger: Logger;
	private readonly provider: FulltextSearchProvider;
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meilisearch)
		private meilisearch: MeiliSearch | null,

		@Inject(DI.opensearch)
		private opensearch: OpenSearch | null,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private userEntityService: UserEntityService,
		private cacheService: CacheService,
		private queryService: QueryService,
		private idService: IdService,
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('note:search');

		if (this.meilisearch) {
			this.meilisearchNoteIndex = this.meilisearch.index(`${config.meilisearch!.index}---notes`);
			if (config.meilisearch?.scope) {
				this.meilisearchIndexScope = config.meilisearch.scope;
			}
			/*this.meilisearchNoteIndex.updateSettings({
				searchableAttributes: [
					'text',
					'cw',
				],
				sortableAttributes: [
					'createdAt',
				],
				filterableAttributes: [
					'createdAt',
					'userId',
					'userHost',
					'channelId',
					'tags',
				],
				typoTolerance: {
					enabled: false,
				},
				pagination: {
					maxTotalHits: 10000,
				},
			});*/
		} else if (this.opensearch) {
			this.opensearchNoteIndex = `${config.opensearch!.index}`;
			this.opensearchIdField = `${config.host}_id`;
			const opensearch = this.opensearch;
			opensearch.indices.exists({
				index: this.opensearchNoteIndex,
			}).then((indexExists) => {
				if (!indexExists.body) {
					opensearch.indices.create({
						index: this.opensearchNoteIndex + `-${new Date().toISOString().slice(0, 7).replace(/-/g, '')}`,
						body: {
							mappings: {
								properties: {
									text: { type: 'text' },
									cw: { type: 'text' },
									createdAt: { type: 'long' },
									userId: { type: 'keyword' },
									userHost: { type: 'keyword' },
									channelId: { type: 'keyword' },
									tags: { type: 'keyword' },
								},
							},
							settings: {
								index: {
									analysis: {
										tokenizer: {
											kuromoji: {
												type: 'kuromoji_tokenizer',
												mode: 'search',
											},
										},
										analyzer: {
											kuromoji_analyzer: {
												type: 'custom',
												tokenizer: 'kuromoji',
											},
										},
									},
								},
							},
						},
					}).catch((error) => {
						this.logger.error(error);
					});
				}
			}).catch((error) => {
				this.logger.error('Error while checking if index exists', error);
			});
		}

		this.provider = config.fulltextSearch?.provider ?? 'sqlLike';
		this.loggerService.getLogger('SearchService').info(`-- Provider: ${this.provider}`);
	}

	private isIndexable(note: MiNote): boolean {
		if (note.text == null && note.cw == null) return false;
		// if (!['home', 'public'].includes(note.visibility)) return false;
		return true;
	}

	/**
	 * Whether the configured MeiliSearch scope covers this note. Only MeiliSearch has a
	 * scope setting; the OpenSearch path indexes everything.
	 */
	private isInMeilisearchScope(note: MiNote): boolean {
		switch (this.meilisearchIndexScope) {
			case 'global':
				return true;

			case 'local':
				return note.userHost == null;

			default:
				return note.userHost == null || this.meilisearchIndexScope.includes(note.userHost);
		}
	}

	private toMeilisearchDocument(note: MiNote) {
		return {
			id: note.id,
			createdAt: note.createdAt.getTime(),
			userId: note.userId,
			userHost: note.userHost,
			channelId: note.channelId,
			cw: note.cw,
			text: note.text,
			tags: note.tags,
		};
	}

	// Deliberately derived from the id, not from note.createdAt - that is what the
	// OpenSearch path has always used, and it decides which monthly index a note lands in.
	private toOpensearchDocument(note: MiNote) {
		return {
			createdAt: this.idService.parse(note.id).date.getTime(),
			userId: note.userId,
			userHost: note.userHost,
			channelId: note.channelId,
			cw: note.cw,
			text: note.text,
			tags: note.tags,
		};
	}

	private opensearchIndexFor(note: MiNote): string {
		const createdAt = this.idService.parse(note.id).date;
		return `${this.opensearchNoteIndex}-${createdAt.toISOString().slice(0, 7).replace(/-/g, '')}`;
	}

	@bindThis
	public async indexNote(note: MiNote): Promise<void> {
		return this.indexNotes([note]);
	}

	/**
	 * Index a batch of notes in a single request per engine.
	 *
	 * indexNote() used to be the only entry point, and a full re-index therefore issued one
	 * HTTP request per note. Measured against MeiliSearch on a 4-core host that is ~295
	 * documents/second, or 28.7 hours for a 30.5M-note instance; the same documents sent
	 * 1000 at a time reach ~8,000/second, or about 1.1 hours. The bottleneck was never the
	 * database or the engine, only the per-document round trip.
	 */
	@bindThis
	public async indexNotes(notes: MiNote[]): Promise<void> {
		const indexable = notes.filter(note => this.isIndexable(note));
		if (indexable.length === 0) return;

		if (this.meilisearch) {
			const documents = indexable
				.filter(note => this.isInMeilisearchScope(note))
				.map(note => this.toMeilisearchDocument(note));
			if (documents.length === 0) return;

			await this.meilisearchNoteIndex?.addDocuments(documents, {
				primaryKey: 'id',
			});
		} else if (this.opensearch) {
			// One _bulk request covering every monthly index the batch touches. Each
			// document still carries its own _index, so notes spanning a month boundary
			// are routed exactly as they would be one at a time.
			const operations = indexable.flatMap(note => [
				{ index: { _index: this.opensearchIndexFor(note), _id: note.id } },
				this.toOpensearchDocument(note),
			]);

			await this.opensearch.bulk({
				body: operations,
			}).catch((error) => {
				this.logger.error(error);
			});
		}
	}

	@bindThis
	public async unindexNote(note: MiNote): Promise<void> {
		// if (!['home', 'public'].includes(note.visibility)) return;

		if (this.meilisearch) {
			await this.meilisearchNoteIndex!.deleteDocument(note.id);
		} else if (this.opensearch) {
			await this.opensearch.delete({
				index: `${this.opensearchNoteIndex}-${this.idService.parse(note.id).date.toISOString().slice(0, 7).replace(/-/g, '')}`,
				id: note.id,
			}).catch((error) => {
				this.logger.error(error);
			});
		}
	}

	@bindThis
	public async unindexAllNotes(): Promise<void> {
		if (this.meilisearch) {
			await this.meilisearchNoteIndex?.deleteAllDocuments();
		} else if (this.opensearch) {
			await this.opensearch.deleteByQuery({
				index: this.opensearchNoteIndex + '*' as string,
				body: {
					query: {
						match_all: {},
					},
				},
			}).catch((error) => {
				this.logger.error(error);
			});
		}
	}

	@bindThis
	private async filter(me: MiUser | null, note: MiNote): Promise<boolean> {
		const [
			userIdsWhoMeMuting,
			userIdsWhoBlockingMe,
		] = me ? await Promise.all([
			this.cacheService.userMutingsCache.fetch(me.id),
			this.cacheService.userBlockedCache.fetch(me.id),
		]) : [new Set<string>(), new Set<string>()];
		if (me && isUserRelated(note, userIdsWhoBlockingMe)) return false;
		if (me && isUserRelated(note, userIdsWhoMeMuting)) return false;
		if (['followers', 'specified'].includes(note.visibility)) {
			if (me == null) return false;
			if (me.id === note.userId) return true;
			if (note.visibility === 'followers') {
				const relationship = await this.userEntityService.getRelation(me.id, note.userId);
				if (relationship.isFollowing) return true;
			}
			if (!note.visibleUserIds.includes(me.id) && !note.mentions.includes(me.id)) return false;
		}
		return true;
	}

	@bindThis
	public async searchNote(
		q: string,
		me: MiUser | null,
		opts: SearchOpts,
		pagination: SearchPagination,
	): Promise<MiNote[]> {
		switch (this.provider) {
			case 'sqlLike':
			case 'sqlPgroonga': {
				// ほとんど内容に差がないのでsqlLikeとsqlPgroongaを同じ処理にしている.
				// 今後の拡張で差が出る用であれば関数を分ける.
				return this.searchNoteByLike(q, me, opts, pagination);
			}
			case 'meilisearch': {
				return this.searchNoteByMeiliSearch(q, me, opts, pagination);
			}
			case 'opensearch': {
				return this.searchNoteByOpenSearch(q, me, opts, pagination);
			}
			default: {
				// 最終的にサポートされていないプロバイダが指定された場合は、like検索にフォールバックする
				return this.searchNoteByLike(q, me, opts, pagination);
			}
		}
	}

	@bindThis
	private async searchNoteByOpenSearch(
		q: string,
		me: MiUser | null,
		opts: SearchOpts,
		pagination: SearchPagination,
	): Promise<MiNote[]> {
		if (!this.opensearch || !this.opensearchNoteIndex) {
			throw new Error('MeiliSearch is not available');
		}

		const esFilter: any = {
			bool: {
				must: [],
			},
		};

		if (pagination.untilId) esFilter.bool.must.push({ range: { createdAt: { lt: this.idService.parse(pagination.untilId).date.getTime() } } });
		if (pagination.sinceId) esFilter.bool.must.push({ range: { createdAt: { gt: this.idService.parse(pagination.sinceId).date.getTime() } } });
		if (opts.userId) esFilter.bool.must.push({ term: { userId: opts.userId } });
		if (opts.channelId) esFilter.bool.must.push({ term: { channelId: opts.channelId } });
		if (opts.host) {
			if (opts.host === '.') {
				esFilter.bool.must.push({ term: { userHost: this.config.host } });
			} else {
				esFilter.bool.must.push({ term: { userHost: opts.host } });
			}
		}

		if (q !== '') {
			esFilter.bool.must.push({
				bool: {
					should: [
						{ wildcard: { 'text': { value: q } } },
						{ simple_query_string: { fields: ['text'], 'query': q, default_operator: 'and' } },
					],
					minimum_should_match: 1,
				},
			});
		}

		const res = await this.opensearch.search({
			index: this.opensearchNoteIndex + '*' as string,
			body: {
				query: esFilter,
				sort: [{ createdAt: { order: 'desc' } }],
				_source: ['id', 'createdAt', this.opensearchIdField],
				size: pagination.limit,
			},
		});

		if (!res) {
			return [];
		}

		const noteIds = res.body.hits.hits.map((hit) => {
			const source = hit._source as Record<string, unknown>;
			return (source[this.opensearchIdField] as string | undefined) ?? hit._id ?? null;
		}).filter((id): id is string => id !== null);
		if (noteIds.length === 0) return [];
		const notes = await this.notesRepository.findBy({
			id: In(noteIds),
		});
		const promises = notes.map(async note => ({ note: note, result: (await this.filter(me, note)) }));
		const data = await Promise.all(promises);
		const filteredNotes = data.filter(d => d.result).map(d => d.note);
		return filteredNotes.sort((a, b) => a.id > b.id ? -1 : 1);
	}

	@bindThis
	private async searchNoteByLike(
		q: string,
		me: MiUser | null,
		opts: SearchOpts,
		pagination: SearchPagination,
	): Promise<MiNote[]> {
		const query = this.queryService.makePaginationQuery(this.notesRepository.createQueryBuilder('note'), pagination.sinceId, pagination.untilId);

		if (opts.userId) {
			query.andWhere('note.userId = :userId', { userId: opts.userId });
		} else if (opts.channelId) {
			query.andWhere('note.channelId = :channelId', { channelId: opts.channelId });
		}

		query
			.innerJoinAndSelect('note.user', 'user')
			.leftJoinAndSelect('note.reply', 'reply')
			.leftJoinAndSelect('note.renote', 'renote')
			.leftJoinAndSelect('reply.user', 'replyUser')
			.leftJoinAndSelect('renote.user', 'renoteUser');

		if (this.config.fulltextSearch?.provider === 'sqlPgroonga') {
			query.andWhere('note.text &@~ :q', { q });
		} else {
			query.andWhere('LOWER(note.text) LIKE :q', { q: `%${sqlLikeEscape(q.toLowerCase()) }%` });
		}

		if (opts.host) {
			if (opts.host === '.') {
				query.andWhere('user.host IS NULL');
			} else {
				query.andWhere('user.host = :host', { host: opts.host });
			}
		}

		this.queryService.generateVisibilityQuery(query, me);
		this.queryService.generateBlockedHostQueryForNote(query);
		if (me) this.queryService.generateMutedUserQueryForNotes(query, me);
		if (me) this.queryService.generateBlockedUserQueryForNotes(query, me);

		return query.limit(pagination.limit).getMany();
	}

	@bindThis
	private async searchNoteByMeiliSearch(
		q: string,
		me: MiUser | null,
		opts: SearchOpts,
		pagination: SearchPagination,
	): Promise<MiNote[]> {
		if (!this.meilisearch || !this.meilisearchNoteIndex) {
			throw new Error('MeiliSearch is not available');
		}

		const filter: Q = {
			op: 'and',
			qs: [],
		};
		if (pagination.untilId) filter.qs.push({
			op: '<',
			k: 'createdAt',
			v: this.idService.parse(pagination.untilId).date.getTime(),
		});
		if (pagination.sinceId) filter.qs.push({
			op: '>',
			k: 'createdAt',
			v: this.idService.parse(pagination.sinceId).date.getTime(),
		});
		if (opts.userId) filter.qs.push({ op: '=', k: 'userId', v: opts.userId });
		if (opts.channelId) filter.qs.push({ op: '=', k: 'channelId', v: opts.channelId });
		if (opts.host) {
			if (opts.host === '.') {
				filter.qs.push({ op: 'is null', k: 'userHost' });
			} else {
				filter.qs.push({ op: '=', k: 'userHost', v: opts.host });
			}
		}

		const res = await this.meilisearchNoteIndex.search(q, {
			sort: ['createdAt:desc'],
			matchingStrategy: 'all',
			attributesToRetrieve: ['id', 'createdAt'],
			filter: compileQuery(filter),
			limit: pagination.limit,
		});
		if (res.hits.length === 0) {
			return [];
		}

		const notes = await this.notesRepository.findBy({
			id: In(res.hits.map(x => x.id)),
		});
		const promises = notes.map(async note => ({ note: note, result: (await this.filter(me, note)) }));
		const data = await Promise.all(promises);
		const filteredNotes = data.filter(d => d.result).map(d => d.note);
		return filteredNotes.sort((a, b) => a.id > b.id ? -1 : 1);
	}
}
