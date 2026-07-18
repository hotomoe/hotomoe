<template>
<div ref="el" :class="$style.root" :style="{ zIndex }">
	<Transition
		:name="prefer.s.animation ? '_transition_zoom' : ''"
		@afterLeave="emit('closed')"
	>
		<div v-if="showing" class="_popup _shadow">
			<article :class="$style.body">
				<header :class="$style.header">
					<span v-if="skebStatus.isAcceptable" :class="$style.skebAcceptable">
						{{ i18n.ts._skebStatus.seeking }}
					</span>
					<span v-else-if="skebStatus.isCreator" :class="$style.skebStopped">
						{{ i18n.ts._skebStatus.stopped }}
					</span>
					<span v-else :class="$style.skebClient">
						{{ i18n.ts._skebStatus.client }}
					</span>
					<Mfm v-if="skebStatus.creatorRequestCount > 0" :text="i18n.tsx._skebStatus.nWorks({ n: skebStatus.creatorRequestCount.toLocaleString() })" :nyaize="false" :colored="false"/>
					<Mfm v-else-if="skebStatus.clientRequestCount > 0" :text="i18n.tsx._skebStatus.nRequests({ n: skebStatus.clientRequestCount.toLocaleString() })" :nyaize="false" :colored="false"/>
				</header>
				<div v-if="skebStatus.isAcceptable" :class="$style.divider"></div>
				<div v-if="skebStatus.isAcceptable" class="contents _gaps_s">
					<Mfm v-for="skill in skebStatus.skills" :key="skill.genre" :text="`${i18n.ts._skebStatus._genres[skill.genre]} ${i18n.tsx._skebStatus.yenX({ x: skill.amount.toLocaleString() })}`" :nyaize="false" :colored="false"/>
				</div>
			</article>
		</div>
	</Transition>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { calcPopupPosition } from '@/utility/popup-position.js';
import { prefer } from "@/preferences";

const props = defineProps<{
	showing: boolean;
	skebStatus: Misskey.Endpoints['users/get-skeb-status']['res'];
	source: HTMLElement;
}>();

const emit = defineEmits<(ev: 'closed') => void>();

// タイミングによっては最初から showing = false な場合があり、その場合に closed 扱いにしないと永久にDOMに残ることになる
if (!props.showing) emit('closed');

const el = shallowRef<HTMLElement>();
const zIndex = os.claimZIndex('high');

function setPosition() {
	if (el.value == null) return;

	const data = calcPopupPosition(el.value, {
		anchorElement: props.source,
		direction: 'bottom',
		align: 'center',
		innerMargin: 0,
	});

	el.value.style.transformOrigin = data.transformOrigin;
	el.value.style.left = data.left + 'px';
	el.value.style.top = data.top + 'px';
}

let loopHandler: number | undefined;
let unmounted = false;

// 位置追従ループは表示中のみ回す(非表示のままマウントされ続けた場合やアンマウント後にループが残るとCPUを食い続けるため)
function startLoop() {
	if (unmounted || loopHandler != null) return;

	const loop = () => {
		setPosition();
		loopHandler = window.requestAnimationFrame(loop);
	};

	loop();
}

function stopLoop() {
	if (loopHandler != null) {
		window.cancelAnimationFrame(loopHandler);
		loopHandler = undefined;
	}
}

watch(() => props.showing, (showing) => {
	if (showing) startLoop();
	else stopLoop();
});

onMounted(() => {
	nextTick(() => {
		setPosition();
		if (props.showing) startLoop();
	});
});

onUnmounted(() => {
	unmounted = true;
	stopLoop();
});
</script>

<style lang="scss" module>
.root {
	position: absolute;
	padding: 8px 12px;
	text-align: center;
	pointer-events: none;
	transform-origin: center center;
}

.body {
	position: relative;
	box-sizing: border-box;
	padding: 16px;
}

.header {
	display: flex;
	gap: 2px;
	align-items: center;
}

.divider {
	margin: 8px auto;
	border-top: solid 0.5px var(--MI_THEME-divider);
}

.skebAcceptable,
.skebStopped,
.skebClient {
	display: inline-flex;
	border: solid 1px;
	border-radius: 6px;
	padding: 2px 6px;
	margin-right: 4px;
	font-size: 85%;
}

.skebAcceptable {
	color: rgb(255, 255, 255);
	background-color: rgb(241, 70, 104);
}

.skebStopped {
	color: rgb(255, 255, 255);
	background-color: rgb(54, 54, 54);
}

.skebClient {
	color: rgb(255, 255, 255);
	background-color: rgb(54, 54, 54);
}
</style>
