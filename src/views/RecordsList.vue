<script lang="ts" setup>
import { computed, ref, onActivated, onMounted, onUnmounted, watch } from 'vue';
import { Record } from '../models/record';
import RecordCard from '../components/RecordCard.vue';
import RecordYearFooter from '../components/RecordYearFooter.vue';
import { useI18n } from 'vue-i18n';
import { platformBridge } from '../services/platformBridge';
const { t } = useI18n();
const records = ref<Record[]>([]);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref<string | null>(null);
const hasMoreRecords = ref(false);
const years = ref<number[]>([]);
const selectedYear = ref<number | null>(null);
const searchQuery = ref('');
const showScrollToTop = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const scrollToTopButtonOffset = ref('96px');

const RECORDS_PAGE_SIZE = 50;
const SCROLL_TO_TOP_THRESHOLD = 320;
const SEARCH_DEBOUNCE_MS = 250;
let scrollTarget: Window | HTMLElement = window;
let latestLoadRequestId = 0;

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase());
const hasActiveSearch = computed(() => normalizedSearchQuery.value.length > 0);

const buildRecordPageQuery = (offset: number) => ({
  year: hasActiveSearch.value ? null : selectedYear.value,
  search: normalizedSearchQuery.value || null,
  limit: RECORDS_PAGE_SIZE + 1,
  offset,
});

const loadRecords = async ({ reset = false } = {}) => {
  const requestId = ++latestLoadRequestId;

  if (reset) {
    loading.value = true;
    loadingMore.value = false;
    hasMoreRecords.value = false;
    records.value = [];
  } else {
    if (loading.value || loadingMore.value || !hasMoreRecords.value) {
      return;
    }
    loadingMore.value = true;
  }

  error.value = null;

  try {
    const page = (await platformBridge.invoke(
      'db:listRecordsPage',
      buildRecordPageQuery(reset ? 0 : records.value.length),
    )) as Record[];

    if (requestId !== latestLoadRequestId) {
      return;
    }

    hasMoreRecords.value = page.length > RECORDS_PAGE_SIZE;
    const nextRecords = hasMoreRecords.value ? page.slice(0, RECORDS_PAGE_SIZE) : page;
    records.value = reset ? nextRecords : records.value.concat(nextRecords);
  } catch (err) {
    if (requestId !== latestLoadRequestId) {
      return;
    }

    if (reset) {
      hasMoreRecords.value = false;
      records.value = [];
    }
    error.value = err instanceof Error ? err.message : 'Failed to load records';
    console.error('Error loading records:', err);
  } finally {
    if (requestId === latestLoadRequestId) {
      if (reset) {
        loading.value = false;
      } else {
        loadingMore.value = false;
      }
    }
  }
};

const resetAndLoadRecords = async () => {
  await loadRecords({ reset: true });
};

const loadMoreRecords = async () => {
  await loadRecords();
};

const loadYears = async () => {
  try {
    years.value = await platformBridge.invoke('db:listRecordYears');
    if (selectedYear.value === null && years.value.length > 0) {
      const currentYear = new Date().getFullYear();
      if (years.value.includes(currentYear)) {
        selectedYear.value = currentYear;
      }
    }
  } catch (err) {
    console.error('Error loading record years:', err);
  }
};

const selectYear = async (year: number | null) => {
  if (selectedYear.value === year) return;
  selectedYear.value = year;
  await resetAndLoadRecords();
};

const refreshRecordsList = async () => {
  await loadYears();
  await resetAndLoadRecords();
};

const updateScrollToTopVisibility = () => {
  const scrollTop = scrollTarget instanceof Window ? scrollTarget.scrollY : scrollTarget.scrollTop;
  showScrollToTop.value = scrollTop > SCROLL_TO_TOP_THRESHOLD;
};

const scrollToTop = () => {
  scrollTarget.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
};

const updateScrollToTopButtonOffset = () => {
  const header = document.querySelector<HTMLElement>('.app-header');
  const headerBottom = header?.getBoundingClientRect().bottom ?? 84;
  scrollToTopButtonOffset.value = `${Math.ceil(headerBottom + 12)}px`;
};

onMounted(async () => {
  scrollTarget = rootRef.value?.closest('.main-content') as HTMLElement | null ?? window;
  updateScrollToTopButtonOffset();
  updateScrollToTopVisibility();
  scrollTarget.addEventListener('scroll', updateScrollToTopVisibility, { passive: true });
  window.addEventListener('resize', updateScrollToTopButtonOffset, { passive: true });
  await refreshRecordsList();
  updateScrollToTopButtonOffset();
  updateScrollToTopVisibility();
});

watch(normalizedSearchQuery, (_, __, onCleanup) => {
  const debounceTimeout = window.setTimeout(() => {
    void resetAndLoadRecords();
  }, SEARCH_DEBOUNCE_MS);

  onCleanup(() => {
    window.clearTimeout(debounceTimeout);
  });
});

onActivated(() => {
  updateScrollToTopButtonOffset();
  updateScrollToTopVisibility();
  void refreshRecordsList();
});

onUnmounted(() => {
  scrollTarget.removeEventListener('scroll', updateScrollToTopVisibility);
  window.removeEventListener('resize', updateScrollToTopButtonOffset);
});
</script>

<template>
  <div ref="rootRef" class="min-h-screen flex flex-col p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">{{ t('list.title') }}</h1>
      <button 
        @click="$router.push({ name: 'record-new' })" 
        class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        {{ t('list.create_button') }}
      </button>
    </div>

    <div class="mb-6">
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="t('list.search_placeholder')"
        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-500">
      {{ t('list.loading') }}
    </div>

    <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      Error: {{ error }}
    </div>

    <div v-else-if="records.length === 0" class="text-center py-8 text-gray-500">
      {{ t('list.no_records') }}
    </div>

    <button
      type="button"
      :aria-label="t('list.scroll_to_top')"
      :title="t('list.scroll_to_top')"
      class="fixed right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
      :class="showScrollToTop ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'"
      :style="{ top: scrollToTopButtonOffset }"
      @click="scrollToTop"
    >
      <svg
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>

    <div class="flex-1">
      <RecordCard class="my-3" 
          v-for="record in records" 
          :key="record.id"
          :record="record"
        />

      <div v-if="records.length > 0" class="flex flex-col items-center gap-3 py-6">
        <button
          v-if="hasMoreRecords"
          type="button"
          class="rounded-full border border-blue-200 bg-white/90 px-5 py-2 text-sm font-medium text-blue-600 shadow-sm transition hover:border-blue-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loadingMore"
          @click="loadMoreRecords"
        >
          {{ loadingMore ? t('list.loading_more') : t('list.load_more') }}
        </button>

        <p v-else class="text-center text-sm text-gray-500/60">
          {{ t('list.end_of_list') }}
        </p>
      </div>
    </div>

    <RecordYearFooter
      :years="years"
      :selected-year="selectedYear"
      :label="t('list.filter_year_label')"
      :all-label="t('list.filter_year_all')"
      :disabled="hasActiveSearch"
      @select="selectYear"
    />
  </div>
</template>