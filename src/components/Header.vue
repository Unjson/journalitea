<script lang="ts" setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
  headerTitle: string;	
  sidebarCollapsed: boolean;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
}>();
</script>

<template>
	<header class="bg-white shadow p-4 flex items-center gap-4">
		<button 
			@click="emit('toggleSidebar')"
			class="p-2 hover:bg-gray-100 rounded transition-colors"
			:title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
		>
			<span class="text-xl">☰</span>
		</button>
		<h1 class="text-3xl font-bold">{{ headerTitle }}</h1>
	</header>
</template>

<style scoped>
button {
	cursor: pointer;
	border: none;
	background: transparent;
}
</style>
