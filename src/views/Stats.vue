<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { CurrencyType, WeightUnit, TeaType } from '../models/enums';
import { PREFS } from '../appSettings.js';
import { getCumulativeStats } from '../models/teaStats';
import { useI18n } from 'vue-i18n';
import PieChart from '../components/PieChart.vue';

const electron = (window as any).require('electron');
const { ipcRenderer } = electron;
const { t, locale } = useI18n();

const preferredCurrency = ref<CurrencyType>(CurrencyType.USD);
const preferredWeightUnit = ref<WeightUnit>(WeightUnit.METRIC_GRAM);
const exchangeRates = ref<object>({});
const cumulativeStats = ref<any>(null);

const teaTypeNames: Record<number, string> = {
	[TeaType.GREEN]: 'Green Tea',
	[TeaType.BLACK]: 'Black Tea',
	[TeaType.OOLONG]: 'Oolong Tea',
	[TeaType.WHITE]: 'White Tea',
	[TeaType.DARK]: 'Dark Tea',
	[TeaType.YELLOW]: 'Yellow Tea',
	[TeaType.HERBAL]: 'Herbal Tea',
	[TeaType.OTHER]: 'Other'
};

const currencySymbols: Record<number, string> = {
	[CurrencyType.USD]: '$',
	[CurrencyType.EUR]: '€',
	[CurrencyType.GBP]: '£',
	[CurrencyType.CNY]: '¥',
	[CurrencyType.JPY]: '¥',
	[CurrencyType.INR]: '₹',
	[CurrencyType.TWD]: 'NT$',
	[CurrencyType.OTHER]: ''
};

const weightUnitNames: Record<number, string> = {
	[WeightUnit.METRIC_GRAM]: 'g',
	[WeightUnit.IMPERIAL_OUNCE]: 'oz'
};



onMounted(async() => {

	const currency = await ipcRenderer.invoke('db:getSetting', PREFS.CURRENCY);
	if(currency.intVal != -1){
		preferredCurrency.value = currency.intVal;
	}
	const weightUnit = await ipcRenderer.invoke('db:getSetting', PREFS.WEIGHT_UNIT);
	if(weightUnit.intVal != -1){
		preferredWeightUnit.value = weightUnit.intVal;
	}
	exchangeRates.value = await ipcRenderer.invoke('db:getSetting', PREFS.EXCHANGE_RATES).then((res: any) => res.strVal ? JSON.parse(res.strVal) : {});
	const records = await ipcRenderer.invoke('db:listRecords');
	cumulativeStats.value = getCumulativeStats(records, preferredCurrency.value, preferredWeightUnit.value, exchangeRates.value);

});

</script>

<template>
	<div class="p-6">
		<h1 class="text-3xl font-bold mb-6">Stats for Nerds</h1>

		<div v-if="cumulativeStats" class="space-y-8">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<h2 class="text-2xl font-semibold mb-4">Cumulative Statistics</h2>
				<div class="space-y-3">
					<div class="border-b pb-2">
						<span class="font-medium">Total Money Spent:</span>
						<div class="ml-4 mt-1 text-lg">
							{{ currencySymbols[preferredCurrency] }}{{ cumulativeStats.totalMoneySpent?.toFixed(2) ?? '0.00' }}
						</div>
					</div>

					<div class="border-b pb-2">
						<span class="font-medium">Total Weight of Tea:</span>
						<div class="ml-4 mt-1 text-lg">
							{{ cumulativeStats.totalWeight?.toFixed(2) ?? '0.00' }} {{ weightUnitNames[preferredWeightUnit] }}
						</div>
					</div>

					<div class="border-b pb-2">
						<span class="font-medium">Price per Weight:</span>
						<div class="ml-4 mt-1 text-lg">
							{{ currencySymbols[preferredCurrency] }}{{ cumulativeStats.pricePerWeight?.toFixed(4) ?? '0.0000' }} / {{ weightUnitNames[preferredWeightUnit] }}
						</div>
					</div>

					<div class="border-b pb-2">
						<span class="font-medium">Most Expensive Tea:</span>
						<div class="ml-4 mt-1">
							<div v-if="cumulativeStats.mostExpensiveTea" class="text-lg">
								{{ cumulativeStats.mostExpensiveTea.name }}
								<span class="text-sm text-gray-500">
									- {{ currencySymbols[cumulativeStats.mostExpensiveTea.priceCurrency] || '' }}{{ cumulativeStats.mostExpensiveTea.price?.toFixed(2) }}
								</span>
							</div>
							<div v-else class="text-gray-500">No data</div>
						</div>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<PieChart
					:teaCountByType="cumulativeStats.teaCountByType"
					:labelMap="teaTypeNames"
					title="Tea Collection by Type"
				/>
			</div>
		</div>

		<div v-else class="text-center py-12 text-gray-500">
			Loading statistics...
		</div>
	</div>
</template>