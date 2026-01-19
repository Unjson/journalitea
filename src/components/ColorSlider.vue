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
	<div class="space-y-2 w-full max-w-2xl">
		<div class="relative h-12 rounded-md overflow-hidden border border-gray-300">
			<div class="absolute inset-0" :style="{ background: teaColorGradientCss }"></div>
			<input
				class="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer"
				type="range"
				min="0"
				max="1"
				:step="step ?? 0.01"
				:value="safeValue"
				@input="onInput"
				aria-label="Color value"
			/>
		</div>
		<div class="flex items-center gap-3">
			<div class="w-10 h-10 rounded-md border border-gray-300" :style="{ backgroundColor: getColorForRating(safeValue) }"></div>
			<div class="text-xs text-gray-500">Value: {{ safeValue.toFixed(2) }}</div>
		</div>
	</div>
</template>

<style scoped>
input[type='range']::-webkit-slider-thumb {
	-webkit-appearance: none;
	appearance: none;
	width: 12px;
	height: 44px;
	border-radius: 4px;
	background: transparent;
	border: 1px solid #1f2937;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

input[type='range']::-moz-range-thumb {
	width: 12px;
	height: 44px;
	border-radius: 4px;
	background: transparent;
	border: 1px solid #1f2937;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

input[type='range']::-webkit-slider-runnable-track {
	background: transparent;
}

input[type='range']::-moz-range-track {
	background: transparent;
}
</style>
