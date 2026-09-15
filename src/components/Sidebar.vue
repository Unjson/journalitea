<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { markResetOnNextMainNav } from '../router';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

defineProps<{
  collapsed: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const navigateMain = async (path: string) => {
	markResetOnNextMainNav();
	emit('toggle');
	await router.replace(path);
};

const isActive = (path: string) => route.path === path;
</script>

<template>
	<aside 
		:class="['sidebar', { 'collapsed': collapsed }]"
	>		
		<div class="sidebar-content p-4 flex flex-col h-full">
			<h2 v-if="!collapsed" class="text-xl font-bold mb-6">Navigation</h2>
			
			<nav class="flex h-full flex-col gap-2">
				<button 
					type="button"
					@click="navigateMain('/')"
					:class="['nav-link', { 'router-link-active': isActive('/') }]"
				>
					<span v-if="!collapsed">📋 {{t('menu.item_my_teas')}}</span>
				</button>
				<button 
					type="button"
					@click="navigateMain('/timer')"
					:class="['nav-link', { 'router-link-active': isActive('/timer') }]"
				>
				<span v-if="!collapsed">⏱️ {{t('menu.item_timer')}}</span>
				</button>
				<button 
					type="button"
					@click="navigateMain('/stats')"
					:class="['nav-link', { 'router-link-active': isActive('/stats') }]"
				>
				<span v-if="!collapsed">📊 {{t('menu.item_stats')}}</span>
				</button>

				<div class="flex-1 grow"></div>
				<button 
					type="button"
					@click="navigateMain('/settings')" 
					:class="['nav-link', { 'router-link-active': isActive('/settings') }]"
				>
					<span v-if="!collapsed">⚙️ {{t('menu.item_settings')}}</span>
				</button>
				<button 
					type="button"
					@click="navigateMain('/about')"
					:class="['nav-link', { 'router-link-active': isActive('/about') }]"
				>
					<span v-if="!collapsed">ℹ️ {{t('menu.item_about')}}</span>
				</button>
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
	background-color: var(--color-sidebar);
	color: var(--color-ink);
	border-right: 1px solid var(--color-border);
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
	color: var(--color-ink-muted);
	font-weight: 500;
	background: transparent;
	border: 1px solid transparent;
	text-align: left;
	width: 100%;
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.5rem 0.75rem;
	border-radius: var(--radius-control);
	transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.nav-link:hover {
	background-color: var(--color-chrome-hover);
	border-color: var(--color-border);
	color: var(--color-ink);
}

.nav-link.router-link-active {
	background-color: var(--color-primary-soft);
	border-color: var(--color-border-strong);
	color: var(--color-primary-hover);
	font-weight: 600;
}

@media (max-width: 640px) {
	.nav-link {
		padding: 0.875rem 1rem;
		font-size: 1.1rem;
	}
}
</style>
