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
	<header class="app-header bg-white shadow p-4 flex items-center gap-4 fixed top-0 inset-x-0 z-50">
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
.app-header {
	padding-top: calc(1rem + env(safe-area-inset-top));
	min-height: calc(4rem + env(safe-area-inset-top));
}

button {
	cursor: pointer;
	border: none;
	background: transparent;
}
</style>
