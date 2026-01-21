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
      :class="{ active: value <= modelValue }"
      :aria-checked="value === modelValue"
      role="radio"
      :disabled="disabled"
      @click="setRating(value)"
    >
      <span aria-hidden="true">★</span>
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

.star-button.active {
  color: #f59e0b;
}

.star-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
