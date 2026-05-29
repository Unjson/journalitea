<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Record, getRecordOriginCountry, getRecordSpecificOrigin } from '../models/record';
import { getColorForRating } from '../models/colors';
import RadarPlot from '../components/charts/RadarPlot.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import StarRating from '../components/StarRating.vue';
import ZoomablePhoto from '../components/ZoomablePhoto.vue';
import { useI18n } from 'vue-i18n';
import { aromaFieldLabels } from '../models/enums';
import { formatPriceString } from '../models/teaStats';
import { platformBridge } from '../services/platformBridge';
import { photoService } from '../services/photoService';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const record = ref<Record | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const currencyString = ref<string | null>(null);
const photoPreviewUrl = ref('');

const teaType = ref<string | null>(null);
const preparationMethod = ref<string | null>(null);
const showDeleteConfirm = ref(false);
const aromaOpen = ref(false);
const aromaPlotVersion = ref(0);
const originCountry = computed(() => record.value ? getRecordOriginCountry(record.value) : '');
const specificOrigin = computed(() => record.value ? getRecordSpecificOrigin(record.value) : '');

const aromaDataPoints = computed(() => {
  if (!record.value) return [];
  return aromaFieldLabels.map(field => ({
    key: field.key,
    value: Number((record.value as any)[field.key] ?? 0),
  }));
});

const loadRecord = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const id = Number(route.params.id);
    const data = await platformBridge.invoke('db:getRecordById', id);
    
    if (!data) {
      error.value = 'Record not found';
      return;
    }
    
    // Convert plain object to Record instance
    const recordInstance = Object.assign(new Record(), data);
    record.value = recordInstance;
    
    teaType.value = recordInstance.getTypeName();
    preparationMethod.value = t(recordInstance.getPreparationMethodName());
    currencyString.value =  formatPriceString(recordInstance.price, recordInstance.priceCurrency);
    photoPreviewUrl.value = recordInstance.photo.trim()
      ? await photoService.resolveUrl(recordInstance.photo)
      : '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load record';
    console.error('Error loading record:', err);
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.back();
};

const deleteRecord = async () => {
  if (!record.value) return;

  try {
    await platformBridge.invoke('db:deleteRecord', record.value.id);
    router.push('/');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete record';
    console.error('Error deleting record:', err);
  }
};

const handleAromaToggle = (event: Event) => {
  const isOpen = (event.target as HTMLDetailsElement).open;
  aromaOpen.value = isOpen;
  if (isOpen) {
    aromaPlotVersion.value += 1;
  }
};

onMounted(() => {
  loadRecord();
});
</script>

