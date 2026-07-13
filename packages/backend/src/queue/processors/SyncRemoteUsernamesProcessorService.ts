/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { And, IsNull, LessThanOrEqual, MoreThan, Not } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiUser, UsersRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { ApResolverService } from '@/core/activitypub/ApResolverService.js';
import { getApId, isActor } from '@/core/activitypub/type.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class SyncRemoteUsernamesProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private apResolverService: ApResolverService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('sync-remote-usernames');
	}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>): Promise<void> {
		this.logger.info('Syncing usernames of all remote users...');

		const total = await this.usersRepository.countBy({
			host: Not(IsNull()),
			uri: Not(IsNull()),
			isDeleted: false,
		});
		if (total === 0) {
			await job.updateProgress(100);
			return;
		}

		const lastUser = (await this.usersRepository.find({
			where: { host: Not(IsNull()), uri: Not(IsNull()), isDeleted: false },
			order: { id: 'DESC' },
			take: 1,
		}))[0];

		let checkedCount = 0;
		let updatedCount = 0;
		let failedCount = 0;
		let cursor: MiUser['id'] | null = null;

		while (true) {
			const users = await this.usersRepository.find({
				where: {
					host: Not(IsNull()),
					uri: Not(IsNull()),
					isDeleted: false,
					id: cursor ? And(MoreThan(cursor), LessThanOrEqual(lastUser.id)) : LessThanOrEqual(lastUser.id),
				},
				take: 10,
				order: { id: 'ASC' },
			});

			if (users.length === 0) break;

			cursor = users[users.length - 1].id;

			// Resolverはリクエスト履歴を保持するため、バッチごとに作り直す
			const resolver = this.apResolverService.createResolver();

			await Promise.allSettled(users.map(async user => {
				if (user.uri == null || user.host == null) return;
				try {
					const object = await resolver.resolve(user.uri);

					if (!isActor(object)) return;
					if (getApId(object) !== user.uri) return;

					const remoteUsername = object.preferredUsername;
					if (typeof remoteUsername !== 'string') return;
					if (!(remoteUsername.length > 0 && remoteUsername.length <= 128 && /^\w([\w-.]*\w)?$/.test(remoteUsername))) return;
					if (remoteUsername === user.username) return;

					const conflict = await this.usersRepository.exists({
						where: {
							usernameLower: remoteUsername.toLowerCase(),
							host: user.host!,
							id: Not(user.id),
						},
					});
					if (conflict) {
						this.logger.warn(`Skipping ${user.id} (@${user.username}@${user.host} -> @${remoteUsername}): username already taken on that host`);
						return;
					}

					await this.usersRepository.update(user.id, {
						username: remoteUsername,
						usernameLower: remoteUsername.toLowerCase(),
					});
					updatedCount++;
					this.logger.info(`Updated username of ${user.id}: @${user.username}@${user.host} -> @${remoteUsername}@${user.host}`);
				} catch (err) {
					failedCount++;
					this.logger.debug(`Failed to fetch actor of ${user.id} (@${user.username}@${user.host}): ${err}`);
				}
			}));

			checkedCount += users.length;
			await job.updateProgress(100 / total * checkedCount);
		}

		await job.updateProgress(100);
		this.logger.succ(`Successfully synced remote usernames. checked: ${checkedCount}, updated: ${updatedCount}, fetch failed: ${failedCount}`);
	}
}
