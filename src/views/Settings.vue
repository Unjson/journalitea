<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { Language, CurrencyType, WeightUnit, languageLabels, currencyLabels, weightUnitLabels, getLocaleFromLanguage } from '../models/enums';
import { lookUpExchangeRates } from '../models/teaStats';
import { useI18n } from 'vue-i18n';
import { PREFS } from '../appSettings.js';
import SelectDropdown from '../components/SelectDropdown.vue';

const electron = (window as any).require('electron');
const { ipcRenderer } = electron;
const { t, locale } = useI18n();
const languageSetting = ref<Language>(Language.ENGLISH);
const preferredCurrency = ref<CurrencyType>(CurrencyType.USD);
const preferredWeightUnit = ref<WeightUnit>(WeightUnit.METRIC_GRAM);


const onCurrencyChanged = async () => {
  try {
	await ipcRenderer.invoke('db:setSetting', PREFS.CURRENCY, preferredCurrency.value);
	const exchangeRates = await lookUpExchangeRates(preferredCurrency.value);

	await ipcRenderer.invoke('db:setSetting', PREFS.EXCHANGE_RATES, -1, JSON.stringify(exchangeRates));
  } catch (err) {
	console.error('Error saving preferred currency:', err);
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

	</div>
</template>
