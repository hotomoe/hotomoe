/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class driveFileColumnLengths1784387375597 {
	name = 'driveFileColumnLengths1784387375597'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "drive_file" ALTER COLUMN "comment" TYPE character varying(8192)`);
		await queryRunner.query(`ALTER TABLE "drive_file" ALTER COLUMN "thumbnailUrl" TYPE character varying(1024)`);
		await queryRunner.query(`ALTER TABLE "drive_file" ALTER COLUMN "webpublicUrl" TYPE character varying(1024)`);
	}

	async down(queryRunner) {
		await queryRunner.query(`UPDATE "drive_file" SET "comment" = left("comment", 512) WHERE length("comment") > 512`);
		await queryRunner.query(`UPDATE "drive_file" SET "thumbnailUrl" = NULL WHERE length("thumbnailUrl") > 512`);
		await queryRunner.query(`UPDATE "drive_file" SET "webpublicUrl" = NULL WHERE length("webpublicUrl") > 512`);
		await queryRunner.query(`ALTER TABLE "drive_file" ALTER COLUMN "comment" TYPE character varying(512)`);
		await queryRunner.query(`ALTER TABLE "drive_file" ALTER COLUMN "thumbnailUrl" TYPE character varying(512)`);
		await queryRunner.query(`ALTER TABLE "drive_file" ALTER COLUMN "webpublicUrl" TYPE character varying(512)`);
	}
}
