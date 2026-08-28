/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MiNote, NotesRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { SearchService } from '@/core/SearchService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

const BATCH_SIZE = 1000;

@Injectable()
export class ReindexNotesProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private searchService: SearchService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('reindex-notes');
	}

	private async countNotesApproximately(): Promise<number> {
		const rows = await this.notesRepository.query(
			'SELECT reltuples::bigint AS estimate FROM pg_class WHERE oid = $1::regclass',
			['note'],
		) as { estimate: string }[];

		const estimate = Number(rows[0]?.estimate ?? 0);
		return Number.isFinite(estimate) && estimate > 0 ? estimate : 0;
	}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>): Promise<void> {
		this.logger.info('Removing all indexes from search engine...');

		await this.searchService.unindexAllNotes();

		this.logger.info('Removed all indexes from search engine.');
		this.logger.info('Indexing all notes to search engine...');

		const lastNote = (await this.notesRepository.find({
			order: { id: 'DESC' },
			take: 1,
		}))[0];

		if (lastNote == null) {
			await job.updateProgress(100);
			this.logger.succ('No notes to re-index.');
			return;
		}

		const total = Math.max(1, await this.countNotesApproximately());

		let indexedCount = 0;
		let cursor: MiNote['id'] | null = null;

		while (true) {
			const query = this.notesRepository.createQueryBuilder('note')
				.where('note.id <= :lastId', { lastId: lastNote.id })
				.orderBy('note.id', 'ASC')
				.take(BATCH_SIZE);

			if (cursor != null) {
				query.andWhere('note.id > :cursor', { cursor });
			}

			const notes = await query.getMany();

			if (notes.length === 0) {
				await job.updateProgress(100);
				break;
			}

			cursor = notes[notes.length - 1].id;

			await this.searchService.indexNotes(notes);

			indexedCount += notes.length;

			await job.updateProgress(Math.min(100, 100 / total * indexedCount));
		}

		this.logger.succ('Successfully re-indexed all notes to search engine.');
	}
}
