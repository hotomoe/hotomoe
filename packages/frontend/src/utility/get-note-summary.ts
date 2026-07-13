/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';

/**
 * 投稿を表す文字列を取得します。
 * @param {*} note (packされた)投稿
 */
export const getNoteSummary = (note?: Misskey.entities.Note | null): string => {
	if (note == null) {
		return '';
	}

	if (note.deletedAt) {
		return `(${i18n.ts.deletedNote})`;
	}

	if (note.isHidden) {
		return `(${i18n.ts.invisibleNote})`;
	}

	if (note.visibility === 'specified' && prefer.s.privateMode && prefer.s.hideDirectMessages) {
		return `(${i18n.ts.youAreHidingSensitiveInformation})`;
	}

	let summary = '';

	// 本文
	if (note.cw != null) {
		summary += note.cw;
	} else {
		summary += note.text ? note.text : '';
	}

	// ファイルが添付されているとき
	if ((note.files || []).length !== 0) {
		summary += ` (${i18n.tsx.withNFiles({ n: note.files.length })})`;
	}

	// 投票が添付されているとき
	if (note.poll) {
		summary += ` (${i18n.ts.poll})`;
	}

	// 返信のとき
	if (note.replyId) {
		if (note.reply) {
			summary += `\n\nRE: ${getNoteSummary(note.reply)}`;
		} else {
			summary += '\n\nRE: ...';
		}
	}

	// Renoteのとき
	if (note.renoteId) {
		if (note.renote) {
			summary += `\n\nRN: ${getNoteSummary(note.renote)}`;
		} else {
			summary += '\n\nRN: ...';
		}
	}

	return summary.trim();
};
