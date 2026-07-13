<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps_m">
	<MkFolder>
		<template #icon><i class="ti ti-flask"></i></template>
		<template #label>{{ i18n.ts.misskeyExperimentalFeatures }}</template>

		<div class="_gaps_m">
			<MkSwitch v-model="enableCondensedLine">
				<template #label>Enable condensed line</template>
			</MkSwitch>
		</div>
	</MkFolder>

	<FormSection>
		<template #label><i class="ti ti-lock-access"></i> {{ i18n.ts.hideSensitiveInformation }}</template>
		<template #description>{{ i18n.ts._hideSensitiveInformation.about }}</template>

		<div class="_gaps_m">
			<MkInfo warn rounded>
				{{ i18n.ts.thisIsExperimentalFeature }}
			</MkInfo>

			<MkSwitch v-model="privateMode">
				{{ i18n.ts._hideSensitiveInformation.use }}
			</MkSwitch>
			<MkFolder v-if="privateMode">
				<template #label>{{ i18n.ts._hideSensitiveInformation.directMessages }}</template>
				<template v-if="hideDirectMessages" #suffix>{{ i18n.ts._hideSensitiveInformation.itsHidden }}</template>
				<template v-else #suffix>{{ i18n.ts._hideSensitiveInformation.itsNotHidden }}</template>
				<MkSwitch v-model="hideDirectMessages">
					{{ i18n.ts._hideSensitiveInformation.directMessagesUse }}
					<template #caption>{{ i18n.ts._hideSensitiveInformation.directMessagesDescription }}</template>
				</MkSwitch>
			</MkFolder>
			<MkFolder v-if="privateMode">
				<template #label>{{ i18n.ts._hideSensitiveInformation.drive }}</template>
				<template v-if="hideDriveFileList" #suffix>{{ i18n.ts._hideSensitiveInformation.itsHidden }}</template>
				<template v-else #suffix>{{ i18n.ts._hideSensitiveInformation.itsNotHidden }}</template>
				<MkSwitch v-model="hideDriveFileList">
					{{ i18n.ts._hideSensitiveInformation.driveUse }}
					<template #caption>{{ i18n.ts._hideSensitiveInformation.driveDescription }}</template>
				</MkSwitch>
			</MkFolder>
			<MkFolder v-if="privateMode && iAmModerator">
				<template #label>{{ i18n.ts._hideSensitiveInformation.moderationLog }}</template>
				<template v-if="hideModerationLog" #suffix>{{ i18n.ts._hideSensitiveInformation.itsHidden }}</template>
				<template v-else #suffix>{{ i18n.ts._hideSensitiveInformation.itsNotHidden }}</template>
				<MkSwitch v-model="hideModerationLog">
					{{ i18n.ts._hideSensitiveInformation.moderationLogUse }}
					<template #caption>{{ i18n.ts._hideSensitiveInformation.moderationLogDescription }}</template>
				</MkSwitch>
			</MkFolder>
			<MkFolder v-if="privateMode && iAmModerator">
				<template #label>{{ i18n.ts._hideSensitiveInformation.roles }}</template>
				<template v-if="hideRoleList" #suffix>{{ i18n.ts._hideSensitiveInformation.itsHidden }}</template>
				<template v-else #suffix>{{ i18n.ts._hideSensitiveInformation.itsNotHidden }}</template>
				<MkSwitch v-model="hideRoleList">
					{{ i18n.ts._hideSensitiveInformation.rolesUse }}
					<template #caption>{{ i18n.ts._hideSensitiveInformation.rolesDescription }}</template>
				</MkSwitch>
			</MkFolder>
		</div>
	</FormSection>

	<FormSection v-if="$i.isModerator || $i.isAdmin">
		<template #label><i class="ti ti-beach"></i> {{ i18n.ts.vacationMode }}</template>
		<template #description>{{ i18n.ts.vacationModeDescription }}</template>

		<div class="_gaps_m">
			<MkInfo warn rounded>
				{{ i18n.ts.thisIsExperimentalFeature }}
			</MkInfo>

			<MkSwitch v-model="isVacation" @update:modelValue="save()">
				{{ i18n.ts.useVacationMode }}
			</MkSwitch>
		</div>
	</FormSection>

	<FormSection>
		<template #label><i class="ti ti-globe-off"></i> {{ i18n.ts.mindControl }}</template>
		<template #description>{{ i18n.ts.mindControlDescription }}</template>

		<div class="_gaps_m">
			<MkInfo warn rounded>
				{{ i18n.ts.thisIsExperimentalFeature }}
			</MkInfo>

			<MkSwitch v-model="hideCounters">
				{{ i18n.ts.hideCounters }}
				<template #caption>{{ i18n.ts.hideCountersDescription }}</template>
			</MkSwitch>
		</div>
	</FormSection>

	<!--
	<MkSelect v-model="followingVisibility" @update:modelValue="save()">
		<template #label>{{ i18n.ts.followingVisibility }}</template>
		<option value="public">{{ i18n.ts._ffVisibility.public }}</option>
		<option value="followers">{{ i18n.ts._ffVisibility.followers }}</option>
		<option value="private">{{ i18n.ts._ffVisibility.private }}</option>
	</MkSelect>

	<MkSelect v-model="followersVisibility" @update:modelValue="save()">
		<template #label>{{ i18n.ts.followersVisibility }}</template>
		<option value="public">{{ i18n.ts._ffVisibility.public }}</option>
		<option value="followers">{{ i18n.ts._ffVisibility.followers }}</option>
		<option value="private">{{ i18n.ts._ffVisibility.private }}</option>
	</MkSelect>

	<MkSwitch v-model="hideOnlineStatus" @update:modelValue="save()">
		{{ i18n.ts.hideOnlineStatus }}
		<template #caption>{{ i18n.ts.hideOnlineStatusDescription }}</template>
	</MkSwitch>
	<MkSwitch v-model="noCrawle" @update:modelValue="save()">
		{{ i18n.ts.noCrawle }}
		<template #caption>{{ i18n.ts.noCrawleDescription }}</template>
	</MkSwitch>
	<MkSwitch v-model="preventAiLearning" @update:modelValue="save()">
		{{ i18n.ts.preventAiLearning }}<span class="_beta">{{ i18n.ts.beta }}</span>
		<template #caption>{{ i18n.ts.preventAiLearningDescription }}</template>
	</MkSwitch>
	<MkSwitch v-model="isExplorable" @update:modelValue="save()">
		{{ i18n.ts.makeExplorable }}
		<template #caption>{{ i18n.ts.makeExplorableDescription }}</template>
	</MkSwitch>
	-->
