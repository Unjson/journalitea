<script lang="ts" setup>
import { ref, onMounted, onActivated, computed } from 'vue';
import { CurrencyType, WeightUnit, teaTypeLabels, weightUnitLabels, currencyLabels, currencySymbols, weightUnitSymbols } from '../models/enums';
import { PREFS } from '../appSettings.js';
import { getCumulativeStats, formatPriceString, convertToPricePerDesiredUnit} from '../models/teaStats';
import { useI18n } from 'vue-i18n';
import PieChart from '../components/charts/PieChart.vue';
import BarChart from '../components/charts/BarChart.vue';
import AromaStats from '../components/AromaStats.vue';
import { Record as TeaRecord } from '../models/record';
import { platformBridge } from '../services/platformBridge';
const { t } = useI18n();

const preferredCurrency = ref<CurrencyType>(CurrencyType.USD);
const preferredWeightUnit = ref<WeightUnit>(WeightUnit.METRIC_GRAM);
const exchangeRates = ref<Record<CurrencyType, number> | null >(null);
const records = ref<TeaRecord[]>([]);
const cumulativeStats = ref<any>(null);
const activeTab = ref<'summary' | 'histograms' | 'aromas'>('summary');

const ratingCounts = computed(() => {
	const counts = Array.from({ length: 6 }, () => 0);
	for (const record of records.value) {
		const rating = Number(record.rating);
		if (!Number.isNaN(rating)) {
			const normalized = Math.max(0, Math.min(5, Math.round(rating)));
			counts[normalized] += 1;
		}
	}
	return counts;
});

const maxRatingCount = computed(() => Math.max(0, ...ratingCounts.value));

const getPricePerWeightForRecord = (record: TeaRecord) => {
	return convertToPricePerDesiredUnit(
		record.price,
		record.weight,
		record.weightUnit,
		preferredWeightUnit.value,
		record.priceCurrency,
		preferredCurrency.value,
		exchangeRates.value

	);
};


