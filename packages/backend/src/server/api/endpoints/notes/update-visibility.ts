/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import type { MiNote } from '@/models/Note.js';
import type { NotesRepository, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { RoleService } from '@/core/RoleService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes'],

	requireCredential: true,

	kind: 'write:notes',

	limit: {
		duration: ms('1hour'),
		max: 300,
		minInterval: ms('1sec'),
	},

	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '2fa9d7b8-04a9-4dcb-9314-8b1b0f7de1d5',
		},

		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '3e130b09-e33a-4189-83e3-a7f4ff41b7ca',
		},

		cannotRaiseVisibility: {
			message: 'You cannot raise the visibility of a note.',
			code: 'CANNOT_RAISE_VISIBILITY',
			id: '6ca24f56-0e2d-4bd2-9ec4-641d92b6a575',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		visibility: { type: 'string', enum: ['home', 'followers'] },
	},
	required: ['noteId', 'visibility'],
} as const;

const visibilityRank = {
	public: 3,
	home: 2,
	followers: 1,
	specified: 0,
} as const satisfies Record<MiNote['visibility'], number>;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private getterService: GetterService,
		private roleService: RoleService,
		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch(err => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') throw new ApiError(meta.errors.noSuchNote);
				throw err;
			});

			if (!await this.roleService.isModerator(me) && (note.userId !== me.id)) {
				throw new ApiError(meta.errors.accessDenied);
			}

			if (visibilityRank[ps.visibility] >= visibilityRank[note.visibility]) {
				throw new ApiError(meta.errors.cannotRaiseVisibility);
			}

			await this.notesRepository.update(note.id, {
				visibility: ps.visibility,
			});

			if (note.userId !== me.id) {
				const user = await this.usersRepository.findOneByOrFail({ id: note.userId });
				this.moderationLogService.log(me, 'updateNoteVisibility', {
					noteId: note.id,
					noteUserId: note.userId,
					noteUserUsername: user.username,
					noteUserHost: user.host,
					before: note.visibility,
					after: ps.visibility,
				});
			}
		});
	}
}
