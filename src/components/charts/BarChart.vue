<script lang="ts" setup>
import { computed, ref } from 'vue';
import { Record as TeaRecord } from '../../models/record';
import { CurrencyType, WeightUnit, weightUnitSymbols, currencySymbols } from '../../models/enums';
import { getPriceInMainCurrency, convertToPricePerDesiredUnit, formatPriceString } from '../../models/teaStats';
import { useI18n } from 'vue-i18n';
import { platformBridge } from '../../services/platformBridge';

const props = defineProps<{
	records: TeaRecord[];
	preferredCurrency: CurrencyType;
	preferredWeightUnit: WeightUnit;
	exchangeRates: Record<string, number> | null;
	bins?: number;
}>();

const { t } = useI18n();
const binsCount = computed(() => props.bins ?? 10);

type ValueSummary = {
	min: number;
	max: number;
	average: number;
	median: number;
};

type HistogramChartKey = 'totalPrice' | 'pricePerUnit';

type HistogramBin = {
	start: number;
	end: number;
	count: number;
};

type HistogramData = {
	bins: HistogramBin[];
	maxCount: number;
	min: number;
	max: number;
	step: number;
};

type TooltipState = {
	chart: HistogramChartKey;
	index: number;
	lines: string[];
	x: number;
	y: number;
	width: number;
	height: number;
};

type HistogramPointerEvent = {
	clientX: number;
	clientY: number;
	pointerType?: string;
};

const CHART_WIDTH = 600;
const CHART_HEIGHT = 240;
const isMobileTooltip = platformBridge.isCapacitor || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
const TOOLTIP_MARGIN = 10;
const TOOLTIP_LINE_HEIGHT = isMobileTooltip ? 18 : 14;
const TOOLTIP_FONT_SIZE = isMobileTooltip ? 15 : 12;
const TOOLTIP_BORDER_RADIUS = isMobileTooltip ? 10 : 6;
const TOOLTIP_MIN_WIDTH = isMobileTooltip ? 164 : 140;
const TOOLTIP_MAX_WIDTH = isMobileTooltip ? 292 : 240;
const TOOLTIP_WIDTH_FACTOR = isMobileTooltip ? 8.1 : 7.2;
const TOOLTIP_HORIZONTAL_PADDING = isMobileTooltip ? 26 : 24;
const TOOLTIP_HEIGHT = isMobileTooltip ? 68 : 50;
const totalPriceSvg = ref<SVGSVGElement | null>(null);
const pricePerUnitSvg = ref<SVGSVGElement | null>(null);
const pendingTouchTap = ref<{ chart: HistogramChartKey; index: number } | null>(null);

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

const buildHistogram = (values: number[], roundToWholeUnits = false): HistogramData => {
	if (values.length === 0) {
		return { bins: [], maxCount: 0, min: 0, max: 0, step: 1 };
	}

	const actualMin = Math.min(...values);
	const actualMax = Math.max(...values);
	if (!roundToWholeUnits) {
		const min = actualMin;
		const max = actualMax;
		const step = (max - min || 1) / binsCount.value;
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
		return { bins, maxCount, min, max, step };
	}

	const idealStep = (actualMax - actualMin || 1) / binsCount.value;
	const step = Math.max(1, Math.round(idealStep));
	const min = Math.floor(actualMin / step) * step;
	let max = Math.ceil(actualMax / step) * step;

	if (max <= min) {
		max = min + step;
	}

	const binTotal = Math.max(1, Math.ceil((max - min) / step));
	const bins = Array.from({ length: binTotal }, (_, index) => {
		const start = min + index * step;
		const end = start + step;
		return { start, end, count: 0 };
	});

	for (const value of values) {
		const idx = Math.min(Math.floor((value - min) / step), binTotal - 1);
		bins[idx].count += 1;
	}

	const maxCount = Math.max(...bins.map(bin => bin.count));
	return { bins, maxCount, min, max: min + (binTotal * step), step };
};

const totalPriceHistogram = computed(() => buildHistogram(totalPriceValues.value, true));
const pricePerUnitHistogram = computed(() => buildHistogram(pricePerUnitValues.value));

