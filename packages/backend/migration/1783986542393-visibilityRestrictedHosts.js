/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class visibilityRestrictedHosts1783986542393 {
	name = 'visibilityRestrictedHosts1783986542393'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" ADD "visibilityRestrictedHosts" character varying(1024) array NOT NULL DEFAULT '{}'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "visibilityRestrictedHosts"`);
	}
}
