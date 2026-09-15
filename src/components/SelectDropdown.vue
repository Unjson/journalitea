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
  min-width: 0;
}

.select-button {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-field);
  color: var(--color-ink);
  box-shadow: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.select-button:hover:not(:disabled) {
  border-color: var(--color-border-strong);
}

.select-button:focus {
  border-color: var(--color-focus);
  outline: none;
  box-shadow: 0 0 0 2px rgb(107 152 99 / 0.2);
}

.select-button.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.select-caret {
  justify-self: end;
  color: var(--color-ink-muted);
}

.select-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.select-options {
  position: absolute;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  background: var(--color-field);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-surface);
  box-shadow: 0 4px 12px rgb(41 51 42 / 0.1);
  z-index: 70;
  padding: 0.25rem;
  max-height: min(20rem, calc(100vh - 2rem));
  overflow-y: auto;
}

.select-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-control);
  border: none;
  background: transparent;
  text-align: left;
  color: var(--color-ink);
}

.select-option:hover {
  background: var(--color-surface-green);
}

.flag-icon {
  box-sizing: border-box;
  width: 1.25rem !important;
  min-width: 1.25rem;
  max-width: 1.25rem;
  height: 1.25rem !important;
  min-height: 1.25rem;
  max-height: 1.25rem;
  flex: 0 0 1.25rem;
  aspect-ratio: 1;
  display: block;
  object-fit: contain;
  align-self: center;
}

.select-button .flag-icon {
  inline-size: 1.25rem !important;
  block-size: 1.25rem !important;
  justify-self: start;
}
</style>
