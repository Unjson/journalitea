<script lang="ts" setup>
import { computed } from 'vue';
import { TeaColors } from '../../models/colors';
import { TeaType } from '../../models/enums';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface PieItem {
	label: string;
	value: number;
	displayValue: string;
	color: string;
	percentage: string;
	path: string;
	startAngle: number;
}

interface SeparatorLine {
	key: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

const CHART_CENTER = 150;
const CHART_RADIUS = 120;

const props = defineProps<{
	valuesByType: Record<string, number> | undefined;
	labelMap: { value: number; label: string }[];
	colors?: string[];
	title?: string;
	valueDecimals?: number;
	valueSuffix?: string;
	valueFormatter?: (value: number) => string;
}>();

const formatValue = (value: number): string => {
	if (props.valueFormatter) {
		return props.valueFormatter(value);
	}

	const decimals = Math.max(0, props.valueDecimals ?? 0);
	const formatted = value.toFixed(decimals);
	return props.valueSuffix ? `${formatted} ${props.valueSuffix}` : formatted;
};

const sortedTeaTypes = computed(() => {
	if (!props.valuesByType) return [] as Array<{ type: TeaType; label: string; value: number }>;

	return Object.entries(props.valuesByType)
		.map(([type, value]) => ({
			type: Number(type) as TeaType,
			label: props.labelMap[Number(type)]?.label || 'Unknown',
			value: value as number
		}))
		.filter((entry) => entry.value > 0)
		.sort((a, b) => b.value - a.value);
});

const pieChartData = computed<PieItem[]>(() => {
	const total = sortedTeaTypes.value.reduce((sum, item) => sum + item.value, 0);
	let currentAngle = -90;

	return sortedTeaTypes.value.map((item) => {
		const percentage = total > 0 ? (item.value / total) * 100 : 0;
		const angle = total > 0 ? (item.value / total) * 360 : 0;
		const startAngle = currentAngle;
		currentAngle += angle;
		const endAngle = currentAngle;

		const startX = CHART_CENTER + CHART_RADIUS * Math.cos((startAngle * Math.PI) / 180);
		const startY = CHART_CENTER + CHART_RADIUS * Math.sin((startAngle * Math.PI) / 180);
		const endX = CHART_CENTER + CHART_RADIUS * Math.cos((endAngle * Math.PI) / 180);
		const endY = CHART_CENTER + CHART_RADIUS * Math.sin((endAngle * Math.PI) / 180);

		const largeArc = angle > 180 ? 1 : 0;
		const path = `M ${CHART_CENTER} ${CHART_CENTER} L ${startX} ${startY} A ${CHART_RADIUS} ${CHART_RADIUS} 0 ${largeArc} 1 ${endX} ${endY} Z`;

		return {
			label: item.label,
			value: item.value,
			displayValue: formatValue(item.value),
			path,
			startAngle,
			color: TeaColors[item.type] || 'var(--color-chart-tea-other)',
			percentage: percentage.toFixed(1)
		};
	});
});

const separatorLines = computed<SeparatorLine[]>(() => {
	if (pieChartData.value.length <= 1) {
		return [];
	}

	return pieChartData.value.map((slice) => {
		const radians = (slice.startAngle * Math.PI) / 180;
		const x1 = CHART_CENTER;
		const y1 = CHART_CENTER;
		const x2 = CHART_CENTER + CHART_RADIUS * Math.cos(radians);
		const y2 = CHART_CENTER + CHART_RADIUS * Math.sin(radians);

		return {
			key: `${slice.label}-${slice.startAngle}`,
			x1,
			y1,
			x2,
			y2,
		};
	});
});
</script>

<template>
	<div>
		<h2 v-if="title" class="text-2xl font-semibold mb-4 text-center">{{ title }}</h2>
		<div v-if="pieChartData.length > 0" class="flex flex-col md:flex-row items-center justify-center gap-8">
			<div>
				<svg width="300" height="300" viewBox="0 0 300 300">
					<g v-for="slice in pieChartData" :key="slice.label">
						<path :d="slice.path" :fill="slice.color" />
					</g>
					<g v-if="separatorLines.length > 0">
						<line
							v-for="line in separatorLines"
							:key="line.key"
							:x1="line.x1"
							:y1="line.y1"
							:x2="line.x2"
							:y2="line.y2"
							stroke="var(--color-surface)"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</g>
				</svg>
			</div>

			<div class="space-y-2">
				<div v-for="slice in pieChartData" :key="slice.label" class="flex items-center gap-3">
					<div :style="{ backgroundColor: slice.color }" class="w-4 h-4 rounded"></div>
					<span class="text-sm">
						{{ t(slice.label) }}: <strong>{{ slice.displayValue }}</strong> ({{ slice.percentage }}%)
					</span>
				</div>
			</div>
		</div>

		<div v-else class="text-gray-500 text-center py-8">
			No tea records found
		</div>
	</div>
</template>
