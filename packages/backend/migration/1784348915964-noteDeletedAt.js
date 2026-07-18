/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class noteDeletedAt1784348915964 {
	name = 'noteDeletedAt1784348915964'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DELETE FROM "note" WHERE "deletedAt" IS NOT NULL`);
		await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "deletedAt"`);
	}
}
