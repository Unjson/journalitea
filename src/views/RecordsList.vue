<script lang="ts" setup>
import { computed, ref, onActivated, onMounted } from 'vue';
import { Record } from '../models/record';
import RecordCard from '../components/RecordCard.vue';
import RecordYearFooter from '../components/RecordYearFooter.vue';
import { useI18n } from 'vue-i18n';
import { platformBridge } from '../services/platformBridge';
const { t } = useI18n();
const records = ref<Record[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const years = ref<number[]>([]);
const selectedYear = ref<number | null>(null);
const searchQuery = ref('');

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase());
const hasActiveSearch = computed(() => normalizedSearchQuery.value.length > 0);

const filteredRecords = computed(() => {
  const query = normalizedSearchQuery.value;

  return records.value.filter((record) => {
    if (!query && selectedYear.value !== null) {
      const recordYear = new Date(record.dateAdded).getFullYear();
      if (recordYear !== selectedYear.value) {
        return false;
      }
    }

    if (!query) {
      return true;
    }

    const searchableContent = [
      record.name,
      record.subtype,
      record.seller,
      record.origin,
      record.notes,
      String(record.year ?? ''),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();

    return searchableContent.includes(query);
  });
});

const loadRecords = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    records.value = await platformBridge.invoke('db:listRecords', null);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load records';
    console.error('Error loading records:', err);
  } finally {
    loading.value = false;
  }
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
};

const createRecord = async () =>{

}

onMounted(async () => {
  await loadYears();
  await loadRecords();
});

onActivated(loadRecords);
</script>

<template>
  <div class="min-h-screen flex flex-col p-6">
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

    <div v-else-if="filteredRecords.length === 0" class="text-center py-8 text-gray-500">
      {{ t('list.no_records') }}
    </div>

    <div class="flex-1">
      <RecordCard class="my-3" 
          v-for="record in filteredRecords" 
          :key="record.id"
          :record="record"
        />
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