const loadStats = async () => {
	const currency = await platformBridge.invoke('db:getSetting', PREFS.CURRENCY);
	if (currency.intVal != -1) {
		preferredCurrency.value = currency.intVal;
	}
	const weightUnit = await platformBridge.invoke('db:getSetting', PREFS.WEIGHT_UNIT);
	if (weightUnit.intVal != -1) {
		preferredWeightUnit.value = weightUnit.intVal;
	}
	exchangeRates.value = await platformBridge
		.invoke('db:getSetting', PREFS.EXCHANGE_RATES)
		.then((res: any) => (res.strVal ? JSON.parse(res.strVal) : {}));
	records.value = await platformBridge.invoke('db:listRecords');
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
		<h1 class="text-3xl font-bold mb-6">{{ t('stats.title') }}</h1>

		<div v-if="cumulativeStats" class="space-y-8">
			<div class="flex flex-wrap gap-2">
				<button
					class="px-4 py-2 rounded-lg border"
					:class="activeTab === 'summary' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800'"
					@click="activeTab = 'summary'"
				>
					{{ t('stats.tab_summary') }}
				</button>
				<button
					class="px-4 py-2 rounded-lg border"
					:class="activeTab === 'histograms' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800'"
					@click="activeTab = 'histograms'"
				>
					{{ t('stats.tab_histograms') }}
				</button>
				<button
					class="px-4 py-2 rounded-lg border"
					:class="activeTab === 'aromas' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800'"
					@click="activeTab = 'aromas'"
				>
					{{ t('stats.tab_aromas') }}
				</button>
			</div>

			<div v-if="activeTab === 'summary'" class="space-y-8">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<h2 class="text-2xl font-semibold mb-4">{{ t('stats.cumulative_title') }}</h2>
				<div class="space-y-3">
					<div class="border-b pb-2">
						<span class="font-medium">{{ t('stats.total_money_spent_label') }}</span>
						<div class="ml-4 mt-1 text-lg">
							{{ formatPriceString(cumulativeStats.totalMoneySpent ?? 0, preferredCurrency) }}
						</div>
					</div>

					<div class="border-b pb-2">
						<span class="font-medium">{{ t('stats.total_weight_label') }}</span>
						<div class="ml-4 mt-1 text-lg">
							{{ cumulativeStats.totalWeight?.toFixed(2) ?? '0.00' }} {{ weightUnitSymbols[preferredWeightUnit].symbol || '' }}
						</div>
					</div>

					<div class="border-b pb-2">
						<span class="font-medium">{{ t('stats.avg_price_per_weight_label') }}</span>
						<div class="ml-4 mt-1 text-lg">
							{{ formatPriceString(cumulativeStats.pricePerWeight ?? 0, preferredCurrency) }} / {{ weightUnitSymbols[preferredWeightUnit].symbol || '' }}
						</div>
					</div>

					<div class="border-b pb-2">
						<span class="font-medium">{{ t('stats.most_expensive_label') }}</span>
						<div class="ml-4 mt-1">
							<div v-if="cumulativeStats.mostExpensiveTea" class="text-lg">
								{{ cumulativeStats.mostExpensiveTea.name }}
								<span class="text-sm text-gray-500">
									- {{ formatPriceString(cumulativeStats.mostExpensiveTea.price ?? 0, cumulativeStats.mostExpensiveTea.priceCurrency) }}
								</span>
							</div>
							<div v-else class="text-gray-500">{{ t('stats.no_data') }}</div>
						</div>
						<span class="font-medium">{{ t('stats.most_expensive_by_weight_label') }}</span>
						<div class="ml-4 mt-1">
							<div v-if="cumulativeStats.mostExpensivePerWeightTea" class="text-lg">
								{{ cumulativeStats.mostExpensivePerWeightTea.name }}
								<span class="text-sm text-gray-500">
									- {{ formatPriceString(getPricePerWeightForRecord(cumulativeStats.mostExpensivePerWeightTea), preferredCurrency) }} / {{ weightUnitSymbols[preferredWeightUnit].symbol || '' }}
								</span>
							</div>
							<div v-else class="text-gray-500">{{ t('stats.no_data') }}</div>
						</div>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<PieChart
					:teaCountByType="cumulativeStats.teaCountByType"
					:labelMap="teaTypeLabels"
					:title="t('stats.tea_collection_by_type_title')"
				/>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<h2 class="text-2xl font-semibold mb-4">{{ t('stats.rating_distribution_title') }}</h2>
				<div v-if="maxRatingCount > 0" class="w-full">
					<svg class="w-full" viewBox="0 0 600 240" preserveAspectRatio="none">
						<g v-for="(count, index) in ratingCounts" :key="index">
							<rect
								:x="index * (600 / ratingCounts.length)"
								:y="220 - (count / (maxRatingCount || 1)) * 200"
								:width="(600 / ratingCounts.length) - 6"
								:height="(count / (maxRatingCount || 1)) * 200"
								fill="#6366f1"
								opacity="0.85"
							/>
						</g>
					</svg>
					<div class="mt-2 grid grid-cols-6 text-xs text-gray-500">
						<span
							v-for="(count, index) in ratingCounts"
							:key="`rating-label-${index}`"
							class="text-center"
						>
							{{ index }}
						</span>
					</div>
					<div class="mt-1 grid grid-cols-6 text-xs text-gray-700">
						<span
							v-for="(count, index) in ratingCounts"
							:key="`rating-count-${index}`"
							class="text-center"
						>
							{{ count }}
						</span>
					</div>
				</div>
				<div v-else class="text-gray-500">{{ t('stats.rating_distribution_no_data') }}</div>
			</div>
			</div>

			<div v-else-if="activeTab === 'histograms'" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<BarChart
					:records="records"
					:preferredCurrency="preferredCurrency"
					:preferredWeightUnit="preferredWeightUnit"
					:exchangeRates="exchangeRates"
					:bins="20"
				/>
			</div>

			<div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<AromaStats
					:records="records"
					:labelMap="teaTypeLabels"
				/>
			</div>
		</div>

		<div v-else class="text-center py-12 text-gray-500">
			{{ t('stats.loading') }}
		</div>
	</div>
</template>