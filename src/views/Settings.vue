<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { Language, CurrencyType, WeightUnit, getLocaleFromLanguage } from '../models/enums';
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
const languageOptions = [
	{ value: Language.ENGLISH, label: t('enum.language_english'), flagUrl: new URL('../img/flag-uk.svg', import.meta.url).toString() },
	{ value: Language.GERMAN, label: t('enum.language_german'), flagUrl: new URL('../img/flag-de.svg', import.meta.url).toString() },
];

const currencyOptions = [
	{ value: CurrencyType.USD, label: 'USD' },
	{ value: CurrencyType.EUR, label: 'EUR' },
	{ value: CurrencyType.GBP, label: 'GBP' },
	{ value: CurrencyType.JPY, label: 'JPY' },
	{ value: CurrencyType.CNY, label: 'CNY' },
	{ value: CurrencyType.INR, label: 'INR' },
	{ value: CurrencyType.HKD, label: 'HKD' },
	{ value: CurrencyType.OTHER, label: 'OTHER' },
];

const weightUnitOptions = [
	{ value: WeightUnit.METRIC_GRAM, label: t('enum.weightunit_metric_gram') },
	{ value: WeightUnit.IMPERIAL_OUNCE, label: t('enum.weightunit_imperial_ounce') },
];

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
	setOptionLabelsOnLanguageChanged();
  } catch (err) {
	console.error('Error saving language setting:', err);
  }
};

const setOptionLabelsOnLanguageChanged = () => {
  languageOptions[0].label = t('enum.language_english');
  languageOptions[1].label = t('enum.language_german');
  weightUnitOptions[0].label = t('enum.weightunit_metric_gram');
  weightUnitOptions[1].label = t('enum.weightunit_imperial_ounce');
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
				:options="languageOptions"
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
				:options="currencyOptions"
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
				:options="weightUnitOptions"
				:aria-label="t('settings.weightunit_title')"
				@update:model-value="onWeightUnitChanged"
			/>
		</div>

	</div>
</template>
