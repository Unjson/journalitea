<script lang="ts" setup>
import { computed } from 'vue';


const props = withDefaults(
  defineProps<{
    modelValue: number;
    max?: number;
    disabled?: boolean;
    ariaLabel?: string;
  }>(),
  {
    max: 5,
    disabled: false,
    ariaLabel: 'Rating',
  }
);

const emit = defineEmits<{ (e: 'update:modelValue', value: number): void }>();

const stars = computed(() => Array.from({ length: props.max }, (_, i) => i + 1));

const getFillPercentage = (value: number) => {
  const fill = Math.max(0, Math.min(1, props.modelValue - (value - 1)));
  return `${Math.round(fill * 100)}%`;
};

const setRating = (value: number) => {
  if (props.disabled) return;
  emit('update:modelValue', value === props.modelValue ? 0 : value);
};
</script>

<template>
  <div class="star-rating" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="value in stars"
      :key="value"
      type="button"
      class="star-button"
      :aria-checked="value === modelValue"
      role="radio"
      :disabled="disabled"
      @click="setRating(value)"
    >
      <span class="star" aria-hidden="true">
        <span class="star-base">★</span>
        <span class="star-fill" :style="{ width: getFillPercentage(value) }">★</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.star-rating {
  display: flex;
  align-items: center;
  gap: 6px;
}

.star-button {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  font-size: 3em;
  line-height: 1;
  color: #d1d5db;
  cursor: pointer;
}

.star {
  position: relative;
  display: inline-block;
  line-height: 1;
}

.star-base {
  color: #d1d5db;
}

.star-fill {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  overflow: hidden;
  color: #f59e0b;
  white-space: nowrap;
}

.star-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
