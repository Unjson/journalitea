<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { Language, CurrencyType, WeightUnit, languageLabels, currencyLabels, weightUnitLabels, getLocaleFromLanguage, setCustomCurrency } from '../models/enums';
import { lookUpExchangeRates } from '../models/teaStats';
import { useI18n } from 'vue-i18n';
import { PREFS } from '../appSettings.js';
import SelectDropdown from '../components/SelectDropdown.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';

const electron = (window as any).require('electron');
const { ipcRenderer } = electron;
const { t, locale } = useI18n();
const languageSetting = ref<Language>(Language.ENGLISH);
const preferredCurrency = ref<CurrencyType>(CurrencyType.USD);
const preferredWeightUnit = ref<WeightUnit>(WeightUnit.METRIC_GRAM);
const customCurrency = ref<{ symbol: string; rate: number }>({ symbol: '', rate: 1.0 });
const showImportConfirm = ref(false);
const pendingImportPath = ref<string | null>(null);

const onCurrencyChanged = async () => {
  try {
	await ipcRenderer.invoke('db:setSetting', PREFS.CURRENCY, preferredCurrency.value);
	const exchangeRates = await lookUpExchangeRates(preferredCurrency.value);

	await ipcRenderer.invoke('db:setSetting', PREFS.EXCHANGE_RATES, -1, JSON.stringify(exchangeRates));
  } catch (err) {
	console.error('Error saving preferred currency:', err);
  }
};

const onCustomCurrencyChanged = async () => {
  try {
	const sanitizedRate = Number.isFinite(customCurrency.value.rate) ? customCurrency.value.rate : 1;
	const customCurrencyValue = setCustomCurrency(customCurrency.value.symbol.trim(), sanitizedRate);
	await ipcRenderer.invoke('db:setSetting', PREFS.CUSTOM_CURRENCY, -1, JSON.stringify(customCurrencyValue));
  } catch (err) {
	console.error('Error saving custom currency:', err);
  }
};

const onLanguageChanged = async () => {
  try {
	await ipcRenderer.invoke('db:setSetting', PREFS.LANGUAGE, languageSetting.value);
	locale.value = getLocaleFromLanguage(languageSetting.value);
  } catch (err) {
	console.error('Error saving language setting:', err);
  }
};

const onWeightUnitChanged = async () => {
  try {
	await ipcRenderer.invoke('db:setSetting', PREFS.WEIGHT_UNIT, preferredWeightUnit.value);
  } catch (err) {
	console.error('Error saving preferred weight unit:', err);
  }
};

const onExportDatabase = async () => {
	try {
		const result = await ipcRenderer.invoke('db:exportDatabase');
		if (result?.success) {
			window.alert(t('settings.database_export_success'));
		}
	} catch (err) {
	console.error('Error exporting database:', err);
	}
};

const onImportDatabase = async () => {
	try {
		const result = await ipcRenderer.invoke('db:pickDatabaseFile');
		if (result?.path) {
			pendingImportPath.value = result.path;
			showImportConfirm.value = true;
		}
	} catch (err) {
	console.error('Error importing database:', err);
	}
};

const appendImport = async () => {
	try {
		if (!pendingImportPath.value) return;
		const result = await ipcRenderer.invoke('db:importDatabase', {
			mode: 'append',
			sourcePath: pendingImportPath.value,
		});
		if (result?.success) {
			window.alert(t('settings.database_import_success_append'));
		}
	} catch (err) {
		console.error('Error appending database:', err);
	} finally {
		pendingImportPath.value = null;
	}
};

const replaceImport = async () => {
	try {
		if (!pendingImportPath.value) return;
		const result = await ipcRenderer.invoke('db:importDatabase', {
			mode: 'replace',
			sourcePath: pendingImportPath.value,
		});
		if (result?.success) {
			window.alert(t('settings.database_import_success_replace'));
		}
	} catch (err) {
		console.error('Error replacing database:', err);
	} finally {
		pendingImportPath.value = null;
	}
};

const cancelImport = () => {
	pendingImportPath.value = null;
};

