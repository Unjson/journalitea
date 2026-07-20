<script lang="ts" setup>
import { ref, onMounted, onActivated, computed } from 'vue';
import { CurrencyType, WeightUnit, teaTypeLabels, weightUnitLabels, currencyLabels, currencySymbols, weightUnitSymbols } from '../models/enums';
import { PREFS, DEFAULT_PREFS } from '../appSettings.js';
import { getCumulativeStats, formatPriceString, convertToPricePerDesiredUnit} from '../models/teaStats';
import { useI18n } from 'vue-i18n';
import PieChart from '../components/charts/PieChart.vue';
import BarChart from '../components/charts/BarChart.vue';
import AromaStats from '../components/AromaStats.vue';
import StarRating from '../components/StarRating.vue';
import RecordYearFooter from '../components/RecordYearFooter.vue';
import { Record as TeaRecord, getRecordOriginCountry, getRecordSpecificOrigin } from '../models/record';
import { platformBridge } from '../services/platformBridge';
const { t } = useI18n();

const EMPTY_EXCHANGE_RATES = {} as Record<CurrencyType, number>;
const SPECIFIC_ORIGIN_COLLAPSED_LIMIT = 10;

const preferredCurrency = ref<CurrencyType>(CurrencyType.USD);
const preferredWeightUnit = ref<WeightUnit>(WeightUnit.METRIC_GRAM);
const exchangeRates = ref<Record<CurrencyType, number>>(EMPTY_EXCHANGE_RATES);
const records = ref<TeaRecord[]>([]);
const cumulativeStats = ref<any>(null);
const activeTab = ref<'summary' | 'histograms' | 'aromas' | 'origins'>('summary');
const teaCollectionMetric = ref<'absolute' | 'weight'>('absolute');
const showAllSpecificOrigins = ref(false);
const years = ref<number[]>([]);
const selectedYear = ref<number | null>(null);
const histogramBuckets = ref<number>(DEFAULT_PREFS.HISTOGRAM_BUCKETS);

const pieValuesByType = computed<Record<string, number> | undefined>(() => {
	if (!cumulativeStats.value) {
		return undefined;
	}

	if (teaCollectionMetric.value === 'weight') {
		return cumulativeStats.value.teaWeightByType;
	}

	return cumulativeStats.value.teaCountByType;
});

const pieValueDecimals = computed(() => (teaCollectionMetric.value === 'weight' ? 2 : 0));

const pieValueSuffix = computed(() => {
	if (teaCollectionMetric.value !== 'weight') {
		return undefined;
	}

	return weightUnitSymbols[preferredWeightUnit.value].symbol || undefined;
});

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

const averageRating = computed(() => {
	const validRatings = records.value
		.map((record) => Number(record.rating))
		.filter((rating) => !Number.isNaN(rating) && rating > 0);

	if (validRatings.length === 0) {
		return 0;
	}

	const total = validRatings.reduce((sum, rating) => sum + rating, 0);
	return total / validRatings.length;
});

const ratedRecordCount = computed(() => records.value
	.map((record) => Number(record.rating))
	.filter((rating) => !Number.isNaN(rating) && rating > 0).length);

const averageRatingDisplay = computed(() => Number(averageRating.value.toFixed(2)));

const originCountries = computed(() => {
	const counts = new Map<string, number>();

	for (const record of records.value) {
		const country = getRecordOriginCountry(record);
		if (country.length > 0) {
			counts.set(country, (counts.get(country) ?? 0) + 1);
		}
	}

	return Array.from(counts.entries())
		.sort((a, b) => {
			if (b[1] !== a[1]) {
				return b[1] - a[1];
			}
			return a[0].localeCompare(b[0]);
		})
		.map(([country, count]) => ({ country, count }));
});

const maxOriginCountryCount = computed(() => Math.max(0, ...originCountries.value.map((entry) => entry.count)));

const specificOrigins = computed(() => {
	const counts = new Map<string, number>();

	for (const record of records.value) {
		const originParts = getRecordSpecificOrigin(record)
			.split(',')
			.map((origin) => origin.trim())
			.filter((origin) => origin.length > 0);

		for (const origin of originParts) {
			counts.set(origin, (counts.get(origin) ?? 0) + 1);
		}
	}

	return Array.from(counts.entries())
		.sort((a, b) => {
			if (b[1] !== a[1]) {
				return b[1] - a[1];
			}
			return a[0].localeCompare(b[0]);
		})
		.map(([origin, count]) => ({ origin, count }));
});

const hasHiddenSpecificOrigins = computed(
	() => specificOrigins.value.length > SPECIFIC_ORIGIN_COLLAPSED_LIMIT,
);

const visibleSpecificOrigins = computed(() => {
	if (showAllSpecificOrigins.value) {
		return specificOrigins.value;
	}

	return specificOrigins.value.slice(0, SPECIFIC_ORIGIN_COLLAPSED_LIMIT);
});

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
	const histogramBucketSetting = await platformBridge.invoke('db:getSetting', PREFS.HISTOGRAM_BUCKETS);
	if (histogramBucketSetting.intVal != -1) {
		histogramBuckets.value = Math.min(50, Math.max(5, histogramBucketSetting.intVal));
	}
	exchangeRates.value = await platformBridge
		.invoke('db:getSetting', PREFS.EXCHANGE_RATES)
		.then((res: any) => (res.strVal ? JSON.parse(res.strVal) : EMPTY_EXCHANGE_RATES) as Record<CurrencyType, number>);
	records.value = await platformBridge.invoke('db:listRecords', selectedYear.value);
	cumulativeStats.value = getCumulativeStats(
		records.value,
		preferredCurrency.value,
		preferredWeightUnit.value,
		exchangeRates.value
	);
};

