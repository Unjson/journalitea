<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { Language, CurrencyType } from '../models/enums';
const electron = (window as any).require('electron');
const { ipcRenderer } = electron;

const languageSetting = ref<Language>(Language.ENGLISH);
const preferredCurrency = ref<CurrencyType>(CurrencyType.USD);

const onCurrencyChanged = async () => {
  try {
	await ipcRenderer.invoke('db:setSetting', 'main_currency', preferredCurrency.value);
  } catch (err) {
	console.error('Error saving preferred currency:', err);
  }
};

const onLanguageChanged = async () => {
  try {
	await ipcRenderer.invoke('db:setSetting', 'language', languageSetting.value);
  } catch (err) {
	console.error('Error saving language setting:', err);
  }
};

onMounted(async() => {
  try{
	const language = await ipcRenderer.invoke('db:getSetting', 'language');
	if(language.intVal != -1){
		languageSetting.value = language.intVal;
	}
	const currency = await ipcRenderer.invoke('db:getSetting', 'main_currency');
	if(currency.intVal != -1){
		preferredCurrency.value = currency.intVal;
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
				Language
			</label>
			<select v-model="languageSetting" @change="onLanguageChanged" id="language" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
				<option :value="Language.ENGLISH">English</option>
				<option :value="Language.GERMAN">German</option>
			</select>
		</div>

		<div class="mb-4">
			<label class="block text-gray-700 font-bold mb-2" for="currency">
				Preferred Currency
			</label>
			<select v-model="preferredCurrency" @change="onCurrencyChanged" id="currency" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
				<option :value="CurrencyType.USD">USD</option>
				<option :value="CurrencyType.EUR">EUR</option>
				<option :value="CurrencyType.GBP">GBP</option>
				<option :value="CurrencyType.JPY">JPY</option>
				<option :value="CurrencyType.CNY">CNY</option>
				<option :value="CurrencyType.INR">INR</option>
				<option :value="CurrencyType.TWD">TWD</option>
				<option :value="CurrencyType.OTHER">OTHER</option>
			</select>
		</div>
	</div>
</template>