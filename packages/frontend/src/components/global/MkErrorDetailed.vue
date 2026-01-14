<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition :name="prefer.s.animation ? '_transition_zoom' : ''" appear>
	<div :class="$style.root">
		<img :class="$style.img" :src="serverErrorImageUrl" class="_ghost"/>
		<p :class="$style.text"><i class="ti ti-alert-triangle"></i> {{ i18n.ts.somethingHappened }}</p>
		<details class="_acrylic" style="margin: 1em 0;">
			<summary>{{ i18n.ts.details }}</summary>
			<div class="_gaps_s" style="text-align: initial;">
				<MkKeyValue v-for="(value, key) in error.info" :key="key" :value="value">
					<template #key>{{ key }}</template>
					<template #value>{{ value }}</template>
				</MkKeyValue>
			</div>
		</details>
		<MkButton :class="$style.button" primary @click="() => emit('retry')">{{ i18n.ts.retry }}</MkButton>
		<MkButton :class="$style.button" @click="copy">{{ i18n.ts.copyToClipboard }}</MkButton>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { serverErrorImageUrl } from '@/instance.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import MkKeyValue from '@/components/MkKeyValue.vue';
import { success } from '@/os.js';

const props = defineProps<{
	error: any;
}>();

const emit = defineEmits<{
	(ev: 'retry'): void;
}>();

function copy() {
	const date = new Date().toISOString();
	copyToClipboard(`Info: ${JSON.stringify(props.error.info)}\nDate: ${date}`);
	success();
}
</script>

<style lang="scss" module>
.root {
	padding: 32px;
	text-align: center;
	align-items: center;
}

.text {
	margin: 0 0 8px 0;
}

.button {
	margin: 0 auto;
}

.img {
	vertical-align: bottom;
	height: 300px;
	margin-bottom: 16px;
	border-radius: 16px;
}
</style>
