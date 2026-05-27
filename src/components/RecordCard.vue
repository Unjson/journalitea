<script lang="ts" setup>
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Record, getRecordOriginCountry, getRecordSpecificOrigin } from '../models/record';
import { useI18n } from 'vue-i18n';

interface Props {
  record: Record;
}

const props = defineProps<Props>();
const router = useRouter();
const teaType = ref<string | null>(null);
const { t } = useI18n();
const originCountry = computed(() => getRecordOriginCountry(props.record));
const specificOrigin = computed(() => getRecordSpecificOrigin(props.record));

const openDetail = () => {
  router.push({ name: 'record-detail', params: { id: props.record.id } });
};

onMounted(() => {
	const recordInstance = Object.assign(new Record(), props.record);
  	teaType.value = recordInstance.getTypeName();
});

</script>

<template>
  <div 
    @click="openDetail"
    class="bg-white border rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
  >
    <div class="flex justify-between items-start">
      <div class="flex-1">
        <h3 class="text-xl font-semibold mb-2">{{ record.name }}</h3>
        <div class="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <div><span class="font-medium">{{ t('record.type_label') }}</span> {{ teaType }}</div>
          <div v-if="record.subtype"><span class="font-medium">{{ t('record.subtype_label') }}</span> {{ record.subtype }}</div>
          <div v-if="originCountry"><span class="font-medium">{{ t('record.origin_country_label') }}</span> {{ originCountry }}</div>
          <div v-if="specificOrigin"><span class="font-medium">{{ t('record.origin_detail_label') }}</span> {{ specificOrigin }}</div>
          <div v-if="record.year"><span class="font-medium">{{ t('record.year_label') }}</span> {{ record.year }}</div>
          <div v-if="record.seller"><span class="font-medium">{{ t('record.seller_label') }}</span> {{ record.seller }}</div>
          <div v-if="record.rating"><span class="font-medium">{{ t('record.rating_label') }}</span> {{ record.rating }}/5</div>
        </div>
        <div v-if="record.notes" class="mt-2 text-sm text-gray-700">
          <span class="font-medium">{{ t('record.notes_label') }}</span> {{ record.notes }}
        </div>
      </div>
      <div class="ml-4 text-xs text-gray-400">
        {{ new Date(record.dateAdded).toLocaleDateString() }}
      </div>
    </div>
  </div>
</template>
