<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Record } from '../models/record';

interface Props {
  record: Record;
}

const props = defineProps<Props>();
const router = useRouter();
const teaType = ref<string | null>(null);

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
          <div><span class="font-medium">Type:</span> {{ teaType }}</div>
          <div v-if="record.subtype"><span class="font-medium">Subtype:</span> {{ record.subtype }}</div>
          <div v-if="record.origin"><span class="font-medium">Origin:</span> {{ record.origin }}</div>
          <div v-if="record.year"><span class="font-medium">Year:</span> {{ record.year }}</div>
          <div v-if="record.seller"><span class="font-medium">Seller:</span> {{ record.seller }}</div>
          <div v-if="record.rating"><span class="font-medium">Rating:</span> {{ record.rating }}/5</div>
        </div>
        <div v-if="record.notes" class="mt-2 text-sm text-gray-700">
          <span class="font-medium">Notes:</span> {{ record.notes }}
        </div>
      </div>
      <div class="ml-4 text-xs text-gray-400">
        {{ new Date(record.dateAdded).toLocaleDateString() }}
      </div>
    </div>
  </div>
</template>
