<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { Record } from '../models/record';
import { aromaFieldLabels, teaTypeLabels, currencyLabels, weightUnitLabels, preparationMethodLabels } from '../models/enums';
import { useI18n } from 'vue-i18n';
import ColorSlider from '../components/ColorSlider.vue';
import VerticalSlider from '../components/VerticalSlider.vue';
import StarRating from '../components/StarRating.vue';
import SelectDropdown from '../components/SelectDropdown.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { PREFS } from '../appSettings.js';
import { platformBridge } from '../services/platformBridge';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const record = ref<Record>(new Record());
const loading = ref(false);
const error = ref<string | null>(null);
const isNewRecord = ref(true);
const showCancelConfirm = ref(false);
const pendingNavigation = ref<string | null>(null);
const allowNavigation = ref(false);
const initialSnapshot = ref('');

const getSnapshot = () => JSON.stringify(record.value.convertToPlainObject());
const isDirty = computed(() => initialSnapshot.value !== '' && getSnapshot() !== initialSnapshot.value);

const loadRecord = async () => {
  const id = Number(route.params.id);

  // Check if we're creating a new record
  if (isNaN(id) || id === -1) {
    isNewRecord.value = true;
    record.value = new Record();
    await setDefaults();
    setInitialSnapshot();
    return;
  }
  
  // Load existing record
  loading.value = true;
  try {
    const data = await platformBridge.invoke('db:getRecordById', Number(id));
    if (data) {
      record.value = Object.assign(new Record(), data);
      isNewRecord.value = false;
      setInitialSnapshot();
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

const setDefaults = async () => {
  //poll settings db for preferred currency and weight unit
  try {
    const [currency, weightUnit] = await Promise.all([
      platformBridge.invoke('db:getSetting', PREFS.CURRENCY),
      platformBridge.invoke('db:getSetting', PREFS.WEIGHT_UNIT),
    ]);

    if (currency.intVal != -1) {
      record.value.priceCurrency = currency.intVal;
    }
    if (weightUnit.intVal != -1) {
      record.value.weightUnit = weightUnit.intVal;
    }
  } catch (err: any) {
    console.error('Error loading default settings:', err);
  }
};

const setInitialSnapshot = () => {
  initialSnapshot.value = getSnapshot();
};

const saveRecord = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    // Convert Record instance to plain object for IPC (removes methods, keeps data)
    const plainRecord = record.value.convertToPlainObject();
    
    if (isNewRecord.value || record.value.id === -1) {
      // Create new record
      const newId = await platformBridge.invoke('db:saveRecord', plainRecord);
      allowNavigation.value = true;
      router.push({ name: 'record-detail', params: { id: newId } });
    } else {
      // Update existing record
      await platformBridge.invoke('db:updateRecord', plainRecord);
      allowNavigation.value = true;
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
  if (!isDirty.value) {
    if (isNewRecord.value) {
      router.replace({ name: 'records-list' });
    } else {
      router.push({ name: 'record-detail', params: { id: record.value.id } });
    }
    return;
  }

  pendingNavigation.value = null;
  showCancelConfirm.value = true;
};

const confirmCancel = () => {
  showCancelConfirm.value = false;
  allowNavigation.value = true;

  if (pendingNavigation.value) {
    const target = pendingNavigation.value;
    pendingNavigation.value = null;
    router.push(target);
    return;
  }

  if (isNewRecord.value) {
    router.replace({ name: 'records-list' });
  } else {
    router.push({ name: 'record-detail', params: { id: record.value.id } });
  }
};

const cancelCancel = () => {
  showCancelConfirm.value = false;
  pendingNavigation.value = null;
};

onBeforeRouteLeave((to, from, next) => {
  if (allowNavigation.value) {
    allowNavigation.value = false;
    next();
    return;
  }

  if (!isDirty.value) {
    next();
    return;
  }

  pendingNavigation.value = to.fullPath;
  showCancelConfirm.value = true;
  next(false);
});

onMounted(() => {
  loadRecord();
});
</script>

<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-6">
      {{ isNewRecord ? t('create.title') : t('edit.title') }}
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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.name_label') }} *</label>
            <input
              v-model="record.name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.type_label') }}</label>
            <SelectDropdown
              v-model="record.type"
              :options="teaTypeLabels"
              :aria-label="t('edit.type_label')"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.subtype_label') }}</label>
            <input
              v-model="record.subtype"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.origin_label') }}</label>
            <input
              v-model="record.origin"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.year_label') }}</label>
            <input
              v-model.number="record.year"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.seller_label') }}</label>
            <input
              v-model="record.seller"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div></div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.price_label') }}</label>
            <div class="flex flex-row items-center gap-4">
            <input
              v-model.number="record.price"
              type="number"
              step="0.01"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <SelectDropdown
              v-model="record.priceCurrency"
              :options="currencyLabels"
              :aria-label="t('edit.price_label')"
            />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.weight_label') }}</label>
            <div class="flex flex-row items-center gap-4">
            <input
              v-model.number="record.weight"
              type="number"
              step="0.01"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <SelectDropdown
              v-model="record.weightUnit"
              :options="weightUnitLabels"
              :aria-label="t('edit.weight_label')"
            />
            </div>
        </div>
          <div>

          </div>
        </div>
      </section>

      <!-- Preparation -->
      <section>
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">{{ t('edit.preparation_label') }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.preparation_method_label') }}</label>
            <div
              class="inline-flex flex-nowrap gap-2 overflow-x-auto"
              role="group"
              :aria-label="t('edit.preparation_method_label')"
            >
              <button
                v-for="option in preparationMethodLabels"
                :key="option.value"
                type="button"
                class="px-3 flex items-center py-2 rounded-lg border text-sm transition-colors whitespace-nowrap"
                :class="
                  record.preparationMethod === option.value
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                "
                @click="record.preparationMethod = option.value"
              >
                {{ t(option.label) }}
              </button>
            </div>
          </div>
          
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.preparation_notes_label') }}</label>
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
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.dry_leaves_label') }}</label>
            <textarea
              v-model="record.dryLeaves"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.wet_leaves_label') }}</label>
            <textarea
              v-model="record.wetLeaves"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.liquor_label') }}</label>
            <textarea
              v-model="record.liquor"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.color_label') }}</label>
            <ColorSlider v-model="record.color" />
          </div>
        </div>
      </section>

      <!-- Aroma Profile (ITMC Scale) -->
      <section>
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">{{ t('edit.aromas_label') }}</h2>
        <div class="grid grid-cols-5 gap-8 p-4">
          <div
            v-for="field in aromaFieldLabels"
            :key="field.key"
          >
            <VerticalSlider
              :label="t(field.label)"
              :model-value="record[field.key]"
              :min="0"
              :max="5"
              :step="1"
              @update:model-value="(value) => (record[field.key] = value)"
            />
          </div>
        </div>
      </section>

      <!-- Notes & Rating -->
      <section>
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">{{ t('edit.notes_rating_title')}}</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.notes_label') }}</label>
            <textarea
              v-model="record.notes"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('edit.rating_label') }}</label><StarRating v-model="record.rating" :max="5" />
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
          {{ t('edit.cancel_button') }}
        </button>
        <button
          type="submit"
          :disabled="loading"
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Saving...' : (isNewRecord ? t('edit.create_button') : t('edit.update_button')) }}
        </button>
      </div>
    </form>
  </div>

  <ConfirmDialog
    v-model="showCancelConfirm"
    :title="t('edit.cancel_confirm_title')"
    :message="t('edit.cancel_confirm_message')"
    :confirm-text="t('edit.cancel_confirm_confirm')"
    :cancel-text="t('edit.cancel_confirm_cancel')"
    @confirm="confirmCancel"
    @cancel="cancelCancel"
  />
</template>
