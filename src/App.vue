<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getLocaleFromLanguage } from './models/enums';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useI18n } from 'vue-i18n';
import { Capacitor } from '@capacitor/core';
import Sidebar from './components/Sidebar.vue';
import Header from './components/Header.vue';
import { platformBridge } from './services/platformBridge';
import { markResetOnNextMainNav, resetHistoryStack } from './router';

const { t, locale } = useI18n();
const router = useRouter();
const sidebarCollapsed = ref(true);
const headerTitle = ref(t('app.title'));

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

onMounted(async() => {
	if (platformBridge.isCapacitor) {
		const platform = Capacitor.getPlatform();
		if (platform === 'android' || platform === 'ios') {
			document.documentElement.classList.add('mobile-ui-scale');
			await StatusBar.setStyle({ style: Style.Dark });
			await StatusBar.setBackgroundColor({ color: '#ffffff' });
		}
		platformBridge.onBackButton?.(({ canGoBack }) => {
			const routeName = String(router.currentRoute.value.name ?? '');
			if (
				routeName === 'record-detail'
			) {
				markResetOnNextMainNav();
				router.replace('/');
				return;
			}
			if (routeName === 'record-edit') {
				const recordId = router.currentRoute.value.params.id;
				if (recordId !== undefined) {
					router.replace({ name: 'record-detail', params: { id: recordId } });
					return;
				}
				markResetOnNextMainNav();
				router.replace('/');
				return;
			}
			if (routeName === 'record-new') {
				markResetOnNextMainNav();
				router.replace('/');
				return;
			}
			if (
				routeName === 'records-list' ||
				routeName === 'timer' ||
				routeName === 'stats' ||
				routeName === 'settings' ||
				routeName === 'about'
			) {
				resetHistoryStack();
				return;
			}
			if (canGoBack) {
				router.back();
			}
		});
	}
	
	router.afterEach((to) => {
		switch(to.name) {
			case 'records-list':
				headerTitle.value = t('header.title_my_teas');
				break;
			case 'record-detail':
				headerTitle.value = t('header.title_view_record');
				break;
			case 'record-edit':
				headerTitle.value = t('header.title_edit_record');
				break;
			case 'record-new':
				headerTitle.value = t('header.title_create_record');
				break;
			case 'stats':
				headerTitle.value = t('header.title_stats');
				break;
			case 'timer':
				headerTitle.value = t('header.title_timer');
				break;
			case 'about':
				headerTitle.value = t('header.title_about');
				break;
			case 'settings':
				headerTitle.value = t('header.title_settings');
				break;
			default:
				headerTitle.value = t('app.title');
		}
	});

	const language = await platformBridge.invoke('db:getSetting', 'language');
	if(language.intVal != -1){
		const newLocale = getLocaleFromLanguage(language.intVal);
		locale.value = newLocale;
	}
});
</script>

<template>
	<div id="app" class="h-screen">
		<!-- Backdrop overlay -->
		<div 
			v-if="!sidebarCollapsed"
			class="backdrop"
			@click="toggleSidebar"
		></div>

		<!-- Sidebar overlay -->
		<Sidebar :collapsed="sidebarCollapsed" @toggle="toggleSidebar" />

		<!-- Main Content -->
		<main class="main-content">
			<Header :sidebar-collapsed="sidebarCollapsed" @toggle-sidebar="toggleSidebar" :header-title="headerTitle" />
			<div class="p-6">
				<router-view/>
			</div>
		</main>
	</div>
</template>

<style scoped>
#app {
	position: relative;
	overflow: hidden;
}

.backdrop {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.5);
	z-index: 40;
	transition: opacity 0.3s ease-in-out;
}

.main-content {
	width: 100%;
	/* 2 px extra to account for shadow (72+2) */
	height: calc(100% - 74px); 
	overflow: auto;
	margin-top: 74px;
}
</style>