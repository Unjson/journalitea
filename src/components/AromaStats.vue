<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import RadarPlot from './charts/RadarPlot.vue';
import { Record as TeaRecord } from '../models/record';
import { aromaFieldLabels } from '../models/enums';

const props = defineProps<{
	records: TeaRecord[];
	labelMap: { value: number; label: string }[];
}>();

const { t } = useI18n();

type AromaKey = typeof aromaFieldLabels[number]['key'];

const calculateAverages = (records: TeaRecord[]) => {
	const totals: Record<AromaKey, number> = {
		aroma_sweet: 0,
		aroma_floral: 0,
		aroma_nutty: 0,
		aroma_spicy: 0,
		aroma_fire: 0,
		aroma_fruity: 0,
		aroma_plants: 0,
		aroma_earthy: 0,
		aroma_minerals: 0,
		aroma_marine: 0
	};
	const count = records.length || 1;

	for (const record of records) {
		for (const field of aromaFieldLabels) {
			const value = Number((record as any)[field.key] ?? 0);
			totals[field.key] += isNaN(value) ? 0 : value;
		}
	}

	return aromaFieldLabels.map(field => ({
		key: field.key,
		value: totals[field.key] / count,
	}));
};

const overallAromas = computed(() => calculateAverages(props.records));

const openStates = ref<Record<number, boolean>>({});
const plotVersions = ref<Record<number, number>>({});

const handleToggle = (type: number, event: Event) => {
	const isOpen = (event.target as HTMLDetailsElement).open;
	openStates.value = { ...openStates.value, [type]: isOpen };
	if (isOpen) {
		plotVersions.value = {
			...plotVersions.value,
			[type]: (plotVersions.value[type] ?? 0) + 1
		};
	}
};

const byTeaType = computed(() => {
	const grouped = new Map<number, TeaRecord[]>();
	for (const record of props.records) {
		const type = Number(record.type);
		if (!grouped.has(type)) grouped.set(type, []);
		grouped.get(type)!.push(record);
	}

	return Array.from(grouped.entries())
		.map(([type, records]) => ({
			type,
			label: props.labelMap[type] ? t(props.labelMap.find(l => l.value === type)?.label) : 'Unknown',
			count: records.length,
			aromas: calculateAverages(records)
		}))
		.sort((a, b) => b.count - a.count);
});
</script>

<template>
	<div class="space-y-8">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h2 class="text-2xl font-semibold mb-4">{{ t('stats.aromas_overall_title') }}</h2>
			<RadarPlot
					:data-points="overallAromas"
				:max-value="5"
			/>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h2 class="text-2xl font-semibold mb-4">{{ t('stats.aromas_type_title') }}</h2>
			<div v-if="byTeaType.length > 0" class="space-y-3">
				<details
					v-for="group in byTeaType"
					:key="group.type"
					class="border rounded-lg"
					@toggle="handleToggle(group.type, $event)"
				>
					<summary class="flex items-center justify-between cursor-pointer select-none px-4 py-3">
						<span class="text-lg font-semibold">{{ group.label }}</span>
						<span class="text-sm text-gray-500">{{ group.count }} records</span>
					</summary>
					<div class="px-4 pb-4">
						<RadarPlot
							v-if="openStates[group.type]"
							:key="plotVersions[group.type] ?? 0"
							:data-points="group.aromas"
							:max-value="5"
						/>
					</div>
				</details>
			</div>
			<div v-else class="text-gray-500">No aroma data</div>
		</div>
	</div>
</template>
