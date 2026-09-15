<script lang="ts" setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Record, getRecordOriginCountry, getRecordOriginSummary, getRecordSpecificOrigin } from '../models/record';
import { useI18n } from 'vue-i18n';
import { photoService } from '../services/photoService';
import { DEFAULT_PREFS, PREFS } from '../appSettings';
import { platformBridge } from '../services/platformBridge';

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
const originSummary = computed(() => getRecordOriginSummary(props.record));
const showOriginCountry = ref(DEFAULT_PREFS.ORIGIN_COUNTRY_DISPLAY);
let latestPhotoRequestId = 0;

const escapeCssUrl = (value: string): string => value.replace(/["\\)]/g, '\\$&');

const cardBackgroundStyle = computed(() => {
  if (!photoPreviewUrl.value) {
    return undefined;
  }

  return {
    backgroundImage: `url("${escapeCssUrl(photoPreviewUrl.value)}")`,
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

onMounted(async () => {
	const recordInstance = Object.assign(new Record(), props.record);
  	teaType.value = recordInstance.getTypeName();
  try {
    const setting = await platformBridge.invoke('db:getSetting', PREFS.ORIGIN_COUNTRY_DISPLAY);
    if (setting.intVal !== -1) {
      showOriginCountry.value = setting.intVal === 1;
    }
  } catch (err) {
    console.error('Error loading origin country display setting:', err);
  }
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
    class="record-card relative overflow-hidden p-4 cursor-pointer"
    :class="{ 'record-card--with-photo': cardBackgroundStyle }"
  >
    <div
      v-if="cardBackgroundStyle"
      class="card-photo absolute inset-0"
      :style="cardBackgroundStyle"
    ></div>
    <div class="relative flex justify-between items-start gap-4">
      <div class="flex-1">
        <h3 class="mb-2 text-xl font-semibold">{{ record.name }}</h3>
        <div class="grid grid-cols-2 gap-2 text-sm record-details">
          <div><span class="font-medium">{{ t('record.type_label') }}</span> {{ teaType }}</div>
          <div v-if="record.subtype"><span class="font-medium">{{ t('record.subtype_label') }}</span> {{ record.subtype }}</div>
          <template v-if="showOriginCountry">
            <div v-if="originCountry"><span class="font-medium">{{ t('record.origin_country_label') }}</span> {{ originCountry }}</div>
            <div v-if="specificOrigin"><span class="font-medium">{{ t('record.origin_detail_label') }}</span> {{ specificOrigin }}</div>
          </template>
          <div v-else-if="originSummary"><span class="font-medium">{{ t('record.origin_detail_label') }}</span> {{ originSummary }}</div>
          <div v-if="record.year"><span class="font-medium">{{ t('record.year_label') }}</span> {{ record.year }}</div>
          <div v-if="record.seller"><span class="font-medium">{{ t('record.seller_label') }}</span> {{ record.seller }}</div>
          <div v-if="record.rating"><span class="font-medium">{{ t('record.rating_label') }}</span> {{ record.rating }}/5</div>
        </div>
        <div v-if="record.notes" class="mt-2 text-sm">
          <span class="font-medium">{{ t('record.notes_label') }}</span> {{ record.notes }}
        </div>
      </div>
      <div class="ml-4 text-xs record-date">
        {{ new Date(record.dateAdded).toLocaleDateString() }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.record-card {
  background-color: var(--color-record-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-surface);
  box-shadow: var(--shadow-surface);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.record-card:hover {
  background-color: var(--color-record-card-hover);
  border-color: var(--color-border-strong);
}

.card-photo {
  opacity: 0.1;
}

.record-details {
  color: var(--color-ink-muted);
}

.record-date {
  color: var(--color-ink-muted);
}
</style>
