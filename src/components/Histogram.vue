<script lang="ts" setup>
import { computed } from 'vue';
import { Record as TeaRecord } from '../models/record';
import { CurrencyType, WeightUnit } from '../models/enums';
import { getPriceInMainCurrency, convertToPricePerDesiredUnit } from '../models/teaStats';

const props = defineProps<{
	records: TeaRecord[];
	preferredCurrency: CurrencyType;
	preferredWeightUnit: WeightUnit;
	exchangeRates: Record<string, number> | null;
	bins?: number;
}>();

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
		console.log('Price per unit for record', record.name, ':', val);
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
</script>

<template>
	<div class="space-y-8">
		<div>
			<h3 class="text-xl font-semibold mb-3">Total Prices</h3>
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
						/>
					</g>
				</svg>
				<div class="text-xs text-gray-500 mt-2">
					Range: {{ totalPriceHistogram.min.toFixed(2) }} - {{ totalPriceHistogram.max.toFixed(2) }}
				</div>
			</div>
			<div v-else class="text-gray-500">No price data</div>
		</div>

		<div>
			<h3 class="text-xl font-semibold mb-3">Price per Unit</h3>
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
						/>
					</g>
				</svg>
				<div class="text-xs text-gray-500 mt-2">
					Range: {{ pricePerUnitHistogram.min.toFixed(4) }} - {{ pricePerUnitHistogram.max.toFixed(4) }}
				</div>
			</div>
			<div v-else class="text-gray-500">No price-per-unit data</div>
		</div>
	</div>
</template>
