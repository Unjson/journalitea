<script lang="ts" setup>
import { computed } from 'vue';
import { Record as TeaRecord } from '../../models/record';
import { CurrencyType, WeightUnit } from '../../models/enums';
import { getPriceInMainCurrency, convertToPricePerDesiredUnit } from '../../models/teaStats';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	records: TeaRecord[];
	preferredCurrency: CurrencyType;
	preferredWeightUnit: WeightUnit;
	exchangeRates: Record<string, number> | null;
	bins?: number;
}>();

const { t } = useI18n();
const binsCount = computed(() => props.bins ?? 10);

const totalPriceValues = computed(() => {
	const rates = props.exchangeRates ?? {};
	return props.records
		.map(record => getPriceInMainCurrency(record.price, record.priceCurrency, props.preferredCurrency, rates))
		.filter(value => typeof value === 'number' && !isNaN(value) && value > 0);
});

const pricePerUnitValues = computed(() => {
	const rates = props.exchangeRates ?? {};
	const values: number[] = [];
	for(const record of props.records) {
		const val = convertToPricePerDesiredUnit(
			record.price,
			record.weight,
			record.weightUnit,
			props.preferredWeightUnit,
			record.priceCurrency,
			props.preferredCurrency,
			rates
		);
		if (typeof val === 'number' && !isNaN(val) && val > 0) {
			values.push(val);
		}
	}
	return values;
});

const buildHistogram = (values: number[]) => {
	if (values.length === 0) return { bins: [], maxCount: 0, min: 0, max: 0 };

	const min = Math.min(...values);
	const max = Math.max(...values);
	const range = max - min || 1;
	const step = range / binsCount.value;

	const bins = Array.from({ length: binsCount.value }, (_, index) => {
		const start = min + index * step;
		const end = index === binsCount.value - 1 ? max : start + step;
		return { start, end, count: 0 };
	});

	for (const value of values) {
		const idx = Math.min(Math.floor((value - min) / step), binsCount.value - 1);
		bins[idx].count += 1;
	}

	const maxCount = Math.max(...bins.map(bin => bin.count));
	return { bins, maxCount, min, max };
};

const totalPriceHistogram = computed(() => buildHistogram(totalPriceValues.value));
const pricePerUnitHistogram = computed(() => buildHistogram(pricePerUnitValues.value));

const formatBinLabel = (start: number, end: number, decimals: number) => `${start.toFixed(decimals)}–${end.toFixed(decimals)}`;

const getVisibleLabelIndexes = (binCount: number) => {
	const visible = new Set<number>();
	for (let index = 0; index < binCount; index += 2) {
		visible.add(index);
	}
	return visible;
};

const totalPriceBinLabels = computed(() =>
	totalPriceHistogram.value.bins.map((bin) => ({
		min: bin.start.toFixed(2),
		max: bin.end.toFixed(2),
		full: formatBinLabel(bin.start, bin.end, 2),
	}))
);

const totalPriceVisibleLabelIndexes = computed(() => getVisibleLabelIndexes(totalPriceBinLabels.value.length));

const pricePerUnitBinLabels = computed(() =>
	pricePerUnitHistogram.value.bins.map((bin) => ({
		min: bin.start.toFixed(4),
		max: bin.end.toFixed(4),
		full: formatBinLabel(bin.start, bin.end, 4),
	}))
);

const pricePerUnitVisibleLabelIndexes = computed(() => getVisibleLabelIndexes(pricePerUnitBinLabels.value.length));
</script>

