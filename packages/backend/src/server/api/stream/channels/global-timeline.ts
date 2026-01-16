/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { franc } from 'franc';
import { bindThis } from '@/decorators.js';
import type { Packed } from '@/misc/json-schema.js';
import { MetaService } from '@/core/MetaService.js';
import { RoleService } from '@/core/RoleService.js';
import { CacheService } from '@/core/CacheService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { JsonObject } from '@/misc/json-value.js';
import type Logger from '@/logger.js';
import { LoggerService } from '@/core/LoggerService.js';
import Channel, { type MiChannelService } from '../channel.js';

class GlobalTimelineChannel extends Channel {
	private logger: Logger;

	public readonly chName = 'globalTimeline';
	public static readonly shouldShare = false;
	public static readonly requireCredential = false as const;
	private withRenotes: boolean;
	private withFiles: boolean;
	private minimize: boolean;

	constructor(
		private metaService: MetaService,
		private roleService: RoleService,
		private cacheService: CacheService,
		private noteEntityService: NoteEntityService,

		private loggerService: LoggerService,

		id: string,
		connection: Channel['connection'],
		dimension?: number | null,
	) {
		super(id, connection, dimension);
		//this.onNote = this.onNote.bind(this);
		this.logger = this.loggerService.getLogger('global-timeline-channel');
	}

	@bindThis
	public async init(params: JsonObject) {
		const policies = await this.roleService.getUserPolicies(this.user ? this.user.id : null);
		if (!policies.gtlAvailable) return;

		this.withRenotes = !!(params.withRenotes ?? true);
		this.withFiles = !!(params.withFiles ?? false);
		this.minimize = !!(params.minimize ?? false);

		// Subscribe events
		this.subscriber.on('notesStream', this.onNote);
	}

	/**
	 * 노트의 언어를 기반으로 dimension을 결정합니다.
	 * 1 - 다른 모든 언어
	 * 2 - 일본어 (ja)
	 * 3 - 한국어 (ko)
	 */
	@bindThis
	private async getNoteDimensionByLanguage(note: Packed<'Note'>): Promise<number> {
		// 리노트(순수 리노트)인 경우 원본 노트의 언어 사용
		const targetNote = (note.renote && isRenotePacked(note) && !isQuotePacked(note)) ? note.renote : note;

		// 캐시에서 노트 언어 가져오기
		let noteLang = await this.cacheService.noteLanguageCache.fetch(targetNote.id);

		// 노트 언어가 없으면 사용자의 기본 게시 언어 사용
		if (!noteLang) {
			const userLang = await this.cacheService.userLanguageCache.fetch(targetNote.userId);
			noteLang = userLang?.postingLang ?? null;
		}

		// 캐시에도 사용자 언어에도 없으면 franc로 텍스트에서 언어 감지
		if (!noteLang && targetNote.text) {
			const detected = franc(targetNote.text, { minLength: 3, only: ['jpn', 'kor', 'eng', 'und'] });
			if (detected !== 'und') {
				noteLang = detected;
			}
		}

		this.logger.info(`Note ${note.id} language: ${noteLang}`);

		if (!noteLang) {
			return 1; // 언어 정보가 없으면 기본 dimension
		}

		// 일본어 (ja, ja-JP, jpn 등)
		if (noteLang === 'ja' || noteLang.startsWith('ja-') || noteLang === 'jpn') {
			return 2;
		}

		// 한국어 (ko, ko-KR, kor 등)
		if (noteLang === 'ko' || noteLang.startsWith('ko-') || noteLang === 'kor') {
			return 3;
		}

		// 그 외 모든 언어
		return 1;
	}

	/**
	 * 언어 기반 dimension으로 노트를 필터링합니다.
	 */
	@bindThis
	private async shouldDeliverByLanguageDimension(note: Packed<'Note'>): Promise<boolean> {
		// dimension이 설정되지 않으면 모든 노트 표시
		if (this.dimension == null || this.dimension === 0) {
			this.logger.info(`Note ${note.id}: dimension is 0 or null, showing all notes`);
			return true;
		}

		// 멘션이나 visibleUserIds에 현재 사용자가 포함되어 있으면 항상 표시
		if (this.user) {
			if (note.mentions?.includes(this.user.id)) return true;
			if (note.visibleUserIds?.includes(this.user.id)) return true;
			if (note.reply?.userId === this.user.id) return true;
			if (note.renote?.userId === this.user.id) return true;
		}

		const noteDimension = await this.getNoteDimensionByLanguage(note);
		const shouldDeliver = this.dimension === noteDimension;
		this.logger.info(`Note ${note.id}: viewer dimension=${this.dimension}, note dimension=${noteDimension}, deliver=${shouldDeliver}`);
		return shouldDeliver;
	}

