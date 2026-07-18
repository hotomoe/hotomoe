/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// TODO: useTooltip関数使うようにしたい
// ただディレクティブ内でonUnmountedなどのcomposition api使えるのか不明

import { defineAsyncComponent, ref } from 'vue';
import type { Directive } from 'vue';
import { isTouchUsing } from '@/utility/touch.js';
import { popup, alert } from '@/os.js';

const start = isTouchUsing ? 'touchstart' : 'mouseenter';
const end = isTouchUsing ? 'touchend' : 'mouseleave';

export default {
	mounted(el: HTMLElement, binding, vn) {
		const delay = binding.modifiers.noDelay ? 0 : 100;

		const self = (el as any)._tooltipDirective_ = {} as any;

		self.text = binding.value as string;
		self._close = null;
		self.showTimer = null;
		self.hideTimer = null;
		self.checkTimer = null;

		self.close = () => {
			if (self._close) {
				window.clearInterval(self.checkTimer);
				self._close();
				self._close = null;
			}
		};

		if (binding.arg === 'dialog') {
			el.addEventListener('click', (ev) => {
				ev.preventDefault();
				ev.stopPropagation();
				alert({
					type: 'info',
					text: binding.value,
				});
				return false;
			});
		}

		self.show = async () => {
			if (!window.document.body.contains(el)) return;
			if (self._close) return;
			if (self.text == null) return;

			const showing = ref(true);

			// popupのマウントは非同期なので、await後に_closeを設定するとawait中のmouseleaveを取りこぼしてツールチップが閉じなくなる
			self._close = () => {
				showing.value = false;
			};

			// 表示中に対象要素がDOMから消えた場合(タイムラインのノート再利用など)、mouseleaveが発火しないため自前で閉じる
			self.checkTimer = window.setInterval(() => {
				if (!window.document.body.contains(el)) {
					window.clearTimeout(self.showTimer);
					window.clearTimeout(self.hideTimer);
					self.close();
				}
			}, 1000);

			await popup(defineAsyncComponent(() => import('@/components/MkTooltip.vue')), {
				showing,
				text: self.text,
				asMfm: binding.modifiers.mfm,
				direction: binding.modifiers.left ? 'left' : binding.modifiers.right ? 'right' : binding.modifiers.top ? 'top' : binding.modifiers.bottom ? 'bottom' : 'top',
				targetElement: el,
			}, {}, 'closed');
		};

		el.addEventListener('selectstart', ev => {
			ev.preventDefault();
		});

		el.addEventListener(start, (ev) => {
			window.clearTimeout(self.showTimer);
			window.clearTimeout(self.hideTimer);
			if (delay === 0) {
				self.show();
			} else {
				self.showTimer = window.setTimeout(self.show, delay);
			}
		}, { passive: true });

		el.addEventListener(end, () => {
			window.clearTimeout(self.showTimer);
			window.clearTimeout(self.hideTimer);
			if (delay === 0) {
				self.close();
			} else {
				self.hideTimer = window.setTimeout(self.close, delay);
			}
		}, { passive: true });

		el.addEventListener('click', () => {
			window.clearTimeout(self.showTimer);
			self.close();
		});
	},

	updated(el, binding) {
		const self = el._tooltipDirective_;
		self.text = binding.value as string;
	},

	unmounted(el, binding, vn) {
		const self = el._tooltipDirective_;
		// 表示中(または表示待ち)のままアンマウントされた場合に閉じないと、ツールチップが永久にDOMに残る
		window.clearTimeout(self.showTimer);
		window.clearTimeout(self.hideTimer);
		self.close();
	},
} as Directive;
