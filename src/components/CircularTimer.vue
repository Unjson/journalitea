<script lang="ts" setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';

const props = withDefaults(defineProps<{
	totalSeconds: number;
	remainingSeconds: number;
	displayText: string;
	size: number;
	paused: boolean;
}>(), {
	size: 240,
	paused: false
});

const radius = props.size / 2;
const stroke = props.size / 15;
const normalizedRadius = radius - stroke / 2;
const circumference = 2 * Math.PI * normalizedRadius;

const progress = computed(() => {
	if (props.totalSeconds <= 0) return 0;
	const elapsed = Math.max(0, props.totalSeconds - props.remainingSeconds);
	return Math.min(1, elapsed / props.totalSeconds);
});

const dashOffset = computed(() => circumference * (1 - progress.value));

const ringState = ref<'normal' | 'paused' | 'complete'>(props.paused ? 'paused' : 'normal');
let completeTimeout: number | null = null;

const ringColor = computed(() => {
	if (ringState.value === 'complete') return 'var(--color-chart-tea-green)';
	if (ringState.value === 'paused') return 'var(--color-chart-tea-yellow)';
	return 'var(--color-primary)';
});

const emit = defineEmits<{
	(e: 'toggle'): void;
	(e: 'reset'): void;
}>();

const handleClick = () => {
	emit('toggle');
};

const handleDoubleClick = () => {
	emit('reset');
};

watch(
	() => props.remainingSeconds,
	(value, prev) => {
		if (value <= 0 && prev > 0) {
			ringState.value = 'complete';
			if (completeTimeout) {
				window.clearTimeout(completeTimeout);
			}
			completeTimeout = window.setTimeout(() => {
				ringState.value = props.paused ? 'paused' : 'normal';
				completeTimeout = null;
			}, 3600);
		}
	}
);

watch(
	() => props.paused,
	(isPaused) => {
		if (ringState.value === 'complete') return;
		ringState.value = isPaused ? 'paused' : 'normal';
	}
);

onBeforeUnmount(() => {
	if (completeTimeout) {
		window.clearTimeout(completeTimeout);
	}
});
</script>

<template>
	<div
		class="relative flex items-center justify-center cursor-pointer"
		:style="{ '--timer-size': `${size}px` }"
		@click="handleClick"
		@dblclick="handleDoubleClick"
	>
		<svg :width="radius * 2" :height="radius * 2" class="block">
			<circle
				:cx="radius"
				:cy="radius"
				:r="normalizedRadius"
				stroke="var(--color-primary-soft)"
				:stroke-width="stroke"
				fill="transparent"
			/>
			<circle
				:cx="radius"
				:cy="radius"
				:r="normalizedRadius"
				:stroke="ringColor"
				:stroke-width="stroke"
				fill="transparent"
				stroke-linecap="round"
				:stroke-dasharray="circumference"
				:stroke-dashoffset="dashOffset"
				:transform="`rotate(-90 ${radius} ${radius})`"
				class="ring-progress"
			/>
		</svg>
		<div class="absolute timer-text font-semibold">
			{{ displayText }}
		</div>
	</div>
</template>


<style scoped>
.timer-text {
	font-size: calc(var(--timer-size) / 6);
}

.ring-progress {
	transition: stroke-dashoffset 0.6s ease, stroke 0.2s ease;
}
</style>

