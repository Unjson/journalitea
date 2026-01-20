<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Record } from '../models/record';
import { getColorForRating } from '../models/colors';
import RadarPlot from '../components/RadarPlot.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import StarRating from '../components/StarRating.vue';

const route = useRoute();
const router = useRouter();

const electron = (window as any).require('electron');
const { ipcRenderer } = electron;

const record = ref<Record | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const currencyString = ref<string | null>(null);

const teaType = ref<string | null>(null);
const preparationMethod = ref<string | null>(null);
const showDeleteConfirm = ref(false);
const aromaOpen = ref(false);
const aromaPlotVersion = ref(0);

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
    currencyString.value = recordInstance.getPriceStringWithCurrency();
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
    await ipcRenderer.invoke('db:deleteRecord', record.value.id);
    router.replace('/');
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
          <div v-if="record.price"><span class="font-medium text-gray-700">Price:</span> {{ currencyString }}</div>
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
          <div v-if="record.color !== null && record.color !== undefined">
            <span class="font-medium text-gray-700">Color:</span>
            <span
              class="inline-block align-middle ml-2 w-24 h-8 rounded border border-gray-300"
              :style="{ backgroundColor: getColorForRating(record.color) }"
              aria-label="Tea color"
            ></span>
          </div>
        </div>
      </section>

      <!-- ITMC Scale Ratings -->
      <section class="mb-6">
        <details class="border rounded-lg" @toggle="handleAromaToggle">
          <summary class="flex items-center justify-between cursor-pointer select-none px-4 py-3">
            <span class="text-lg font-semibold">{{aromaOpen ? "Hide Plot" : "Show Plot"}}</span>
          </summary>
          <div class="px-4 pb-4">
            <RadarPlot
              v-if="aromaOpen"
              :key="aromaPlotVersion"
              :sweet="record.aroma_sweet"
              :floral="record.aroma_floral"
              :nutty="record.aroma_nutty"
              :spicy="record.aroma_spicy"
              :fire="record.aroma_fire"
              :fruity="record.aroma_fruity"
              :plants="record.aroma_plants"
              :earthy="record.aroma_earthy"
              :minerals="record.aroma_minerals"
              :marine="record.aroma_marine"
              :max-value="5"
            />
          </div>
        </details>
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
          <StarRating v-model="record.rating" :max="5" :disabled="true" aria-label="Overall Rating" />
        </div>
      </section>
      <!-- Edit Button -->
      <div class="mt-6 pt-6 gap-4 border-t flex items-center justify-between">
        <button
          @click="showDeleteConfirm = true"
          class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
        >
          Delete Record
        </button>
      <span class="flex-1"></span>
			<button 
		      	@click="$router.replace('/')" 
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

  <ConfirmDialog
    v-model="showDeleteConfirm"
    title="Delete record?"
    message="This action cannot be undone."
    confirm-text="Delete"
    cancel-text="Cancel"
    @confirm="deleteRecord"
  />
</template>
