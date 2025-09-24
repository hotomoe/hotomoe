/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import moment from 'moment-timezone';

export const timezones =
[
	'UTC', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai',
	'Australia/Sydney', 'Australia/Darwin', 'Australia/Perth',
	'America/New_York', 'America/Mexico_City', 'America/Phoenix',
	'America/Los_Angeles',
].map((x) => ({
	name: x,
	abbrev: moment.tz.zone(x).abbr(Date.now()),
	offset: -moment.tz.zone(x).utcOffset(Date.now()),
}));
