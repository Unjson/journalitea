<script lang="ts" setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
  collapsed: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
	<aside 
		:class="['sidebar', { 'collapsed': collapsed }]"
		class="bg-gray-800 text-white transition-all duration-300"
	>		
		<div class="sidebar-content p-4 flex flex-col h-full">
			<h2 v-if="!collapsed" class="text-xl font-bold mb-6">Navigation</h2>
			
			<nav class="flex h-full flex-col gap-2">
				<router-link 
					to="/" 
					@click="emit('toggle')"
					class="nav-link flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 transition-colors"
				>
					<span v-if="!collapsed">📋 {{t('menu.item_my_teas')}}</span>
				</router-link>
				<router-link 
					to="/timer"
					@click="emit('toggle')"
					class="nav-link flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 transition-colors"
				>
				<span v-if="!collapsed">⏱️ {{t('menu.item_timer')}}</span>
				</router-link>
				<router-link 
					to="/stats"
					@click="emit('toggle')"
					class="nav-link flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 transition-colors"
				>
				<span v-if="!collapsed">📊 {{t('menu.item_stats')}}</span>
				</router-link>

				<div class="flex-1 grow"></div>
				<router-link 
					to="/settings"
					@click="emit('toggle')" 
					class="nav-link flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 transition-colors"
				>
					<span v-if="!collapsed">⚙️ {{t('menu.item_settings')}}</span>
				</router-link>
				<router-link 
					to="/about"
					@click="emit('toggle')"
					class="nav-link flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 transition-colors"
				>
					<span v-if="!collapsed">ℹ️ {{t('menu.item_about')}}</span>
				</router-link>					
			</nav>
		</div>
	</aside>
</template>

<style scoped>
.sidebar {
	width: 250px;
	position: fixed;
	top: 0;
	left: 0;
	height: 100vh;
	z-index: 60;
	transition: transform 0.3s ease-in-out;
	transform: translateX(0);
}

.sidebar-content {
	padding-top: calc(1rem + env(safe-area-inset-top));
	padding-left: calc(1rem + env(safe-area-inset-left));
	padding-right: calc(1rem + env(safe-area-inset-right));
	padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}

.sidebar.collapsed {
	transform: translateX(-100%);
}

.nav-link {
	text-decoration: none;
	color: inherit;
}

.nav-link.router-link-active {
	background-color: #374151;
	font-weight: 600;
}

@media (max-width: 640px) {
	.nav-link {
		padding: 0.875rem 1rem;
		font-size: 1.1rem;
	}
}
</style>
