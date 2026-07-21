<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref} from 'vue';
import { useI18n } from 'vue-i18n';

type SelectOption = {
  value: string | number;
  label: string;
  displayLabel?: string;
  iconUrl?: string;
};

const { t } = useI18n();
const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    options: SelectOption[];
    disabled?: boolean;
    ariaLabel?: string;
  }>(),
  {
    disabled: false,
    ariaLabel: '',
  }
);

const emit = defineEmits<{ (e: 'update:modelValue', value: string | number): void }>();

const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);

const selectedOption = computed(() =>
  props.options.find(option => option.value === props.modelValue)
);

const optionLabel = (option?: SelectOption) =>
  option?.displayLabel ?? (option ? t(option.label) : '');

const toggleOpen = () => {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
};

const selectOption = (option: SelectOption) => {
  emit('update:modelValue', option.value);
  isOpen.value = false;
};

const onClickOutside = (event: MouseEvent) => {
  if (!root.value) return;
  if (!root.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside);
});
</script>

<template>
  <div ref="root" class="select-dropdown">
    <button
      type="button"
      class="select-button"
      :class="{ disabled: disabled }"
      :disabled="disabled"
      @click="toggleOpen"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-label="ariaLabel"
    >
      <img
        v-if="selectedOption?.iconUrl"
        class="flag-icon"
        :src="selectedOption.iconUrl"
        alt=""
      />
      <span class="select-label">{{ optionLabel(selectedOption) }}</span>
      <span class="select-caret">▾</span>
    </button>

    <ul v-if="isOpen" class="select-options" role="listbox">
      <li v-for="option in options" :key="option.value" role="option">
        <button type="button" class="select-option" @click="selectOption(option)">
          <img
            v-if="option.iconUrl"
            class="flag-icon"
            :src="option.iconUrl"
            alt=""
          />
          <span>{{ optionLabel(option) }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.select-dropdown {
  position: relative;
  width: 100%;
}

.select-button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: #ffffff;
  color: #374151;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.select-button.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.select-caret {
  margin-left: auto;
  color: #6b7280;
}

.select-options {
  position: absolute;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 10;
  padding: 0.25rem;
}

.select-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  text-align: left;
  color: #374151;
}

.select-option:hover {
  background: #f3f4f6;
}

.flag-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}
</style>