const getValueSummary = (values: number[]): ValueSummary | null => {
	if (values.length === 0) {
		return null;
	}

	const sortedValues = [...values].sort((left, right) => left - right);
	const average = sortedValues.reduce((sum, value) => sum + value, 0) / sortedValues.length;
	const middleIndex = Math.floor(sortedValues.length / 2);
	const median = sortedValues.length % 2 === 0
		? (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
		: sortedValues[middleIndex];

	return {
		min: sortedValues[0],
		max: sortedValues[sortedValues.length - 1],
		average,
		median,
	};
};

const formatTotalPriceValue = (value: number) => formatPriceString(value, props.preferredCurrency);

const formatWholePriceValue = (value: number) => {
	const currencySymbol = currencySymbols[props.preferredCurrency].symbol;
	const roundedValue = Math.round(value);
	if (props.preferredCurrency === CurrencyType.EUR) {
		return `${roundedValue}${currencySymbol}`;
	}

	return `${currencySymbol}${roundedValue}`;
};

const formatPricePerUnitValue = (value: number) => {
	const unitSymbol = weightUnitSymbols[props.preferredWeightUnit].symbol || '';
	return `${formatPriceString(value, props.preferredCurrency)} / ${unitSymbol}`;
};

const formatBucketRange = (start: number, end: number, formatValue: (value: number) => string) => `${formatValue(start)} - ${formatValue(end)}`;

const formatCountLabel = (count: number) => `${t('stats.count_value')}: ${count}`;

const isTouchPointerEvent = (event: HistogramPointerEvent) => event.pointerType === 'touch';

const getTooltipWidth = (lines: string[]) => {
	const longestLineLength = Math.max(...lines.map((line) => line.length));
	const estimatedWidth = longestLineLength * TOOLTIP_WIDTH_FACTOR + TOOLTIP_HORIZONTAL_PADDING;
	return Math.max(TOOLTIP_MIN_WIDTH, Math.min(TOOLTIP_MAX_WIDTH, estimatedWidth));
};

const getSvgRef = (chart: HistogramChartKey) => chart === 'totalPrice' ? totalPriceSvg.value : pricePerUnitSvg.value;

const getChartSize = (chart: HistogramChartKey) => {
	const svg = getSvgRef(chart);
	const rect = svg?.getBoundingClientRect();

	return {
		width: rect?.width ?? CHART_WIDTH,
		height: rect?.height ?? CHART_HEIGHT,
	};
};

const clampTooltipY = (centerY: number, tooltipHeight: number, chartHeight: number) =>
	Math.max(0, Math.min(centerY - tooltipHeight - TOOLTIP_MARGIN, Math.max(chartHeight - tooltipHeight, 0)));

const buildTooltipState = (chart: HistogramChartKey, index: number, lines: string[], centerX: number, centerY = TOOLTIP_MARGIN + TOOLTIP_HEIGHT): TooltipState => {
	const chartSize = getChartSize(chart);
	const tooltipWidth = Math.min(getTooltipWidth(lines), chartSize.width);
	const tooltipHeight = Math.min(TOOLTIP_HEIGHT, chartSize.height);
	const x = Math.max(0, Math.min(centerX - (tooltipWidth / 2), Math.max(chartSize.width - tooltipWidth, 0)));
	const y = clampTooltipY(centerY, tooltipHeight, chartSize.height);

	return {
		chart,
		index,
		lines,
		x,
		y,
		width: tooltipWidth,
		height: tooltipHeight,
	};
};

const getBarSlotWidth = (binCount: number) => CHART_WIDTH / Math.max(binCount, 1);

const getBarGap = (binCount: number) => {
	const slotWidth = getBarSlotWidth(binCount);
	return Math.min(4, Math.max(1, slotWidth * 0.18));
};

const getBarX = (index: number, binCount: number) => {
	const slotWidth = getBarSlotWidth(binCount);
	return index * slotWidth + (getBarGap(binCount) / 2);
};

const getBarWidth = (binCount: number) => Math.max(1, getBarSlotWidth(binCount) - getBarGap(binCount));

const getBucketCenterX = (chart: HistogramChartKey, index: number, binCount: number) => {
	const binWidth = getChartSize(chart).width / Math.max(binCount, 1);
	return index * binWidth + (binWidth / 2);
};

const getPointerX = (chart: HistogramChartKey, event: HistogramPointerEvent) => {
	const svg = getSvgRef(chart);
	if (!svg) {
		return CHART_WIDTH / 2;
	}

	const rect = svg.getBoundingClientRect();
	if (rect.width === 0) {
		return CHART_WIDTH / 2;
	}

	return Math.max(0, Math.min(event.clientX - rect.left, rect.width));
};

const getPointerY = (chart: HistogramChartKey, event: HistogramPointerEvent) => {
	const svg = getSvgRef(chart);
	if (!svg) {
		return CHART_HEIGHT / 2;
	}

	const rect = svg.getBoundingClientRect();
	if (rect.height === 0) {
		return CHART_HEIGHT / 2;
	}

	return Math.max(0, Math.min(event.clientY - rect.top, rect.height));
};

const activeTooltip = ref<TooltipState | null>(null);

const showTooltipAtBar = (chart: HistogramChartKey, index: number, lines: string[], binCount: number) => {
	activeTooltip.value = buildTooltipState(chart, index, lines, getBucketCenterX(chart, index, binCount));
};

const showTooltipAtCursor = (chart: HistogramChartKey, index: number, lines: string[], event: HistogramPointerEvent) => {
	activeTooltip.value = buildTooltipState(chart, index, lines, getPointerX(chart, event), getPointerY(chart, event));
};

const handlePointerEnter = (chart: HistogramChartKey, index: number, lines: string[], event: HistogramPointerEvent) => {
	if (isTouchPointerEvent(event)) {
		return;
	}

	showTooltipAtCursor(chart, index, lines, event);
};

const handlePointerMove = (chart: HistogramChartKey, index: number, lines: string[], event: HistogramPointerEvent) => {
	if (isTouchPointerEvent(event)) {
		return;
	}

	showTooltipAtCursor(chart, index, lines, event);
};

const handlePointerDown = (chart: HistogramChartKey, index: number, lines: string[], event: HistogramPointerEvent) => {
	if (!isTouchPointerEvent(event)) {
		return;
	}

	pendingTouchTap.value = { chart, index };

	if (activeTooltip.value?.chart === chart && activeTooltip.value.index === index) {
		activeTooltip.value = null;
		return;
	}

	showTooltipAtCursor(chart, index, lines, event);
};

const handlePointerLeave = (chart: HistogramChartKey, index: number, event?: HistogramPointerEvent) => {
	if (event && isTouchPointerEvent(event)) {
		return;
	}

	clearTooltip(chart, index);
};

const clearTooltip = (chart: HistogramChartKey, index?: number) => {
	if (!activeTooltip.value || activeTooltip.value.chart !== chart) {
		return;
	}

	if (typeof index === 'number' && activeTooltip.value.index !== index) {
		return;
	}

	activeTooltip.value = null;
};

const handleFocus = (chart: HistogramChartKey, index: number, lines: string[], binCount: number) => {
	if (isMobileTooltip) {
		return;
	}

	showTooltipAtBar(chart, index, lines, binCount);
};

const handleBlur = (chart: HistogramChartKey, index: number) => {
	if (isMobileTooltip) {
		return;
	}

	clearTooltip(chart, index);
};

const toggleTooltip = (chart: HistogramChartKey, index: number, lines: string[], event: HistogramPointerEvent) => {
	if (pendingTouchTap.value?.chart === chart && pendingTouchTap.value.index === index) {
		pendingTouchTap.value = null;
		return;
	}

	if (activeTooltip.value?.chart === chart && activeTooltip.value.index === index) {
		activeTooltip.value = null;
		return;
	}

	showTooltipAtCursor(chart, index, lines, event);
};

const totalPriceSummary = computed(() => {
	const summary = getValueSummary(totalPriceValues.value);
	if (!summary) {
		return null;
	}

	return {
		min: formatTotalPriceValue(summary.min),
		max: formatTotalPriceValue(summary.max),
		average: formatTotalPriceValue(summary.average),
		median: formatTotalPriceValue(summary.median),
	};
});

const pricePerUnitSummary = computed(() => {
	const summary = getValueSummary(pricePerUnitValues.value);
	if (!summary) {
		return null;
	}

	return {
		min: formatPricePerUnitValue(summary.min),
		max: formatPricePerUnitValue(summary.max),
		average: formatPricePerUnitValue(summary.average),
		median: formatPricePerUnitValue(summary.median),
	};
});
</script>

<template>
	<div class="space-y-8">
		<div>
			<h3 class="text-xl font-semibold mb-3">{{ t('stats.histogram_total_price') }}</h3>
			<div v-if="totalPriceSummary" class="relative w-full" @click="clearTooltip('totalPrice')">
				<svg ref="totalPriceSvg" class="w-full" viewBox="0 0 600 240" preserveAspectRatio="none">
					<g v-for="(bin, index) in totalPriceHistogram.bins" :key="index">
						<rect
							:x="getBarX(index, totalPriceHistogram.bins.length)"
							:y="220 - (bin.count / (totalPriceHistogram.maxCount || 1)) * 200"
							:width="getBarWidth(totalPriceHistogram.bins.length)"
							:height="(bin.count / (totalPriceHistogram.maxCount || 1)) * 200"
							class="cursor-pointer"
							fill="#3b82f6"
							opacity="0.8"
							role="button"
							:aria-label="`${formatBucketRange(bin.start, bin.end, formatWholePriceValue)}. ${formatCountLabel(bin.count)}`"
							tabindex="0"
							@pointerenter="handlePointerEnter('totalPrice', index, [formatBucketRange(bin.start, bin.end, formatWholePriceValue), formatCountLabel(bin.count)], $event)"
							@pointermove="handlePointerMove('totalPrice', index, [formatBucketRange(bin.start, bin.end, formatWholePriceValue), formatCountLabel(bin.count)], $event)"
							@pointerdown.stop="handlePointerDown('totalPrice', index, [formatBucketRange(bin.start, bin.end, formatWholePriceValue), formatCountLabel(bin.count)], $event)"
							@pointerleave="handlePointerLeave('totalPrice', index, $event)"
							@click.stop="toggleTooltip('totalPrice', index, [formatBucketRange(bin.start, bin.end, formatWholePriceValue), formatCountLabel(bin.count)], $event)"
							@focus="handleFocus('totalPrice', index, [formatBucketRange(bin.start, bin.end, formatWholePriceValue), formatCountLabel(bin.count)], totalPriceHistogram.bins.length)"
							@blur="handleBlur('totalPrice', index)"
							@keydown.enter.prevent="showTooltipAtBar('totalPrice', index, [formatBucketRange(bin.start, bin.end, formatWholePriceValue), formatCountLabel(bin.count)], totalPriceHistogram.bins.length)"
							@keydown.space.prevent="showTooltipAtBar('totalPrice', index, [formatBucketRange(bin.start, bin.end, formatWholePriceValue), formatCountLabel(bin.count)], totalPriceHistogram.bins.length)"
						/>
					</g>
				</svg>
				<div
					v-if="activeTooltip?.chart === 'totalPrice'"
					class="pointer-events-none absolute z-10 flex flex-col items-center justify-center bg-gray-900/92 px-3 text-center text-white shadow"
					:style="{
						left: `${activeTooltip.x}px`,
						top: `${activeTooltip.y}px`,
						width: `${activeTooltip.width}px`,
						height: `${activeTooltip.height}px`,
						borderRadius: `${TOOLTIP_BORDER_RADIUS}px`,
						fontSize: `${TOOLTIP_FONT_SIZE}px`,
						lineHeight: `${TOOLTIP_LINE_HEIGHT}px`,
					}"
				>
					<span v-for="(line, lineIndex) in activeTooltip.lines" :key="`total-tooltip-line-${lineIndex}`">
						{{ line }}
					</span>
				</div>
				<div class="mt-2 w-full">
					<div class="flex w-full items-center gap-3 px-1 text-[10px] text-gray-500 dark:text-gray-400">
						<span class="shrink-0">{{ totalPriceSummary.min }}</span>
						<div class="h-px flex-1 bg-gray-300 dark:bg-gray-600"></div>
						<span class="shrink-0 text-right">{{ totalPriceSummary.max }}</span>
					</div>
				</div>
				<div class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
					<span>{{ t('stats.average_value') }}: {{ totalPriceSummary.average }}</span>
					<span>{{ t('stats.median_value') }}: {{ totalPriceSummary.median }}</span>
				</div>
			</div>
			<div v-else class="text-gray-500">{{ t('stats.no_price_data') }}</div>
		</div>

		<div>
			<h3 class="text-xl font-semibold mb-3">{{ (props.preferredWeightUnit === WeightUnit.METRIC_GRAM) ? t('stats.histogram_price_per_weight_g') : t('stats.histogram_price_per_weight_oz') }}</h3>
			<div v-if="pricePerUnitSummary" class="relative w-full" @click="clearTooltip('pricePerUnit')">
				<svg ref="pricePerUnitSvg" class="w-full" viewBox="0 0 600 240" preserveAspectRatio="none">
					<g v-for="(bin, index) in pricePerUnitHistogram.bins" :key="index">
						<rect
							:x="getBarX(index, pricePerUnitHistogram.bins.length)"
							:y="220 - (bin.count / (pricePerUnitHistogram.maxCount || 1)) * 200"
							:width="getBarWidth(pricePerUnitHistogram.bins.length)"
							:height="(bin.count / (pricePerUnitHistogram.maxCount || 1)) * 200"
							class="cursor-pointer"
							fill="#10b981"
							opacity="0.8"
							tabindex="0"
							@pointerenter="handlePointerEnter('pricePerUnit', index, [formatBucketRange(bin.start, bin.end, formatPricePerUnitValue), formatCountLabel(bin.count)], $event)"
							@pointermove="handlePointerMove('pricePerUnit', index, [formatBucketRange(bin.start, bin.end, formatPricePerUnitValue), formatCountLabel(bin.count)], $event)"
							@pointerdown.stop="handlePointerDown('pricePerUnit', index, [formatBucketRange(bin.start, bin.end, formatPricePerUnitValue), formatCountLabel(bin.count)], $event)"
							@pointerleave="handlePointerLeave('pricePerUnit', index, $event)"
							@click.stop="toggleTooltip('pricePerUnit', index, [formatBucketRange(bin.start, bin.end, formatPricePerUnitValue), formatCountLabel(bin.count)], $event)"
							@focus="handleFocus('pricePerUnit', index, [formatBucketRange(bin.start, bin.end, formatPricePerUnitValue), formatCountLabel(bin.count)], pricePerUnitHistogram.bins.length)"
							@blur="handleBlur('pricePerUnit', index)"
							@keydown.enter.prevent="showTooltipAtBar('pricePerUnit', index, [formatBucketRange(bin.start, bin.end, formatPricePerUnitValue), formatCountLabel(bin.count)], pricePerUnitHistogram.bins.length)"
							@keydown.space.prevent="showTooltipAtBar('pricePerUnit', index, [formatBucketRange(bin.start, bin.end, formatPricePerUnitValue), formatCountLabel(bin.count)], pricePerUnitHistogram.bins.length)"
						/>
					</g>
				</svg>
				<div
					v-if="activeTooltip?.chart === 'pricePerUnit'"
					class="pointer-events-none absolute z-10 flex flex-col items-center justify-center bg-gray-900/92 px-3 text-center text-white shadow"
					:style="{
						left: `${activeTooltip.x}px`,
						top: `${activeTooltip.y}px`,
						width: `${activeTooltip.width}px`,
						height: `${activeTooltip.height}px`,
						borderRadius: `${TOOLTIP_BORDER_RADIUS}px`,
						fontSize: `${TOOLTIP_FONT_SIZE}px`,
						lineHeight: `${TOOLTIP_LINE_HEIGHT}px`,
					}"
				>
					<span v-for="(line, lineIndex) in activeTooltip.lines" :key="`ppu-tooltip-line-${lineIndex}`">
						{{ line }}
					</span>
				</div>
				<div class="mt-2 w-full">
					<div class="flex w-full items-center gap-3 px-1 text-[10px] text-gray-500 dark:text-gray-400">
						<span class="shrink-0">{{ pricePerUnitSummary.min }}</span>
						<div class="h-px flex-1 bg-gray-300 dark:bg-gray-600"></div>
						<span class="shrink-0 text-right">{{ pricePerUnitSummary.max }}</span>
					</div>
				</div>
				<div class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
					<span>{{ t('stats.average_value') }}: {{ pricePerUnitSummary.average }}</span>
					<span>{{ t('stats.median_value') }}: {{ pricePerUnitSummary.median }}</span>
				</div>
			</div>
			<div v-else class="text-gray-500">{{ t('stats.no_price_data') }}</div>
		</div>
	</div>
</template>