<template>
	<div class="space-y-8">
		<div>
			<h3 class="text-xl font-semibold mb-3">{{ t('stats.histogram_total_price') }}</h3>
			<div v-if="totalPriceHistogram.bins.length > 0" class="w-full">
				<svg class="w-full" viewBox="0 0 600 240" preserveAspectRatio="none">
					<g v-for="(bin, index) in totalPriceHistogram.bins" :key="index">
						<rect
							:x="index * (600 / totalPriceHistogram.bins.length)"
							:y="220 - (bin.count / (totalPriceHistogram.maxCount || 1)) * 200"
							:width="(600 / totalPriceHistogram.bins.length) - 4"
							:height="(bin.count / (totalPriceHistogram.maxCount || 1)) * 200"
							fill="#3b82f6"
							opacity="0.8"
						>
							<title>{{ formatBinLabel(bin.start, bin.end, 2) }} ({{ bin.count }})</title>
						</rect>
					</g>
				</svg>
				<div class="mt-2 overflow-x-auto">
					<div
						class="grid gap-0 text-[10px] text-gray-500"
						:style="{ minWidth: '600px', gridTemplateColumns: `repeat(${totalPriceBinLabels.length}, minmax(0, 1fr))` }"
					>
						<span
							v-for="(label, index) in totalPriceBinLabels"
							:key="`total-x-${index}`"
							class="text-center leading-tight"
							:title="totalPriceVisibleLabelIndexes.has(index) ? label.full : ''"
						>
							<template v-if="totalPriceVisibleLabelIndexes.has(index)">
								<span class="block">{{ label.min }}</span>
								<span class="block">-</span>
								<span class="block">{{ label.max }}</span>
							</template>
						</span>
					</div>
				</div>
				<div class="text-xs text-gray-500 mt-2">
					Range: {{ totalPriceHistogram.min.toFixed(2) }} - {{ totalPriceHistogram.max.toFixed(2) }}
				</div>
			</div>
			<div v-else class="text-gray-500">{{ t('stats.no_price_data') }}</div>
		</div>

		<div>
			<h3 class="text-xl font-semibold mb-3">{{ (props.preferredWeightUnit === WeightUnit.METRIC_GRAM) ? t('stats.histogram_price_per_weight_g') : t('stats.histogram_price_per_weight_oz') }}</h3>
			<div v-if="pricePerUnitHistogram.bins.length > 0" class="w-full">
				<svg class="w-full" viewBox="0 0 600 240" preserveAspectRatio="none">
					<g v-for="(bin, index) in pricePerUnitHistogram.bins" :key="index">
						<rect
							:x="index * (600 / pricePerUnitHistogram.bins.length)"
							:y="220 - (bin.count / (pricePerUnitHistogram.maxCount || 1)) * 200"
							:width="(600 / pricePerUnitHistogram.bins.length) - 4"
							:height="(bin.count / (pricePerUnitHistogram.maxCount || 1)) * 200"
							fill="#10b981"
							opacity="0.8"
						>
							<title>{{ formatBinLabel(bin.start, bin.end, 4) }} ({{ bin.count }})</title>
						</rect>
					</g>
				</svg>
				<div class="mt-2 overflow-x-auto">
					<div
						class="grid gap-0 text-[10px] text-gray-500"
						:style="{ minWidth: '600px', gridTemplateColumns: `repeat(${pricePerUnitBinLabels.length}, minmax(0, 1fr))` }"
					>
						<span
							v-for="(label, index) in pricePerUnitBinLabels"
							:key="`ppu-x-${index}`"
							class="text-center leading-tight"
							:title="pricePerUnitVisibleLabelIndexes.has(index) ? label.full : ''"
						>
							<template v-if="pricePerUnitVisibleLabelIndexes.has(index)">
								<span class="block">{{ label.min }}</span>
								<span class="block">-</span>
								<span class="block">{{ label.max }}</span>
							</template>
						</span>
					</div>
				</div>
				<div class="text-xs text-gray-500 mt-2">
					Range: {{ pricePerUnitHistogram.min.toFixed(4) }} - {{ pricePerUnitHistogram.max.toFixed(4) }}
				</div>
			</div>
			<div v-else class="text-gray-500">{{ t('stats.no_price_data') }}</div>
		</div>
	</div>
</template>