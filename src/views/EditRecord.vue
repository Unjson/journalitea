<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Record } from '../models/record';

const route = useRoute();
const router = useRouter();

const electron = (window as any).require('electron');
const { ipcRenderer } = electron;

const record = ref<Record>(new Record());
const loading = ref(false);
const error = ref<string | null>(null);
const isNewRecord = ref(true);

const loadRecord = async () => {
  const id = route.params.id;
  
  // Check if we're creating a new record
  if (id === 'new') {
    isNewRecord.value = true;
    record.value = new Record();
    return;
  }
  
  // Load existing record
  loading.value = true;
  try {
    const data = await ipcRenderer.invoke('db:getRecordById', Number(id));
    if (data) {
      record.value = Object.assign(new Record(), data);
      isNewRecord.value = false;
    } else {
      error.value = 'Record not found';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load record';
    console.error('Error loading record:', err);
  } finally {
    loading.value = false;
  }
};

const saveRecord = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    // Convert Record instance to plain object for IPC (removes methods, keeps data)
    const plainRecord = record.value.convertToPlainObject();
    
    if (isNewRecord.value || record.value.id === -1) {
      // Create new record
      const newId = await ipcRenderer.invoke('db:saveRecord', plainRecord);
      console.log('Created new record with ID:', newId);
      router.push({ name: 'record-detail', params: { id: newId } });
    } else {
      // Update existing record
      await ipcRenderer.invoke('db:updateRecord', plainRecord);
      console.log('Updated record:', record.value.id);
      router.push({ name: 'record-detail', params: { id: record.value.id } });
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save record';
    console.error('Error saving record:', err);
  } finally {
    loading.value = false;
  }
};

const cancel = () => {
  if (isNewRecord.value) {
    router.replace({ name: 'records-list' });
  } else {
    router.push({ name: 'record-detail', params: { id: record.value.id } });
  }
};

onMounted(() => {
  loadRecord();
});
</script>

<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-6">
      {{ isNewRecord ? 'New Record' : 'Edit Record' }}
    </h1>

    <div v-if="loading && !isNewRecord" class="text-center py-8 text-gray-500">
      Loading record...
    </div>

    <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      Error: {{ error }}
    </div>

    <form @submit.prevent="saveRecord" class="bg-white border rounded-lg shadow-lg p-6 space-y-6">
      <!-- Basic Information -->
      <section>
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">Basic Information</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              v-model="record.name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              v-model.number="record.type"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option :value="0">Green</option>
              <option :value="1">Black</option>
              <option :value="2">Oolong</option>
              <option :value="3">White</option>
              <option :value="4">Dark</option>
              <option :value="5">Yellow</option>
              <option :value="7">Herbal</option>
              <option :value="8">Other</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Subtype</label>
            <input
              v-model="record.subtype"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Origin</label>
            <input
              v-model="record.origin"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              v-model.number="record.year"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Seller</label>
            <input
              v-model="record.seller"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div></div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Price</label>
            <div class="flex flex-row items-center gap-4">
            <input
              v-model.number="record.price"
              type="number"
              step="0.01"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              v-model.number="record.price_currency"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option :value="0">USD</option>
              <option :value="1">EUR</option>
              <option :value="2">GBP</option>
              <option :value="3">CNY</option>
              <option :value="4">JPY</option>
              <option :value="5">INR</option>
              <option :value="6">TWD</option>
              <option :value="7">Other</option>
            </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Weight</label>
            <div class="flex flex-row items-center gap-4">
            <input
              v-model.number="record.weight"
              type="number"
              step="0.01"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              v-model.number="record.weightUnit"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option :value="0">Grams (g)</option>
              <option :value="1">Ounces (oz)</option>
            </select>
            </div>
        </div>
          <div>

          </div>
        </div>
      </section>

      <!-- Preparation -->
      <section>
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">Preparation</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select
              v-model.number="record.preparationMethod"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option :value="0">Western</option>
              <option :value="1">Gaiwan</option>
              <option :value="2">Clay</option>
              <option :value="3">Teabag</option>
              <option :value="4">Cold Brew</option>
              <option :value="5">Other</option>
            </select>
          </div>
          
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Preparation Notes</label>
            <textarea
              v-model="record.preparationNotes"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Tasting Notes -->
      <section>
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">Tasting Notes</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Dry Leaves</label>
            <textarea
              v-model="record.dryLeaves"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Wet Leaves</label>
            <textarea
              v-model="record.wetLeaves"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Liquor</label>
            <textarea
              v-model="record.liquor"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <input
              v-model.number="record.color"
              type="number"
              step="0.01"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      <!-- Aroma Profile (ITMC Scale) -->
      <section>
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">Aroma Profile (0-5)</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Sweet</label>
            <input
              v-model.number="record.aroma_sweet"
              type="range"
              min="0"
              max="5"
              step="1"
              class="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Floral</label>
            <input
              v-model.number="record.aroma_floral"
              type="range"
              min="0"
              max="5"
              step="1"
              class="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nutty</label>
            <input
              v-model.number="record.aroma_nutty"
              type="range"
              min="0"
              max="5"
              step="1"
              class="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Spicy</label>
            <input
              v-model.number="record.aroma_spicy"
              type="range"
              min="0"
              max="5"
              step="1"
              class="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Fire / Animal</label>
            <input
              v-model.number="record.aroma_fire"
              type="range"
              min="0"
              max="5"
              step="1"
              class="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Fruity</label>
            <input
              v-model.number="record.aroma_fruity"
              type="range"
              min="0"
              max="5"
              step="1"
              class="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Plants</label>
            <input
              v-model.number="record.aroma_plants"
              type="range"
              min="0"
              max="5"
              step="1"
              class="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Earthy</label>
            <input
              v-model.number="record.aroma_earthy"
              type="range"
              min="0"
              max="5"
              step="1"
              class="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Minerals</label>
            <input
              v-model.number="record.aroma_minerals"
              type="range"
              min="0"
              max="5"
              step="1"
              class="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Marine</label>
            <input
              v-model.number="record.aroma_marine"
              type="range"
              min="0"
              max="5"
              step="1"
              class="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      <!-- Notes & Rating -->
      <section>
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">Notes & Rating</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              v-model="record.notes"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Overall Rating (0-5)</label>
            <input
              v-model.number="record.rating"
              type="number"
              min="0"
              max="5"
              step="1"
              class="w-full p-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      <!-- Form Actions -->
      <div class="flex justify-end gap-4 pt-6 border-t">
        <button
          type="button"
          @click="cancel"
          class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="loading"
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Saving...' : 'Save Record' }}
        </button>
      </div>
    </form>
  </div>
</template>
