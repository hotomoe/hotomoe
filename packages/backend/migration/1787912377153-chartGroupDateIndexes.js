/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class chartGroupDateIndexes1787912377153 {
	name = 'chartGroupDateIndexes1787912377153'
	transaction = false;

	async up(queryRunner) {
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_instance_group_date" ON "__chart__instance" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_39ee857ab2f23493037c6b6631"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_per_user_notes_group_date" ON "__chart__per_user_notes" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_5048e9daccbbbc6d567bb142d3"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_per_user_reaction_group_date" ON "__chart__per_user_reaction" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_229a41ad465f9205f1f5703291"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_day_per_user_notes_group_date" ON "__chart_day__per_user_notes" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_c5545d4b31cdc684034e33b81c"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_day_per_user_reaction_group_date" ON "__chart_day__per_user_reaction" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_d54b653660d808b118e36c184c"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_day_instance_group_date" ON "__chart_day__instance" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_fea7c0278325a1a2492f2d6acb"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_per_user_following_group_date" ON "__chart__per_user_following" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_b77d4dd9562c3a899d9a286fcd"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_day_per_user_following_group_date" ON "__chart_day__per_user_following" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_e4849a3231f38281280ea4c0ee"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_per_user_drive_group_date" ON "__chart__per_user_drive" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_30bf67687f483ace115c5ca642"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_day_per_user_drive_group_date" ON "__chart_day__per_user_drive" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_62aa5047b5aec92524f24c701d"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_per_user_pv_group_date" ON "__chart__per_user_pv" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_f2a56da57921ca8439f45c1d95"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_day_per_user_pv_group_date" ON "__chart_day__per_user_pv" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_f221e45cfac5bea0ce0f3149fb"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_hashtag_group_date" ON "__chart__hashtag" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_25a97c02003338124b2b75fdbc"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_day_hashtag_group_date" ON "__chart_day__hashtag" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_8f589cf056ff51f09d6096f645"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_test_group_date" ON "__chart__test" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_a319e5dbf47e8a17497623beae"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_test_grouped_group_date" ON "__chart__test_grouped" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_b14489029e4b3aaf4bba5fb524"`);
		await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_chart_test_unique_group_date" ON "__chart__test_unique" ("group", "date" DESC)`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_a0cd75442dd10d0643a17c4a49"`);
	}

	async down(queryRunner) {
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_39ee857ab2f23493037c6b6631" ON "__chart__instance" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_instance_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_5048e9daccbbbc6d567bb142d3" ON "__chart__per_user_notes" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_per_user_notes_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_229a41ad465f9205f1f5703291" ON "__chart__per_user_reaction" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_per_user_reaction_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_c5545d4b31cdc684034e33b81c" ON "__chart_day__per_user_notes" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_day_per_user_notes_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_d54b653660d808b118e36c184c" ON "__chart_day__per_user_reaction" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_day_per_user_reaction_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_fea7c0278325a1a2492f2d6acb" ON "__chart_day__instance" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_day_instance_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_b77d4dd9562c3a899d9a286fcd" ON "__chart__per_user_following" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_per_user_following_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_e4849a3231f38281280ea4c0ee" ON "__chart_day__per_user_following" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_day_per_user_following_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_30bf67687f483ace115c5ca642" ON "__chart__per_user_drive" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_per_user_drive_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_62aa5047b5aec92524f24c701d" ON "__chart_day__per_user_drive" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_day_per_user_drive_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_f2a56da57921ca8439f45c1d95" ON "__chart__per_user_pv" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_per_user_pv_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_f221e45cfac5bea0ce0f3149fb" ON "__chart_day__per_user_pv" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_day_per_user_pv_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_25a97c02003338124b2b75fdbc" ON "__chart__hashtag" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_hashtag_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_8f589cf056ff51f09d6096f645" ON "__chart_day__hashtag" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_day_hashtag_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_a319e5dbf47e8a17497623beae" ON "__chart__test" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_test_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_b14489029e4b3aaf4bba5fb524" ON "__chart__test_grouped" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_test_grouped_group_date"`);
		await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_a0cd75442dd10d0643a17c4a49" ON "__chart__test_unique" ("date", "group")`);
		await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_chart_test_unique_group_date"`);
	}
}
