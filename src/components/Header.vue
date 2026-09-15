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
	<header class="app-header p-4 flex items-center gap-4 fixed top-0 inset-x-0 z-50">
		<button 
			@click="emit('toggleSidebar')"
			class="menu-trigger p-2 transition-colors"
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
	background-color: var(--color-chrome);
	border-bottom: 1px solid var(--color-border);
	box-shadow: var(--shadow-surface);
}

button {
	cursor: pointer;
	border: none;
	background: transparent;
}

.menu-trigger {
	color: var(--color-ink);
	border: 1px solid transparent;
}

.menu-trigger:hover {
	background-color: var(--color-chrome-hover);
	border-color: var(--color-border);
}
</style>
