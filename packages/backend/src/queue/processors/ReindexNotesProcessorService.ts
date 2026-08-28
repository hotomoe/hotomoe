/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { LessThanOrEqual } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiNote, NotesRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { SearchService } from '@/core/SearchService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

const BATCH_SIZE = 1000;

/**
 * How many notes are handed to the search engine at once. indexNote() issues one request
 * per note, so putting a whole batch in flight would open a thousand simultaneous
 * connections and overwhelm the engine long before the database became the limit.
 */
const INDEX_CONCURRENCY = 50;

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

		if (lastNote == null) {
			await job.updateProgress(100);
			this.logger.succ('No notes to re-index.');
			return;
		}

		// Counted once, before the loop. This used to be recomputed on every iteration, so a
		// full COUNT(*) over `note` ran for each batch of 20 notes purely to update a progress
		// percentage. On a 30M-note instance that count alone takes ~35s, which put a complete
		// re-index into the hundreds of days.
		const total = await this.notesRepository.countBy({
			id: LessThanOrEqual(lastNote.id),
		});

		let indexedCount = 0;
		let cursor: MiNote['id'] | null = null;

		while (true) {
			// A query builder rather than find(), because two conditions are needed on `id`.
			// The previous version spread `{ id: MoreThan(cursor) }` over
			// `{ id: LessThanOrEqual(lastNote.id) }` in the same object literal, so the later
			// key silently replaced the earlier one: once the cursor was set the upper bound
			// was gone and the scan chased notes created while it ran.
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

			for (let i = 0; i < notes.length; i += INDEX_CONCURRENCY) {
				await Promise.all(notes
					.slice(i, i + INDEX_CONCURRENCY)
					.map(note => this.searchService.indexNote(note)));
			}

			// notes.length, not a flat batch size: the final batch is usually partial, and
			// the old `indexedCount += 20` pushed the reported progress past 100%.
			indexedCount += notes.length;

			await job.updateProgress(Math.min(100, 100 / total * indexedCount));
		}

		this.logger.succ('Successfully re-indexed all notes to search engine.');
	}
}
