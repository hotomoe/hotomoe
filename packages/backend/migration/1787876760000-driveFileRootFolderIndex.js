/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * The drive root listing runs
 *
 *   SELECT ... FROM drive_file
 *   WHERE "userId" = $1 AND "folderId" IS NULL
 *   ORDER BY id DESC LIMIT $2
 *
 * and no existing index can serve both the filter and the ordering.
 * IDX_55720b33a61a7c806a8215b825 ("userId", "folderId", id) looks like it should,
 * but Postgres only derives a path's sort order from *equality* conditions, and
 * `"folderId" IS NULL` is not one - so it cannot conclude the output is already
 * ordered by id. That leaves the planner two poor choices:
 *
 *   - index on ("userId") + Sort: reads every file the user owns, then sorts. On
 *     an account with ~150k files this was 130k buffer reads and ~11s cold.
 *   - backward scan of the primary key with a filter: fast when the user has recent
 *     uploads, and arbitrarily slow when they do not.
 *
 * A partial index on ("userId", id DESC) WHERE "folderId" IS NULL fixes it: with the
 * predicate carrying the folderId condition, "userId" equality alone determines the
 * order, so the LIMIT reads only as many index entries as it returns. Measured against
 * the equivalent forced plan: 0.23ms / 9 buffers instead of 11s / 130k.
 *
 * Note this is not a space saving - on hotomoe 99.9% of drive_file rows have a NULL
 * folderId, so the partial index is nearly the full table (~300MB). What it buys is
 * the sort order.
 *
 * CONCURRENTLY so drive uploads keep working while it builds; that cannot run inside
 * a transaction, hence `transaction = false`.
 */
export class driveFileRootFolderIndex1787876760000 {
	name = 'driveFileRootFolderIndex1787876760000'
	transaction = false;

	async up(queryRunner) {
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_DRIVE_FILE_USER_ROOT_ID" ON "drive_file" ("userId", "id" DESC) WHERE "folderId" IS NULL`);
		await queryRunner.query(`ANALYZE "drive_file"`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_DRIVE_FILE_USER_ROOT_ID"`);
	}
}
