<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<MkA v-if="instance.emailRequiredForSignup && $i && !$i.email" :class="$style.item" to="/settings/email">
		<span :class="$style.icon">
			<i class="ti ti-circle-x" style="color: var(--MI_THEME-error);"></i>
		</span>
		<span :class="$style.title">{{ i18n.tsx.emailRegistrationRequiredBanner({ instance: instanceName }) }}</span>
	</MkA>
	<MkA v-if="$i && $i.email && !$i.emailVerified" :class="$style.item" to="/settings/email">
		<span :class="$style.icon">
			<i class="ti ti-mail"></i>
		</span>
		<span :class="$style.title">{{ i18n.ts.verificationEmailSent }}</span>
	</MkA>
	<MkA v-if="iAmModerator && unresolvedReportCount > 0" :class="$style.item" to="/admin/abuses">
		<span :class="$style.icon">
			<i class="ti ti-alert-triangle"></i>
		</span>
		<span :class="$style.title">{{ i18n.tsx.thereIsUnresolvedReportAbuse({ count: unresolvedReportCount }) }}</span>
	</MkA>
	<MkA v-if="($i?.isModerator ?? $i?.isAdmin) && !$i?.twoFactorEnabled" :class="$style.item" to="/settings/security">
		<span :class="$style.icon">
			<i class="ti ti-circle-key"></i>
		</span>
		<span :class="$style.title">{{ i18n.ts.youNeedToEnableTwoFactor }}</span>
	</MkA>
	<a v-if="($i?.isModerator ?? $i?.isAdmin) && $i?.isVacation && showVacationAlert" :class="$style.item" href="#" @click.prevent.stop="removeVacationAlert()">
		<span :class="$style.icon">
			<i class="ti ti-sandbox"></i>
		</span>
		<span :class="$style.title">{{ i18n.ts.youAreOnVacation }}</span>
	</a>
	<MkA
		v-for="announcement in $i.unreadAnnouncements.filter(x => x.display === 'banner')"
		:key="announcement.id"
		:class="$style.item"
		:to="`/announcements/${announcement.id}`"
	>
		<span :class="$style.icon">
			<i v-if="announcement.icon === 'info'" class="ti ti-info-circle"></i>
			<i v-else-if="announcement.icon === 'warning'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i>
			<i v-else-if="announcement.icon === 'error'" class="ti ti-circle-x" style="color: var(--MI_THEME-error);"></i>
			<i v-else-if="announcement.icon === 'success'" class="ti ti-check" style="color: var(--MI_THEME-success);"></i>
		</span>
		<span :class="$style.title">{{ announcement.title }}</span>
		<span :class="$style.body">{{ announcement.text }}</span>
	</MkA>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { instanceName } from '@@/js/config.js';
import { instance } from '@/instance.js';
import { $i, iAmModerator } from '@/i.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const unresolvedReportCount = ref<number>(0);
const showVacationAlert = prefer.r.vacationAlert;

function removeVacationAlert(): void {
	prefer.commit('vacationAlert', false);
}

if (iAmModerator) {
	misskeyApi('admin/abuse-user-reports', {
		state: 'unresolved',
	}).then((reports) => {
		unresolvedReportCount.value = reports.length;
	});
}
</script>

<style lang="scss" module>
.root {
	font-size: 15px;
	background: var(--MI_THEME-panel);
}

.item {
	--height: 24px;
	font-size: 0.85em;

	display: flex;
	vertical-align: bottom;
	width: 100%;
	line-height: var(--height);
	height: var(--height);
	overflow: clip;
	contain: strict;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);

	@container (max-width: 1000px) {
		display: block;
		text-align: center;

		> .body {
			display: none;
		}
	}
}

.icon {
	margin-left: 10px;
}

.title {
	padding: 0 10px;
	font-weight: bold;

	&:empty {
		display: none;
	}
}

.body {
	min-width: 0;
	flex: 1;
	overflow: clip;
	white-space: nowrap;
	text-overflow: ellipsis;
}
</style>
