<script lang="ts" setup>
import { computed } from 'vue';
import { TeaColors } from '../models/colors';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface PieItem {
	label: string;
	count: number;
	color: string;
	percentage: string;
	path: string;
}

const props = defineProps<{
	teaCountByType: Record<string, number> | undefined;
	labelMap: Record<number, string>;
	colors?: string[];
	title?: string;
}>();

const sortedTeaTypes = computed(() => {
	if (!props.teaCountByType) return [] as Array<{ type: number; label: string; count: number }>; 

	return Object.entries(props.teaCountByType)
		.map(([type, count]) => ({
			type: Number(type),
			label: props.labelMap[Number(type)] || 'Unknown',
			count: count as number
		}))
		.filter(entry => entry.count > 0)
		.sort((a, b) => b.count - a.count);
});

const pieChartData = computed<PieItem[]>(() => {
	const total = sortedTeaTypes.value.reduce((sum, item) => sum + item.count, 0);
	let currentAngle = -90;

	return sortedTeaTypes.value.map((item, index) => {
		const percentage = total > 0 ? (item.count / total) * 100 : 0;
		const angle = total > 0 ? (item.count / total) * 360 : 0;
		const startAngle = currentAngle;
		currentAngle += angle;
		const endAngle = currentAngle;

		const startX = 150 + 120 * Math.cos((startAngle * Math.PI) / 180);
		const startY = 150 + 120 * Math.sin((startAngle * Math.PI) / 180);
		const endX = 150 + 120 * Math.cos((endAngle * Math.PI) / 180);
		const endY = 150 + 120 * Math.sin((endAngle * Math.PI) / 180);

		const largeArc = angle > 180 ? 1 : 0;
		const path = `M 150 150 L ${startX} ${startY} A 120 120 0 ${largeArc} 1 ${endX} ${endY} Z`;

		return {
			label: item.label,
			count: item.count,
			path,
			color: TeaColors[item.type] || '#D3D3D3',
			percentage: percentage.toFixed(1)
		};
	});
});
</script>

<template>
	<div>
		<h2 v-if="title" class="text-2xl font-semibold mb-4">{{ title }}</h2>
		<div v-if="pieChartData.length > 0" class="flex flex-col md:flex-row items-center justify-left gap-8">
			<div>
				<svg width="300" height="300" viewBox="0 0 300 300">
					<g v-for="slice in pieChartData" :key="slice.label">
						<path :d="slice.path" :fill="slice.color" stroke="white" stroke-width="2" />
					</g>
				</svg>
			</div>

			<div class="space-y-2">
				<div v-for="slice in pieChartData" :key="slice.label" class="flex items-center gap-3">
					<div :style="{ backgroundColor: slice.color }" class="w-4 h-4 rounded"></div>
					<span class="text-sm">
						{{ t(slice.label) }}: <strong>{{ slice.count }}</strong> ({{ slice.percentage }}%)
					</span>
				</div>
			</div>
		</div>

		<div v-else class="text-gray-500 text-center py-8">
			No tea records found
		</div>
	</div>
</template>
