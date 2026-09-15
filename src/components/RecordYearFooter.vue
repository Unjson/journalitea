<script lang="ts" setup>
import { ref, onMounted, watch, nextTick } from 'vue';

interface Props {
  years: number[];
  selectedYear: number | null;
  label: string;
  allLabel: string;
  disabled?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'select', year: number | null): void;
}>();

const scrollerRef = ref<HTMLDivElement | null>(null);
const chipRefs = ref<Map<string, HTMLButtonElement>>(new Map());

const setChipRef = (key: string, el: HTMLButtonElement | null) => {
  if (!el) {
    chipRefs.value.delete(key);
    return;
  }
  chipRefs.value.set(key, el);
};

const centerSelected = async () => {
  await nextTick();
  const scroller = scrollerRef.value;
  if (!scroller) return;
  const key = props.selectedYear === null ? 'all' : String(props.selectedYear);
  const el = chipRefs.value.get(key);
  if (!el) return;

  const targetLeft =
    el.offsetLeft - (scroller.clientWidth - el.clientWidth) / 2;
  scroller.scrollTo({
    left: Math.max(0, targetLeft),
    behavior: 'smooth',
  });
};

const onSelect = (year: number | null) => {
  if (props.disabled) return;
  emit('select', year);
};

onMounted(() => {
  centerSelected();
});

watch(
  () => [props.selectedYear, props.years],
  () => {
    centerSelected();
  },
  { deep: true },
);
</script>

<template>
  <footer class="year-footer sticky bottom-0 pt-4 pb-3">
    <div class="ui-muted text-sm font-medium mb-2 text-center" :class="props.disabled ? 'opacity-60' : ''">
      {{ label }}
    </div>
    <div
      ref="scrollerRef"
      class="year-footer-scroll flex gap-2 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
      :class="props.disabled ? 'opacity-50' : ''"
    >
      <div class="shrink-0 w-[50vw]" aria-hidden="true"></div>
      <button
        :ref="(el) => setChipRef('all', el as HTMLButtonElement | null)"
        class="ui-button shrink-0 px-4 py-2 text-sm transition snap-center"
        :class="
          selectedYear === null
            ? 'ui-button--selected'
            : ''
        "
        :disabled="props.disabled"
        @click="onSelect(null)"
      >
        {{ allLabel }}
      </button>
      <button
        v-for="year in years"
        :key="year"
        :ref="(el) => setChipRef(String(year), el as HTMLButtonElement | null)"
        class="ui-button shrink-0 px-4 py-2 text-sm transition snap-center"
        :class="
          selectedYear === year
            ? 'ui-button--selected'
            : ''
        "
        :disabled="props.disabled"
        @click="onSelect(year)"
      >
        {{ year }}
      </button>
      <div class="shrink-0 w-[50vw]" aria-hidden="true"></div>
    </div>
  </footer>
</template>

<style scoped>
.year-footer {
  background-color: color-mix(in srgb, var(--color-canvas) 92%, transparent);
  border-top: 1px solid var(--color-border);
  backdrop-filter: blur(8px);
}

.year-footer-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.year-footer-scroll::-webkit-scrollbar {
  display: none;
}
</style>
