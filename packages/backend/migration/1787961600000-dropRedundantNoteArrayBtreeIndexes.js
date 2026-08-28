/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class dropRedundantNoteArrayBtreeIndexes1787961600000 {
	name = 'dropRedundantNoteArrayBtreeIndexes1787961600000'
	transaction = false;

	async up(queryRunner) {
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_88937d94d7443d9a99a76fa5c0"`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_54ebcb6d27222913b908d56fd8"`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_796a8c03959361f97dc2be1d5c"`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_51c063b6a133a9cb87145450f5"`);
	}

	async down(queryRunner) {
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_88937d94d7443d9a99a76fa5c0" ON "note" ("tags")`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_54ebcb6d27222913b908d56fd8" ON "note" ("mentions")`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_796a8c03959361f97dc2be1d5c" ON "note" ("visibleUserIds")`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_51c063b6a133a9cb87145450f5" ON "note" ("fileIds")`);
	}
}
