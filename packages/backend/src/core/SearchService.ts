/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';
import { LoggerService } from '@/core/LoggerService.js';
import { MiNote } from '@/models/Note.js';
import { MiUser } from '@/models/_.js';
import type { NotesRepository } from '@/models/_.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { isUserRelated } from '@/misc/is-user-related.js';
import { CacheService } from '@/core/CacheService.js';
import { QueryService } from '@/core/QueryService.js';
import { IdService } from '@/core/IdService.js';
import { UserEntityService } from './entities/UserEntityService.js';
import type Logger from '@/logger.js';
import type { Index, MeiliSearch } from 'meilisearch';
import type { Client as ElasticSearch } from '@elastic/elasticsearch';

type K = string;
type V = string | number | boolean;
type Q =
	{ op: '=', k: K, v: V } |
	{ op: '!=', k: K, v: V } |
	{ op: '>', k: K, v: number } |
	{ op: '<', k: K, v: number } |
	{ op: '>=', k: K, v: number } |
	{ op: '<=', k: K, v: number } |
	{ op: 'is null', k: K} |
	{ op: 'is not null', k: K} |
	{ op: 'and', qs: Q[] } |
	{ op: 'or', qs: Q[] } |
	{ op: 'not', q: Q };

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
	private meilisearchNoteIndex: Index | null = null;
	private elasticsearchNoteIndex: string | null = null;
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meilisearch)
		private meilisearch: MeiliSearch | null,

		@Inject(DI.elasticsearch)
		private elasticsearch: ElasticSearch | null,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private userEntityService: UserEntityService,
		private cacheService: CacheService,
		private queryService: QueryService,
		private idService: IdService,
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('note:search');

		if (meilisearch) {
			this.meilisearchNoteIndex = meilisearch.index(`${config.meilisearch!.index}---notes`);
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
		} else if (this.elasticsearch) {
			this.elasticsearchNoteIndex = `${config.elasticsearch!.index}---notes`;
			this.elasticsearch.indices.exists({
				index: this.elasticsearchNoteIndex,
			}).then((indexExists) => {
				if (!indexExists) {
					this.elasticsearch?.indices.create(
						{
							index: this.elasticsearchNoteIndex + `-${new Date().toISOString().slice(0, 7).replace(/-/g, '')}`,
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
											nori: {
												type: 'nori_tokenizer',
												decompound_mode: 'mixed',
												discard_punctuation: false,
											},
										},
										analyzer: {
											kuromoji_analyzer: {
												type: 'custom',
												tokenizer: 'kuromoji',
											},
											nori_analyzer: {
												type: 'custom',
												tokenizer: 'nori',
											},
										},
									},
								},
							},
						},
					).catch((error: any) => {
						this.logger.error(error);
					});
				}
			}).catch((error: any) => {
				this.logger.error('Error while checking if index exists', error);
			});
		}
	}

	@bindThis
	public async indexNote(note: MiNote): Promise<void> {
		if (note.text == null && note.cw == null) return;
		//		if (!['home', 'public'].includes(note.visibility)) return;

		const createdAt = this.idService.parse(note.id).date;
		if (this.meilisearch) {
			switch (this.meilisearchIndexScope) {
				case 'global':
					break;

				case 'local':
					if (note.userHost == null) break;
					return;

				default: {
					if (note.userHost == null) break;
					if (this.meilisearchIndexScope.includes(note.userHost)) break;
					return;
				}
			}

			await this.meilisearchNoteIndex?.addDocuments([{
				id: note.id,
				createdAt: createdAt.getTime(),
				userId: note.userId,
				userHost: note.userHost,
				channelId: note.channelId,
				cw: note.cw,
				text: note.text,
				tags: note.tags,
			}], {
				primaryKey: 'id',
			});
		}	else if (this.elasticsearch) {
			const body = {
				createdAt: createdAt.getTime(),
				userId: note.userId,
				userHost: note.userHost,
				channelId: note.channelId,
				cw: note.cw,
				text: note.text,
				tags: note.tags,
			};
			await this.elasticsearch.index({
				index: `${this.elasticsearchNoteIndex}-${createdAt.toISOString().slice(0, 7).replace(/-/g, '')}`,
				id: note.id,
				body: body,
			}).catch((error: any) => {
				this.logger.error(error);
			});
		}
	}

	@bindThis
	public async unindexNote(note: MiNote): Promise<void> {
		// if (!['home', 'public'].includes(note.visibility)) return;

		if (this.meilisearch) {
			this.meilisearchNoteIndex!.deleteDocument(note.id);
		} else if (this.elasticsearch) {
			await this.elasticsearch.delete({
				index: `${this.elasticsearchNoteIndex}-${this.idService.parse(note.id).date.toISOString().slice(0, 7).replace(/-/g, '')}`,
				id: note.id,
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
			if (!me) return false;
			if (note.visibility === 'followers') {
				const relationship = await this.userEntityService.getRelation(me.id, note.userId);
				if (relationship.isFollowing) return true;
			}
			if (!note.visibleUserIds.includes(me.id) && !note.mentions.includes(me.id)) return false;
		}
		return true;
	}

	@bindThis
	public async searchNote(q: string, me: MiUser | null, opts: {
		userId?: MiNote['userId'] | null;
		channelId?: MiNote['channelId'] | null;
		host?: string | null;
	}, pagination: {
		untilId?: MiNote['id'];
		sinceId?: MiNote['id'];
		limit?: number;
	}): Promise<MiNote[]> {
		if (this.meilisearch) {
			const filter: Q = {
				op: 'and',
				qs: [],
			};
			if (pagination.untilId) filter.qs.push({
				op: '<',
				k: 'createdAt',
				v: this.idService.parse(pagination.untilId).date.getTime()
			});
			if (pagination.sinceId) filter.qs.push({
				op: '>',
				k: 'createdAt',
				v: this.idService.parse(pagination.sinceId).date.getTime()
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
			const res = await this.meilisearchNoteIndex!.search(q, {
				sort: ['createdAt:desc'],
				matchingStrategy: 'all',
				attributesToRetrieve: ['id', 'createdAt'],
				filter: compileQuery(filter),
				limit: pagination.limit,
			});
			if (res.hits.length === 0) return [];

			const notes = await this.notesRepository.findBy({
				id: In(res.hits.map(x => x.id)),
			});
			const promises = notes.map(async note => ({ note: note, result: (await this.filter(me, note)) }));
			const data = await Promise.all(promises);
			const dataFilter = data.filter(d => d.result);
			const filteredNotes = dataFilter.map(d => d.note);
			return filteredNotes.sort((a, b) => a.id > b.id ? -1 : 1);
		} else if (this.elasticsearch) {
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
					esFilter.bool.must.push({ bool: { must_not: [{ exists: { field: 'userHost' } }] } });
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
							{ wildcard: { 'cw': { value: q } } },
							{ simple_query_string: { fields: ['cw'], 'query': q, default_operator: 'and' } },
						],
						minimum_should_match: 1,
					},
				});
			}

			const res = await (this.elasticsearch.search)({
				index: this.elasticsearchNoteIndex + '*' as string,
				body: {
					query: esFilter,
					sort: [{ createdAt: { order: 'desc' } }],
				},
				_source: ['id', 'createdAt'],
				size: pagination.limit,
			});

			const noteIds = res.hits.hits.map((hit: any) => hit._id);
			if (noteIds.length === 0) return [];
			const notes = await this.notesRepository.findBy({
				id: In(noteIds),
			});
			const promises = notes.map(async note => ({ note: note, result: (await this.filter(me, note)) }));
			const data = await Promise.all(promises);
			const dataFilter = data.filter(d => d.result);
			const filteredNotes = dataFilter.map(d => d.note);
			return filteredNotes.sort((a, b) => a.id > b.id ? -1 : 1);
		} else {
			const query = this.queryService.makePaginationQuery(this.notesRepository.createQueryBuilder('note'), pagination.sinceId, pagination.untilId);

			if (opts.userId) {
				query.andWhere('note.userId = :userId', { userId: opts.userId });
			} else if (opts.channelId) {
				query.andWhere('note.channelId = :channelId', { channelId: opts.channelId });
			}

			query
				.andWhere('note.text ILIKE :q', { q: `%${ sqlLikeEscape(q) }%` })
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			if (opts.host) {
				if (opts.host === '.') {
					query.andWhere('user.host IS NULL');
				} else {
					query.andWhere('user.host = :host', { host: opts.host });
				}
			}

			this.queryService.generateVisibilityQuery(query, me);
			if (me) this.queryService.generateMutedUserQuery(query, me);
			if (me) this.queryService.generateBlockedUserQuery(query, me);

			return await query.limit(pagination.limit).getMany();
		}
	}
}
