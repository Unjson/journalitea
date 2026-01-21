<script lang="ts" setup>
import BarChart from './charts/BarChart.vue';

defineProps<{
	records: any[];
	preferredCurrency: number;
	preferredWeightUnit: number;
	exchangeRates: Record<string, number> | null;
	bins?: number;
}>();
</script>

<template>
	<!-- Deprecated: use BarChart.vue -->
	<BarChart v-bind="$props" />
</template>