const loadYears = async () => {
	try {
		years.value = await platformBridge.invoke('db:listRecordYears');
		if (selectedYear.value === null && years.value.length > 0) {
			const currentYear = new Date().getFullYear();
			if (years.value.includes(currentYear)) {
				selectedYear.value = currentYear;
			}
		}
	} catch (err) {
		console.error('Error loading record years:', err);
	}
};

const selectYear = async (year: number | null) => {
	if (selectedYear.value === year) return;
	selectedYear.value = year;
	await loadStats();
};

onMounted(async () => {
	await loadYears();
	await loadStats();
});
onActivated(loadStats);

</script>

<template>
	<div class="min-h-screen flex flex-col p-6">
		<h1 class="text-3xl font-bold mb-6">{{ t('stats.title') }}</h1>

		<div v-if="cumulativeStats" class="space-y-8 flex-1">
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
				<button
					class="px-4 py-2 rounded-lg border"
					:class="activeTab === 'origins' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800'"
					@click="activeTab = 'origins'"
				>
					{{ t('stats.tab_origins') }}
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
					:valuesByType="pieValuesByType"
					:labelMap="teaTypeLabels"
					:title="t('stats.tea_collection_by_type_title')"
					:value-decimals="pieValueDecimals"
					:value-suffix="pieValueSuffix"
				/>
				<div class="mt-4 flex flex-col items-center">
					<div class="text-sm font-medium text-gray-600 mb-2">
						{{ t('stats.tea_collection_metric_label') }}
					</div>
					<div class="flex flex-wrap justify-center gap-2">
						<button
							type="button"
							class="shrink-0 px-4 py-2 rounded-full border text-sm transition"
							:class="
								teaCollectionMetric === 'absolute'
									? 'bg-blue-500 text-white border-blue-500'
									: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
							"
							@click="teaCollectionMetric = 'absolute'"
						>
							{{ t('stats.tea_collection_metric_absolute') }}
						</button>
						<button
							type="button"
							class="shrink-0 px-4 py-2 rounded-full border text-sm transition"
							:class="
								teaCollectionMetric === 'weight'
									? 'bg-blue-500 text-white border-blue-500'
									: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
							"
							@click="teaCollectionMetric = 'weight'"
						>
							{{ t('stats.tea_collection_metric_weight') }}
						</button>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<h2 class="text-2xl font-semibold mb-4">{{ t('stats.average_rating_label') }}</h2>
				<div v-if="ratedRecordCount > 0" class="flex items-center gap-4">
					<StarRating :model-value="averageRating" :max="5" :disabled="true" :aria-label="t('stats.average_rating_label')" />
					<span class="text-lg font-medium">{{ averageRatingDisplay }} / 5</span>
				</div>
				<div v-else class="text-gray-500">{{ t('stats.rating_distribution_no_data') }}</div>
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
					:bins="histogramBuckets"
				/>
			</div>

			<div v-else-if="activeTab === 'aromas'" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<AromaStats
					:records="records"
					:labelMap="teaTypeLabels"
				/>
			</div>

			<div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<h2 class="text-2xl font-semibold mb-4">{{ t('stats.origins_title') }}</h2>
				<div class="space-y-8">
					<section>
						<h3 class="text-xl font-semibold mb-4">{{ t('stats.origin_countries_title') }}</h3>
						<div v-if="originCountries.length > 0" class="space-y-3">
							<div v-for="entry in originCountries" :key="entry.country" class="flex items-center gap-3">
								<div class="w-32 shrink-0 text-sm font-medium text-gray-700">{{ entry.country }}</div>
								<div class="h-4 flex-1 overflow-hidden rounded-full bg-gray-200">
									<div
										class="h-full rounded-full bg-blue-500"
										:style="{ width: `${(entry.count / (maxOriginCountryCount || 1)) * 100}%` }"
									></div>
								</div>
								<div class="w-10 shrink-0 text-right text-sm text-gray-600">{{ entry.count }}</div>
							</div>
						</div>
						<div v-else class="text-gray-500">{{ t('stats.origin_countries_no_data') }}</div>
					</section>

					<section>
						<h3 class="text-xl font-semibold mb-4">{{ t('stats.origin_details_title') }}</h3>
						<ol v-if="specificOrigins.length > 0" class="list-decimal list-inside space-y-1">
							<li v-for="entry in visibleSpecificOrigins" :key="entry.origin">
								{{ entry.origin }} ({{ entry.count }})
							</li>
						</ol>
						<button
							v-if="hasHiddenSpecificOrigins"
							type="button"
							class="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
							@click="showAllSpecificOrigins = !showAllSpecificOrigins"
						>
							{{ showAllSpecificOrigins ? t('stats.origin_details_show_less') : t('stats.origin_details_show_more') }}
						</button>
						<div v-if="specificOrigins.length === 0" class="text-gray-500">{{ t('stats.origin_details_no_data') }}</div>
					</section>
				</div>
			</div>
		</div>

		<div v-else class="text-center py-12 text-gray-500 flex-1">
			{{ t('stats.loading') }}
		</div>

		<RecordYearFooter
			:years="years"
			:selected-year="selectedYear"
			:label="t('list.filter_year_label')"
			:all-label="t('list.filter_year_all')"
			@select="selectYear"
		/>
	</div>
</template>