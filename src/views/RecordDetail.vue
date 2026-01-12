<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Record } from '../models/record';
import RadarPlot from '../components/RadarPlot.vue';

const route = useRoute();
const router = useRouter();

const electron = (window as any).require('electron');
const { ipcRenderer } = electron;

const record = ref<Record | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const photoUrl = ref<string | null>(null);

const teaType = ref<string | null>(null);
const preparationMethod = ref<string | null>(null);

const loadRecord = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const id = Number(route.params.id);
    const data = await ipcRenderer.invoke('db:getRecordById', id);
    
    if (!data) {
      error.value = 'Record not found';
      return;
    }
    
    // Convert plain object to Record instance
    const recordInstance = Object.assign(new Record(), data);
    record.value = recordInstance;
    
    teaType.value = recordInstance.getTypeName();
    preparationMethod.value = recordInstance.getPreparationMethodName();

    if (recordInstance.photo) {
      // Convert photo Blob to displayable URL
      photoUrl.value = await recordInstance.getPhotoUrl();
    }
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

onMounted(() => {
  loadRecord();
});
</script>

<template>
  <div class="p-6">
    <div v-if="loading" class="text-center py-8 text-gray-500">
      Loading record...
    </div>

    <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      Error: {{ error }}
    </div>

    <div v-else-if="record" class="bg-white border rounded-lg shadow-lg p-6">
      <h1 class="text-3xl font-bold mb-6">{{ record.name }}</h1>

      <!-- Data Block -->
      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">Details</h2>
        <div class="grid grid-cols-2 gap-4">
          <div><span class="font-medium text-gray-700">Type:</span> {{ teaType }}</div>
          <div v-if="record.subtype"><span class="font-medium text-gray-700">Subtype:</span> {{ record.subtype }}</div>
          <div v-if="record.origin"><span class="font-medium text-gray-700">Origin:</span> {{ record.origin }}</div>
          <div v-if="record.year"><span class="font-medium text-gray-700">Year:</span> {{ record.year }}</div>
          <div v-if="record.seller"><span class="font-medium text-gray-700">Seller:</span> {{ record.seller }}</div>
          <div><span class="font-medium text-gray-700">Date Added:</span> {{ new Date(record.dateAdded).toLocaleDateString() }}</div>
          <div v-if="record.price"><span class="font-medium text-gray-700">Price:</span> {{ record.price }} {{ record.currency }}</div>
          <div v-if="record.weight"><span class="font-medium text-gray-700">Weight:</span> {{ record.weight }}{{ record.weightUnit === 0 ? 'g' : 'oz' }}</div>
        </div>
      </section>

      <!-- Preparation -->
      <section v-if="record.preparationMethod || record.preparationNotes" class="mb-6">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">Preparation</h2>
        <div class="space-y-2">
          <div v-if="record.preparationMethod">
            <span class="font-medium text-gray-700">Method:</span>
            <p class="text-gray-600">{{ preparationMethod }}</p>
          </div>
          <div v-if="record.preparationNotes">
            <span class="font-medium text-gray-700">Notes:</span>
            <p class="text-gray-600">{{ record.preparationNotes }}</p>
          </div>
        </div>
      </section>

      <!-- Tasting Notes -->
      <section v-if="record.dryLeaves || record.wetLeaves || record.liquor" class="mb-6">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">Tasting Notes</h2>
        <div class="space-y-2">
          <div v-if="record.dryLeaves">
            <span class="font-medium text-gray-700">Dry Leaves:</span>
            <p class="text-gray-600">{{ record.dryLeaves }}</p>
          </div>
          <div v-if="record.wetLeaves">
            <span class="font-medium text-gray-700">Wet Leaves:</span>
            <p class="text-gray-600">{{ record.wetLeaves }}</p>
          </div>
          <div v-if="record.liquor">
            <span class="font-medium text-gray-700">Liquor:</span>
            <p class="text-gray-600">{{ record.liquor }}</p>
          </div>
          <div v-if="record.color">
            <span class="font-medium text-gray-700">Color:</span> {{ record.color }}
          </div>
        </div>
      </section>

      <!-- ITMC Scale Ratings -->
      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">Aroma Profile</h2>
        <RadarPlot
          :sweet="record.aroma_sweet"
          :floral="record.aroma_floral"
          :nutty="record.aroma_nutty"
          :spicy="record.aroma_spicy"
          :firey="record.aroma_fire"
          :fruity="record.aroma_fruity"
          :plants="record.aroma_plants"
          :earthy="record.aroma_earthy"
          :minerals="record.aroma_minerals"
          :marine="record.aroma_marine"
          :max-value="5"
        />
      </section>

      <!-- Notes & Rating -->
      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">Notes & Rating</h2>
        <div v-if="record.notes" class="mb-3">
          <span class="font-medium text-gray-700">Notes:</span>
          <p class="text-gray-600 mt-1">{{ record.notes }}</p>
        </div>
        <div v-if="record.rating">
          <span class="font-medium text-gray-700">Overall Rating:</span>
          <span class="text-2xl font-bold text-blue-600 ml-2">{{ record.rating }}/5</span>
        </div>
      </section>

      <!-- Photo -->
      <section v-if="record.photo">
        <h2 class="text-xl font-semibold mb-3 border-b pb-2">Photo</h2>
        <img :src="photoUrl" alt="Tea photo" class="max-w-md rounded-lg shadow-md" />
      </section>

      <!-- Edit Button -->
      <div class="gap-4 mt-6 pt-6 border-t flex justify-end">
		<button 
      		@click="$router.push('/records-list')" 
      		class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
    	>
      ← Back to Records List
	    </button>
        <button
        	@click="$router.push({ name: 'record-edit', params: { id: record.id } })"
        	class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
        >
          Edit Record
        </button>
	  </div>
    </div>
  </div>
</template>