<template>
  <div class="px-0.5 py-4">
    <div v-if="loading" class="text-center py-8 text-gray-500">
      {{ t('detail.loading') }}
    </div>

    <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      {{ t('detail.error_prefix') }} {{ error }}
    </div>

    <div v-else-if="record" class="bg-white border rounded-lg shadow-lg p-6">
      <h1 class="text-3xl font-bold mb-6">{{ record.name }}</h1>

      <section v-if="photoPreviewUrl" class="mb-6">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">{{ t('edit.photo_label') }}</h2>
        <div class="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
          <ZoomablePhoto
            :src="photoPreviewUrl"
            :alt="record.name || t('edit.photo_label')"
            :aria-label="t('photo.open_viewer')"
            class="relative aspect-4/3 bg-gray-100"
            image-class="h-full w-full object-cover"
          >
            <div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-4 py-3 text-sm text-white">
              {{ record.name || t('edit.photo_label') }}
            </div>
          </ZoomablePhoto>
        </div>
      </section>

      <!-- Data Block -->
      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">{{ t('detail.details_title') }}</h2>
        <div class="grid grid-cols-2 gap-4">
          <div><span class="font-medium text-gray-700">{{ t('detail.type_label') }}</span> {{ teaType }}</div>
          <div v-if="record.subtype"><span class="font-medium text-gray-700">{{ t('detail.subtype_label') }}</span> {{ record.subtype }}</div>
          <div v-if="originCountry"><span class="font-medium text-gray-700">{{ t('detail.origin_country_label') }}</span> {{ originCountry }}</div>
          <div v-if="specificOrigin"><span class="font-medium text-gray-700">{{ t('detail.origin_detail_label') }}</span> {{ specificOrigin }}</div>
          <div v-if="record.year"><span class="font-medium text-gray-700">{{ t('detail.year_label') }}</span> {{ record.year }}</div>
          <div v-if="record.seller"><span class="font-medium text-gray-700">{{ t('detail.seller_label') }}</span> {{ record.seller }}</div>
          <div><span class="font-medium text-gray-700">{{ t('detail.date_added_label') }}</span> {{ new Date(record.dateAdded).toLocaleDateString() }}</div>
          <div v-if="record.price"><span class="font-medium text-gray-700">{{ t('detail.price_label') }}</span> {{ currencyString }}</div>
          <div v-if="record.weight"><span class="font-medium text-gray-700">{{ t('detail.weight_label') }}</span> {{ record.weight }}{{ record.weightUnit === 0 ? 'g' : 'oz' }}</div>
        </div>
      </section>

      <!-- Preparation -->
      <section v-if="record.preparationMethod || record.preparationNotes" class="mb-6">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">{{ t('detail.preparation_title') }}</h2>
        <div class="space-y-2">
          <div v-if="record.preparationMethod">
            <span class="font-medium text-gray-700">{{ t('detail.method_label') }}</span>
            <p class="text-gray-600">{{ preparationMethod }}</p>
          </div>
          <div v-if="record.preparationNotes">
            <span class="font-medium text-gray-700">{{ t('detail.notes_label') }}</span>
            <p class="text-gray-600">{{ record.preparationNotes }}</p>
          </div>
        </div>
      </section>

      <!-- Tasting Notes -->
      <section v-if="record.dryLeaves || record.wetLeaves || record.liquor" class="mb-6">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">{{ t('detail.tasting_notes_title') }}</h2>
        <div class="space-y-2">
          <div v-if="record.dryLeaves">
            <span class="font-medium text-gray-700">{{ t('detail.dry_leaves_label') }}</span>
            <p class="text-gray-600">{{ record.dryLeaves }}</p>
          </div>
          <div v-if="record.wetLeaves">
            <span class="font-medium text-gray-700">{{ t('detail.wet_leaves_label') }}</span>
            <p class="text-gray-600">{{ record.wetLeaves }}</p>
          </div>
          <div v-if="record.liquor">
            <span class="font-medium text-gray-700">{{ t('detail.liquor_label') }}</span>
            <p class="text-gray-600">{{ record.liquor }}</p>
          </div>
          <div v-if="record.color !== null && record.color !== undefined">
            <span class="font-medium text-gray-700">{{ t('detail.color_label') }}</span>
            <span
              class="inline-block align-middle ml-2 w-24 h-8 rounded border border-gray-300"
              :style="{ backgroundColor: getColorForRating(record.color) }"
              :aria-label="t('detail.color_aria')"
            ></span>
          </div>
        </div>
      </section>

      <!-- ITMC Scale Ratings -->
      <section class="mb-6">
        <details class="border rounded-lg" @toggle="handleAromaToggle">
          <summary class="flex items-center justify-between cursor-pointer select-none px-4 py-3">
            <span class="text-lg font-semibold">{{ aromaOpen ? t('detail.plot_hide') : t('detail.plot_show') }}</span>
          </summary>
          <div class="px-4 pb-4">
            <RadarPlot
              v-if="aromaOpen"
              :key="aromaPlotVersion"
              :data-points="aromaDataPoints"
              :max-value="5"
            />
          </div>
        </details>
      </section>

      <!-- Notes & Rating -->
      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">{{ t('detail.notes_rating_title') }}</h2>
        <div v-if="record.notes" class="mb-3">
          <span class="font-medium text-gray-700">{{ t('detail.notes_label') }}</span>
          <p class="text-gray-600 mt-1">{{ record.notes }}</p>
        </div>
        <div v-if="record.rating">
          <span class="font-medium text-gray-700">{{ t('detail.overall_rating_label') }}</span>
          <StarRating v-model="record.rating" :max="5" :disabled="true" :aria-label="t('detail.overall_rating_label')" />
        </div>
      </section>
      <!-- Edit Button -->
      <div class="mt-6 pt-6 gap-4 border-t flex items-center flex-wrap-reverse justify-between">
        <button
          @click="showDeleteConfirm = true"
          class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
        >
          {{ t('detail.delete_button') }}
        </button>
      <span class="flex-1"></span>
			<button 
		      	@click="$router.push('/')" 
		      	class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
	    	>
        	← {{ t('detail.back_button') }}
	    	</button>
          <button
	          	@click="$router.push({ name: 'record-edit', params: { id: record.id } })"
	          	class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
	          >
            {{ t('detail.edit_button') }}
          </button>
	  </div>
    </div>
  </div>

  <ConfirmDialog
    v-model="showDeleteConfirm"
    :title="t('detail.delete_confirm_title')"
    :message="t('detail.delete_confirm_message')"
    :confirm-text="t('detail.delete_confirm_confirm')"
    :cancel-text="t('detail.delete_confirm_cancel')"
    @confirm="deleteRecord"
  />
</template>