</div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';
// import MkSelect from '@/components/MkSelect.vue';
import FormSection from '@/components/form/section.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkInfo from '@/components/MkInfo.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { iAmModerator, ensureSignin } from '@/i.js';
import { definePage } from '@/page.js';
import { prefer } from '@/preferences.js';
import * as os from '@/os.js';
import { unisonReload } from '@/utility/unison-reload.js';

const $i = ensureSignin();

const isVacation = ref<boolean | undefined>($i.isVacation !== null ? $i.isVacation : undefined);

const hideCounters = prefer.model('hideCounters');
const enableCondensedLine = prefer.model('enableCondensedLine');
const privateMode = prefer.model('privateMode');
const hideDirectMessages = prefer.model('hideDirectMessages');
const hideDriveFileList = prefer.model('hideDriveFileList');
const hideModerationLog = prefer.model('hideModerationLog');
const hideRoleList = prefer.model('hideRoleList');

function save() {
	if (isVacation.value === true) {
		prefer.commit('vacationAlert', true);
	}
	misskeyApi('i/update', {
		isVacation: isVacation.value,
	});
}

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: 'info',
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

watch([
	isVacation,
	enableCondensedLine,
	privateMode,
	hideCounters,
	hideDirectMessages,
	hideDriveFileList,
	hideRoleList,
	hideModerationLog,
], async () => {
	await reloadAsk();
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.experimentalFeatures,
	icon: 'ti ti-barrier-block',
}));
</script>
