<script lang="ts" setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Record, getRecordOriginCountry, getRecordSpecificOrigin } from '../models/record';
import { useI18n } from 'vue-i18n';
import { photoService } from '../services/photoService';

interface Props {
  record: Record;
}

const props = defineProps<Props>();
const router = useRouter();
const teaType = ref<string | null>(null);
const photoPreviewUrl = ref('');
const { t } = useI18n();
const originCountry = computed(() => getRecordOriginCountry(props.record));
const specificOrigin = computed(() => getRecordSpecificOrigin(props.record));
let latestPhotoRequestId = 0;

const escapeCssUrl = (value: string): string => value.replace(/["\\)]/g, '\\$&');

const cardBackgroundStyle = computed(() => {
  if (!photoPreviewUrl.value) {
    return undefined;
  }

  return {
    backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.82) 52%, rgba(255,255,255,0.94) 100%), url("${escapeCssUrl(photoPreviewUrl.value)}")`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  };
});

const openDetail = () => {
  router.push({ name: 'record-detail', params: { id: props.record.id } });
};

const refreshPhotoPreview = async () => {
  const photoRaw = String(props.record.photo ?? '').trim();
  if (!photoRaw) {
    photoPreviewUrl.value = '';
    return;
  }

  const requestId = ++latestPhotoRequestId;
  try {
    const result = await photoService.resolveUrl(photoRaw);
    if (requestId !== latestPhotoRequestId) {
      return;
    }
    photoPreviewUrl.value = String(result ?? '');
  } catch (err) {
    if (requestId !== latestPhotoRequestId) {
      return;
    }
    photoPreviewUrl.value = '';
    console.error('Error resolving record card photo:', err);
  }
};

onMounted(() => {
	const recordInstance = Object.assign(new Record(), props.record);
  	teaType.value = recordInstance.getTypeName();
});

watch(
  () => props.record.photo,
  () => {
    void refreshPhotoPreview();
  },
  { immediate: true },
);

</script>

<template>
  <div 
    @click="openDetail"
    class="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
  >
    <div
      v-if="cardBackgroundStyle"
      class="absolute inset-0"
      :style="cardBackgroundStyle"
    ></div>
    <div class="relative flex justify-between items-start gap-4">
      <div class="flex-1">
        <h3 class="mb-2 text-xl font-semibold text-gray-900">{{ record.name }}</h3>
        <div class="grid grid-cols-2 gap-2 text-sm text-gray-700">
          <div><span class="font-medium">{{ t('record.type_label') }}</span> {{ teaType }}</div>
          <div v-if="record.subtype"><span class="font-medium">{{ t('record.subtype_label') }}</span> {{ record.subtype }}</div>
          <div v-if="originCountry"><span class="font-medium">{{ t('record.origin_country_label') }}</span> {{ originCountry }}</div>
          <div v-if="specificOrigin"><span class="font-medium">{{ t('record.origin_detail_label') }}</span> {{ specificOrigin }}</div>
          <div v-if="record.year"><span class="font-medium">{{ t('record.year_label') }}</span> {{ record.year }}</div>
          <div v-if="record.seller"><span class="font-medium">{{ t('record.seller_label') }}</span> {{ record.seller }}</div>
          <div v-if="record.rating"><span class="font-medium">{{ t('record.rating_label') }}</span> {{ record.rating }}/5</div>
        </div>
        <div v-if="record.notes" class="mt-2 text-sm text-gray-800">
          <span class="font-medium">{{ t('record.notes_label') }}</span> {{ record.notes }}
        </div>
      </div>
      <div class="ml-4 text-xs text-gray-500">
        {{ new Date(record.dateAdded).toLocaleDateString() }}
      </div>
    </div>
  </div>
</template>
