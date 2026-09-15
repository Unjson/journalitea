<script lang="ts" setup>
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
  }>(),
  {
    min: 0,
    max: 5,
    step: 1,
    label: '',
  }
);

const emit = defineEmits<{ (e: 'update:modelValue', value: number): void }>();

const sliderStyle = computed(() => {
  const min = props.min ?? 0;
  const max = props.max ?? 5;
  const range = max - min || 1;
  const value = Math.min(max, Math.max(min, props.modelValue));
  const percent = ((value - min) / range) * 100;

  return {
    background: `linear-gradient(to right, var(--color-chart-primary) 0%, var(--color-chart-primary) ${percent}%, var(--color-chart-grid) ${percent}%, var(--color-chart-grid) 100%)`,
  };
});

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', Number(target.value));
};
</script>

<template>
  <div class="vertical-slider-component">
    <div class="slider-track-area">
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        @input="onInput"
        class="vertical-slider"
        :style="sliderStyle"
      />
    </div>
    <label v-if="label" class="slider-label">{{ label }}</label>
    <div class="slider-value">{{ modelValue }}</div>
  </div>
</template>

<style scoped>
.vertical-slider-component {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 40px;
  height: 220px;
  padding: 6px 4px 10px;
  box-sizing: border-box;
}

.slider-track-area {
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vertical-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 140px;
  height: 20px;
  transform: rotate(-90deg);
  background: var(--color-chart-grid);
  border-radius: var(--radius-control);
  outline: none;
  margin: 0;
}

.vertical-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 4px;
  height: 20px;
  background: var(--color-chart-primary);
  border-radius: var(--radius-control);
  cursor: pointer;
}

.vertical-slider::-moz-range-thumb {
  width: 4px;
  height: 20px;
  background: var(--color-chart-primary);
  border-radius: var(--radius-control);
  cursor: pointer;
  border: none;
}

.slider-label {
  margin-top: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-ink);
  text-align: center;
  line-height: 1.2;
}

.slider-value {
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}
</style>
