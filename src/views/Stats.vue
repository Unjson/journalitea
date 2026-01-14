<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { CurrencyType, WeightUnit } from '../models/enums';
import { PREFS } from '../appSettings.js';

import { useI18n } from 'vue-i18n';

const electron = (window as any).require('electron');
const { ipcRenderer } = electron;
const { t, locale } = useI18n();

const statsData = ref(null);
const preferredCurrency = ref<CurrencyType>(CurrencyType.USD);
const preferredWeightUnit = ref<WeightUnit>(WeightUnit.METRIC_GRAM);


onMounted(async() => {

	const currency = await ipcRenderer.invoke('db:getSetting', PREFS.CURRENCY);
	if(currency.intVal != -1){
		preferredCurrency.value = currency.intVal;
	}
	const weightUnit = await ipcRenderer.invoke('db:getSetting', PREFS.WEIGHT_UNIT);
	if(weightUnit.intVal != -1){
		preferredWeightUnit.value = weightUnit.intVal;
	}

});

</script>

<template>
	<h1 class="text-3xl font-bold">Stats for Nerds</h1>
</template>