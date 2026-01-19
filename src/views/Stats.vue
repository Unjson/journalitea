<script lang="ts" setup>
import { ref, onMounted, onActivated } from 'vue';
import { CurrencyType, WeightUnit, getTeaTypeNames, getWeightUnitNames, getCurrencySymbols } from '../models/enums';
import { PREFS } from '../appSettings.js';
import { getCumulativeStats } from '../models/teaStats';
import { useI18n } from 'vue-i18n';
import PieChart from '../components/PieChart.vue';
import Histogram from '../components/Histogram.vue';
import { Record as TeaRecord } from '../models/record';

const electron = (window as any).require('electron');
const { ipcRenderer } = electron;
const { t, locale } = useI18n();

const preferredCurrency = ref<CurrencyType>(CurrencyType.USD);
const preferredWeightUnit = ref<WeightUnit>(WeightUnit.METRIC_GRAM);
const exchangeRates = ref<Record<CurrencyType, number> | null >(null);
const records = ref<TeaRecord[]>([]);
const cumulativeStats = ref<any>(null);
const currencySymbols = getCurrencySymbols();
const weightUnitNames = getWeightUnitNames();
const activeTab = ref<'summary' | 'histograms'>('summary');


const loadStats = async () => {
	const currency = await ipcRenderer.invoke('db:getSetting', PREFS.CURRENCY);
	if (currency.intVal != -1) {
		console.log('Setting preferred currency to', currency.intVal);
		preferredCurrency.value = currency.intVal;
	}
	const weightUnit = await ipcRenderer.invoke('db:getSetting', PREFS.WEIGHT_UNIT);
	if (weightUnit.intVal != -1) {
		preferredWeightUnit.value = weightUnit.intVal;
	}
	const resResult = await ipcRenderer	.invoke('db:getSetting', PREFS.EXCHANGE_RATES).strVal;
	exchangeRates.value = await ipcRenderer
		.invoke('db:getSetting', PREFS.EXCHANGE_RATES)
		.then((res: any) => (res.strVal ? JSON.parse(res.strVal) : {}));
	records.value = await ipcRenderer.invoke('db:listRecords');
	cumulativeStats.value = getCumulativeStats(
		records.value,
		preferredCurrency.value,
		preferredWeightUnit.value,
		exchangeRates.value
	);
};

onMounted(loadStats);
onActivated(loadStats);

</script>

<template>
	<div class="p-6">
		<h1 class="text-3xl font-bold mb-6">Stats for Nerds</h1>

		<div v-if="cumulativeStats" class="space-y-8">
			<div class="flex gap-2">
				<button
					class="px-4 py-2 rounded-lg border"
					:class="activeTab === 'summary' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800'"
					@click="activeTab = 'summary'"
				>
					Summary
				</button>
				<button
					class="px-4 py-2 rounded-lg border"
					:class="activeTab === 'histograms' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800'"
					@click="activeTab = 'histograms'"
				>
					Histograms
				</button>
			</div>

			<div v-if="activeTab === 'summary'" class="space-y-8">
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
						<span class="font-medium">Average price per Weight:</span>
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
						<span class="font-medium">Most Expensive Tea by weight:</span>
						<div class="ml-4 mt-1">
							<div v-if="cumulativeStats.mostExpensivePerWeightTea" class="text-lg">
								{{ cumulativeStats.mostExpensivePerWeightTea.name }}
								<span class="text-sm text-gray-500">
									- {{ currencySymbols[cumulativeStats.mostExpensivePerWeightTea.priceCurrency] || '' }}{{ (cumulativeStats.mostExpensivePerWeightTea.price / cumulativeStats.mostExpensivePerWeightTea.weight * (preferredWeightUnit === 0 ? 1 : preferredWeightUnit === 1 ? 1000 : 28.3495)).toFixed(2) }} / {{ weightUnitNames[preferredWeightUnit] }}
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
					:labelMap="getTeaTypeNames()"
					title="Tea Collection by Type"
				/>
			</div>
			</div>

			<div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<Histogram
					:records="records"
					:preferredCurrency="preferredCurrency"
					:preferredWeightUnit="preferredWeightUnit"
					:exchangeRates="exchangeRates"
					:bins="20"
				/>
			</div>
		</div>

		<div v-else class="text-center py-12 text-gray-500">
			Loading statistics...
		</div>
	</div>
</template>