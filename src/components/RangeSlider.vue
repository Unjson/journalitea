<script lang="ts" setup>
import { computed, ref } from 'vue';

const props = withDefaults(
	defineProps<{
		min: number;
		max: number;
		lowerValue: number;
		upperValue: number;
		step?: number;
		label?: string;
		lowerLabel?: string;
		upperLabel?: string;
		lowerValueLabel?: string;
		upperValueLabel?: string;
	}>(),
	{
		step: 0.01,
		label: 'Price range',
		lowerLabel: 'Minimum price',
		upperLabel: 'Maximum price',
	},
);

const emit = defineEmits<{
	(e: 'update:lowerValue', value: number): void;
	(e: 'update:upperValue', value: number): void;
}>();

const activeHandle = ref<'lower' | 'upper'>('upper');

const bounds = computed(() => {
	const rawMin = Number(props.min);
	const rawMax = Number(props.max);
	const min = Number.isFinite(rawMin) ? rawMin : 0;
	const max = Number.isFinite(rawMax) ? rawMax : min;

	return {
		min: Math.min(min, max),
		max: Math.max(min, max),
	};
});

const safeStep = computed(() => {
	const step = Number(props.step);
	return Number.isFinite(step) && step > 0 ? step : 0.01;
});

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const stepCount = computed(() => {
	const range = bounds.value.max - bounds.value.min;
	if (range <= 0) {
		return 0;
	}

	const ratio = range / safeStep.value;
	const nearestInteger = Math.round(ratio);
	const normalizedRatio = Math.abs(ratio - nearestInteger) < 1e-9 ? nearestInteger : ratio;
	return Math.max(1, Math.ceil(normalizedRatio));
});

const valueToPosition = (value: number) => {
	if (stepCount.value === 0) {
		return 0;
	}

	if (value >= bounds.value.max) {
		return stepCount.value;
	}

	return clamp(
		Math.round((value - bounds.value.min) / safeStep.value),
		0,
		stepCount.value,
	);
};

const positionToValue = (position: number) => {
	if (position >= stepCount.value) {
		return bounds.value.max;
	}

	return bounds.value.min + (clamp(position, 0, stepCount.value) * safeStep.value);
};

const safeLowerPosition = computed(() => valueToPosition(Number(props.lowerValue)));
const safeUpperPosition = computed(() => valueToPosition(Number(props.upperValue)));
const safeLowerValue = computed(() => positionToValue(safeLowerPosition.value));
const safeUpperValue = computed(() => positionToValue(safeUpperPosition.value));

const lowerPercent = computed(() => {
	const range = bounds.value.max - bounds.value.min;
	return range === 0 ? 0 : ((safeLowerValue.value - bounds.value.min) / range) * 100;
});

const upperPercent = computed(() => {
	const range = bounds.value.max - bounds.value.min;
	return range === 0 ? 100 : ((safeUpperValue.value - bounds.value.min) / range) * 100;
});

const trackStyle = computed(() => ({
	background: `linear-gradient(to right, var(--color-chart-grid) 0%, var(--color-chart-grid) ${lowerPercent.value}%, var(--color-chart-primary) ${lowerPercent.value}%, var(--color-chart-primary) ${upperPercent.value}%, var(--color-chart-grid) ${upperPercent.value}%, var(--color-chart-grid) 100%)`,
}));

const isDisabled = computed(() => bounds.value.min === bounds.value.max);

const setActiveHandle = (handle: 'lower' | 'upper') => {
	activeHandle.value = handle;
};

const handleLowerInput = (event: Event) => {
	setActiveHandle('lower');
	const value = positionToValue(Number((event.target as HTMLInputElement).value));
	emit('update:lowerValue', clamp(value, bounds.value.min, safeUpperValue.value));
};

const handleUpperInput = (event: Event) => {
	setActiveHandle('upper');
	const value = positionToValue(Number((event.target as HTMLInputElement).value));
	emit('update:upperValue', clamp(value, safeLowerValue.value, bounds.value.max));
};

const lowerValueLabel = computed(() => props.lowerValueLabel ?? String(safeLowerValue.value));
const upperValueLabel = computed(() => props.upperValueLabel ?? String(safeUpperValue.value));
</script>

<template>
	<div class="range-slider" role="group" :aria-label="label">
		<div class="range-slider__track" :style="trackStyle">
			<input
				class="range-slider__input"
				:class="{ 'range-slider__input--active': activeHandle === 'lower' }"
				type="range"
				min="0"
				:max="stepCount"
				step="1"
				:value="safeLowerPosition"
				:aria-valuemin="bounds.min"
				:aria-valuemax="bounds.max"
				:aria-valuenow="safeLowerValue"
				:aria-label="lowerLabel"
				:aria-valuetext="lowerValueLabel"
				:disabled="isDisabled"
				@focus="setActiveHandle('lower')"
				@pointerdown="setActiveHandle('lower')"
				@input="handleLowerInput"
			/>
			<input
				class="range-slider__input"
				:class="{ 'range-slider__input--active': activeHandle === 'upper' }"
				type="range"
				min="0"
				:max="stepCount"
				step="1"
				:value="safeUpperPosition"
				:aria-valuemin="bounds.min"
				:aria-valuemax="bounds.max"
				:aria-valuenow="safeUpperValue"
				:aria-label="upperLabel"
				:aria-valuetext="upperValueLabel"
				:disabled="isDisabled"
				@focus="setActiveHandle('upper')"
				@pointerdown="setActiveHandle('upper')"
				@input="handleUpperInput"
			/>
		</div>
		<div class="range-slider__values" aria-hidden="true">
			<span>{{ lowerValueLabel }}</span>
			<span>{{ upperValueLabel }}</span>
		</div>
	</div>
</template>

<style scoped>
.range-slider {
	width: 100%;
}

.range-slider__track {
	position: relative;
	width: 100%;
	height: 0.5rem;
	border-radius: var(--radius-control);
}

.range-slider__input {
	position: absolute;
	top: 50%;
	left: 0;
	width: 100%;
	height: 2rem;
	margin: 0;
	transform: translateY(-50%);
	appearance: none;
	background: transparent;
	pointer-events: none;
	outline: none;
}

.range-slider__input--active {
	z-index: 2;
}

.range-slider__input::-webkit-slider-runnable-track {
	height: 0.5rem;
	background: transparent;
}

.range-slider__input::-moz-range-track {
	height: 0.5rem;
	background: transparent;
}

.range-slider__input::-webkit-slider-thumb {
	width: 1rem;
	height: 1rem;
	margin-top: -0.25rem;
	appearance: none;
	border: 2px solid var(--color-chart-primary);
	border-radius: 50%;
	background: var(--color-field);
	box-shadow: 0 1px 3px rgb(41 51 42 / 0.25);
	cursor: pointer;
	pointer-events: auto;
}

.range-slider__input::-moz-range-thumb {
	width: 1rem;
	height: 1rem;
	border: 2px solid var(--color-chart-primary);
	border-radius: 50%;
	background: var(--color-field);
	box-shadow: 0 1px 3px rgb(41 51 42 / 0.25);
	cursor: pointer;
	pointer-events: auto;
}

.range-slider__input:disabled {
	cursor: not-allowed;
	opacity: 0.65;
}

.range-slider__values {
	display: flex;
	justify-content: space-between;
	gap: 1rem;
	margin-top: 0.4rem;
	padding: 0 0.2rem;
	color: var(--color-ink-muted);
	font-size: 0.75rem;
}
</style>