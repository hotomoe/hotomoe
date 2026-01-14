/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { LessThanOrEqual, MoreThan } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiNote, NotesRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { SearchService } from '@/core/SearchService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

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

		if (!lastNote) {
			this.logger.succ('No notes to index.');
			return;
		}

		let indexedCount = 0;
		let cursor: MiNote['id'] | null = null;

		while (true) {
			const notes = await this.notesRepository.find({
				where: {
					id: LessThanOrEqual(lastNote.id),
					...(cursor ? { id: MoreThan(cursor) } : {}),
				},
				take: 20,
				order: {
					id: 'ASC',
				},
			});

			if (notes.length === 0) {
				await job.updateProgress(100);
				break;
			}

			cursor = notes[notes.length - 1].id;

			await Promise.all(notes.map(note => this.searchService.indexNote(note)));

			indexedCount += 20;

			const total = await this.notesRepository.countBy({
				id: LessThanOrEqual(lastNote.id),
			});

			await job.updateProgress(100 / total * indexedCount);
		}

		this.logger.succ('Successfully re-indexed all notes to search engine.');
	}
}