onMounted(async() => {
  try{
	const language = await ipcRenderer.invoke('db:getSetting', PREFS.LANGUAGE);
	if(language.intVal != -1){
		languageSetting.value = language.intVal;
	}
	const currency = await ipcRenderer.invoke('db:getSetting', PREFS.CURRENCY);
	if(currency.intVal != -1){
		preferredCurrency.value = currency.intVal;
	}
	const weightUnit = await ipcRenderer.invoke('db:getSetting', PREFS.WEIGHT_UNIT);
	if(weightUnit.intVal != -1){
		preferredWeightUnit.value = weightUnit.intVal;
	}
	const customCurrencySetting = await ipcRenderer.invoke('db:getSetting', PREFS.CUSTOM_CURRENCY);
	if(customCurrencySetting.strVal){
		try{
			const parsed = JSON.parse(customCurrencySetting.strVal);
			if(parsed?.symbol !== undefined){
				customCurrency.value.symbol = parsed.symbol;
			}
			if(parsed?.rate !== undefined){
				customCurrency.value.rate = parsed.rate;
			}
			setCustomCurrency(customCurrency.value.symbol, customCurrency.value.rate);
		} catch (err) {
			console.error('Error parsing custom currency setting:', err);
		}
	}
  } catch (err) {
	console.error('Error loading settings:', err);
  }
});

</script>

<template>
	<h1 class="text-3xl font-bold">Settings Page</h1>
	<div class="mt-6">
		<div class="mb-4">
			<label class="block text-gray-700 font-bold mb-2" for="language">
				{{ t('settings.language_title') }}
			</label>
			<SelectDropdown
				v-model="languageSetting"
				:options="languageLabels"
				:aria-label="t('settings.language_title')"
				@update:model-value="onLanguageChanged"
			/>
		</div>

		<div class="mb-4">
			<label class="block text-gray-700 font-bold mb-2" for="currency">
				{{ t('settings.currency_title') }}
			</label>
			<SelectDropdown
				v-model="preferredCurrency"
				:options="currencyLabels"
				:aria-label="t('settings.currency_title')"
				@update:model-value="onCurrencyChanged"
			/>
		</div>

		<div v-if="preferredCurrency === CurrencyType.OTHER" class="mb-2 flex flex-row gap-4">
			<div class="mb-3 flex-1">
				<label class="block text-gray-700 font-regular mb-1" for="customCurrencySymbol">
					{{ t('settings.custom_currency_symbol') }}
				</label>
				<input
					id="customCurrencySymbol"
					v-model="customCurrency.symbol"
					class="w-full h-8 rounded border border-gray-300 px-3 py-2"
					type="text"
					:placeholder="t('settings.custom_currency_symbol')"
					@input="onCustomCurrencyChanged"
				/>
			</div>
			<div class="flex-1">
				<label class="block text-gray-700 font-regular mb-1" for="customCurrencyRate">
					{{ t('settings.custom_currency_rate') }}
				</label>
				<input
					id="customCurrencyRate"
					v-model.number="customCurrency.rate"
					class="w-full h-8 rounded border border-gray-300 px-3 py-2"
					type="number"
					step="0.0001"
					min="0"
					:placeholder="t('settings.custom_currency_rate')"
					@input="onCustomCurrencyChanged"
				/>
			</div>
		</div>

		<div class="mb-4">
			<label class="block text-gray-700 font-bold mb-2" for="currency">
				{{ t('settings.weightunit_title') }}
			</label>
			<SelectDropdown
				v-model="preferredWeightUnit"
				:options="weightUnitLabels"
				:aria-label="t('settings.weightunit_title')"
				@update:model-value="onWeightUnitChanged"
			/>
		</div>

		<div class="mt-6">
			<h2 class="text-xl font-bold mb-3">{{ t('settings.database_title') }}</h2>
			<div class="flex flex-col gap-3 sm:flex-row">
				<button
					class="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
					@click="onExportDatabase"
				>
					{{ t('settings.database_export') }}
				</button>
				<button
					class="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
					@click="onImportDatabase"
				>
					{{ t('settings.database_import') }}
				</button>
			</div>
		</div>

	</div>

	<ConfirmDialog
		v-model="showImportConfirm"
		:title="t('settings.database_import_prompt_title')"
		:message="t('settings.database_import_prompt_message')"
		:confirm-text="t('settings.database_import_replace')"
		:secondary-text="t('settings.database_import_append')"
		@cancel="cancelImport"
		@confirm="replaceImport"
		@secondary="appendImport"

	/>
</template>
