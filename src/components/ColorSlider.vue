<script lang="ts" setup>
import { computed } from 'vue';
import { teaColorGradientCss, getColorForRating } from '../models/colors';

const props = defineProps<{
	modelValue: number;
	step?: number;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: number): void;
}>();

const safeValue = computed(() => {
	const value = Number(props.modelValue);
	if (isNaN(value)) return 0;
	return Math.min(Math.max(value, 0), 1);
});

const onInput = (event: Event) => {
	const target = event.target as HTMLInputElement;
	emit('update:modelValue', Number(target.value));
};
</script>

<template>
	<div class="flex flex-row justify-center gap-4 items-center">
		<div class="color-slider-track relative flex-1 h-12 rounded-md overflow-hidden border">
			<div class="color-slider-gradient absolute inset-0" :style="{ background: teaColorGradientCss }"></div>
			<input
				class="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer"
				type="range"
				min="0"
				max="1"
				:step="step ?? 0.01"
				:value="safeValue"
				:style="{ '--thumb-border-color': safeValue >= 0.78 ? '#ffffff' : '#1f2937' }"
				@input="onInput"
				aria-label="Color value"
			/>
		</div>
		<div class="color-slider-swatch w-12 h-12 rounded-md border" :style="{ backgroundColor: getColorForRating(safeValue) }"></div>
	</div>
</template>

<style scoped>
input[type='range']::-webkit-slider-thumb {
	-webkit-appearance: none;
	appearance: none;
	width: 16px;
	height: 44px;
	border-radius: var(--radius-control);
	background: transparent;
	border: 2px solid var(--thumb-border-color, #1f2937);
	box-shadow: 0 1px 3px rgb(41 51 42 / 0.25);
}

input[type='range']::-moz-range-thumb {
	width: 16px;
	height: 44px;
	border-radius: var(--radius-control);
	background: transparent;
	border: 2px solid var(--thumb-border-color, #1f2937);
	box-shadow: 0 1px 3px rgb(41 51 42 / 0.25);
}

input[type='range']::-webkit-slider-runnable-track {
	background: transparent;
}

input[type='range']::-moz-range-track {
	background: transparent;
}

.color-slider-track input[type='range'] {
	background-color: transparent !important;
}

.color-slider-gradient {
	pointer-events: none;
}

.color-slider-track,
.color-slider-swatch {
	border-color: var(--color-border);
}

</style>