	@bindThis
	private async onNote(note: Packed<'Note'>) {
		if (note.visibility !== 'public') return;
		if (note.channelId != null) return;
		if (note.user.requireSigninToViewContents && this.user == null) return;
		if (note.renote && note.renote.user.requireSigninToViewContents && this.user == null) return;
		if (note.reply && note.reply.user.requireSigninToViewContents && this.user == null) return;

		// ファイルを含まない投稿は除外
		if (this.withFiles && (note.fileIds == null || note.fileIds.length === 0)) return;
		if (this.withFiles && (note.files === undefined || note.files.length === 0)) return;

		// 関係ない返信は除外
		if (note.reply) {
			const reply = note.reply;
			if ((this.following[note.userId]?.withReplies ?? false)) {
				// 自分のフォローしていないユーザーの visibility: followers な投稿への返信は弾く
				if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId)) return;
				// 自分の見ることができないユーザーの visibility: specified な投稿への返信は弾く
				if (reply.visibility === 'specified' && !reply.visibleUserIds!.includes(this.user!.id)) return;
			} else {
				// 「チャンネル接続主への返信」でもなければ、「チャンネル接続主が行った返信」でもなければ、「投稿者の投稿者自身への返信」でもない場合
				if (reply.userId !== this.user!.id && note.userId !== this.user!.id && reply.userId !== note.userId) return;
			}
		}

		// 純粋なリノート（引用リノートでないリノート）の場合
		if (note.renote && isRenotePacked(note) && !isQuotePacked(note)) {
			if (!this.withRenotes) return;
			if (note.renote.reply) {
				const reply = note.renote.reply;
				// 自分のフォローしていないユーザーの visibility: followers な投稿への返信のリノートは弾く
				if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId)) return;
			}
		}

		if (!(await this.shouldDeliverByLanguageDimension(note))) return;

		if (!(await this.noteEntityService.isLanguageVisibleToMe(note, this.user?.id))) return;

		if (this.isNoteMutedOrBlocked(note)) return;

		if (this.user && isRenotePacked(note) && !isQuotePacked(note)) {
			if (note.renote && Object.keys(note.renote.reactions).length > 0) {
				const myRenoteReaction = await this.noteEntityService.populateMyReaction(note.renote, this.user.id);
				note.renote.myReaction = myRenoteReaction;
			}
		}

		if (this.user && (note.visibleUserIds?.includes(this.user.id) ?? note.mentions?.includes(this.user.id))) {
			this.connection.cacheNote(note);
		}

		if (this.minimize && ['public', 'home'].includes(note.visibility)) {
			const badgeRoles = this.iAmModerator ? await this.roleService.getUserBadgeRoles(note.userId, false) : undefined;

			this.send('note', {
				id: note.id, myReaction: note.myReaction,
				poll: note.poll?.choices ? { choices: note.poll.choices } : undefined,
				reply: note.reply?.myReaction ? { myReaction: note.reply.myReaction } : undefined,
				renote: note.renote?.myReaction ? { myReaction: note.renote.myReaction } : undefined,
				...(badgeRoles?.length ? { user: { badgeRoles } } : {}),
			});
		} else {
			this.send('note', note);
		}
	}

	@bindThis
	public dispose() {
		// Unsubscribe events
		this.subscriber.off('notesStream', this.onNote);
	}
}

@Injectable()
export class GlobalTimelineChannelService implements MiChannelService<false> {
	public readonly shouldShare = GlobalTimelineChannel.shouldShare;
	public readonly requireCredential = GlobalTimelineChannel.requireCredential;
	public readonly kind = GlobalTimelineChannel.kind;

	constructor(
		private metaService: MetaService,
		private roleService: RoleService,
		private cacheService: CacheService,
		private noteEntityService: NoteEntityService,
		private loggerService: LoggerService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection'], dimension?: number | null): GlobalTimelineChannel {
		return new GlobalTimelineChannel(
			this.metaService,
			this.roleService,
			this.cacheService,
			this.noteEntityService,
			this.loggerService,
			id,
			connection,
			dimension,
		);
	}
}
