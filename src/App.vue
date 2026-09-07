<script lang="ts" setup>
import { computed, ref, onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useI18n } from 'vue-i18n';
import { Capacitor } from '@capacitor/core';
import Sidebar from './components/Sidebar.vue';
import Header from './components/Header.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import { platformBridge } from './services/platformBridge';
import { refreshAppSettings } from './services/appSettingsRefresh';
import { nextcloudSync, type RemoteUpdateCheck } from './services/nextcloudSync';
import { closeActivePhotoViewer } from './services/photoViewerState';
import { loadSyncConfig } from './services/syncConfig';
import { syncProgressState } from './services/syncProgress';
import { markResetOnNextMainNav, resetHistoryStack } from './router';

const { t } = useI18n();
const router = useRouter();
const sidebarCollapsed = ref(true);
const headerTitle = ref(t('app.title'));
const startupSyncPending = ref(true);
const startupSyncMessage = ref('');
const showRemoteUpdatePrompt = ref(false);
const pendingRemoteUpdate = ref<RemoteUpdateCheck | null>(null);
const lifecycleSyncInFlight = ref(false);

const startupPromptMessage = computed(() => {
	if (pendingRemoteUpdate.value?.hasConflict) {
		return t('sync.startup_conflict_message');
	}
	return t('sync.startup_update_message');
});

const syncProgressLabel = computed(() =>
	syncProgressState.messageKey ? t(syncProgressState.messageKey) : '',
);

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

const isBlockedBackTarget = () => {
	const backTarget = String(window.history.state?.back ?? '');
	if (backTarget.length === 0) {
		return false;
	}

	const normalizedBackTarget = backTarget.includes('#')
		? backTarget.slice(backTarget.indexOf('#') + 1)
		: backTarget;

	return (
		normalizedBackTarget === '/record/new' ||
		/^\/record\/[^/]+(?:\/edit)?$/.test(normalizedBackTarget)
	);
};

const canNavigateBack = () => {
	const historyState = window.history.state ?? {};
	return historyState.back != null || (historyState.position ?? 0) > 0;
};

const handleBackNavigation = () => {
	if (closeActivePhotoViewer()) {
		return;
	}

	const canGoBack = canNavigateBack();
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
		(routeName === 'timer' ||
			routeName === 'stats' ||
			routeName === 'settings' ||
			routeName === 'about')
	) {
		if (canGoBack && !isBlockedBackTarget()) {
			router.back();
			return;
		}

		markResetOnNextMainNav();
		router.replace('/');
		return;
	}
	if (canGoBack) {
		router.back();
		return;
	}
	if (
		routeName === 'records-list'
	) {
		resetHistoryStack();
		return;
	}
};

const isEditableTarget = (target: EventTarget | null) => {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return (
		target.isContentEditable ||
		target.closest('[contenteditable="true"]') !== null ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	);
};

const handleDesktopBackspace = (event: KeyboardEvent) => {
	if (
		!platformBridge.isElectron ||
		event.key !== 'Backspace' ||
		event.repeat ||
		event.defaultPrevented ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		isEditableTarget(event.target)
	) {
		return;
	}

	event.preventDefault();
	handleBackNavigation();
};

const finishStartupSync = () => {
	startupSyncPending.value = false;
	showRemoteUpdatePrompt.value = false;
	pendingRemoteUpdate.value = null;
};

const runLifecycleSync = async () => {
	const syncConfig = loadSyncConfig();
	if (
		!syncConfig.enabled ||
		syncConfig.requiresSourceChoice ||
		!syncConfig.dirty ||
		lifecycleSyncInFlight.value
	) {
		return;
	}

	lifecycleSyncInFlight.value = true;
	try {
		await nextcloudSync.syncNow();
	} catch (error) {
		console.error('Lifecycle Nextcloud sync failed:', error);
	} finally {
		lifecycleSyncInFlight.value = false;
	}
};

const handleStartupSync = async () => {
	startupSyncMessage.value = t('sync.startup_checking');
	try {
		const syncConfig = loadSyncConfig();
		if (!syncConfig.enabled || syncConfig.requiresSourceChoice) {
			finishStartupSync();
			return;
		}

		const remoteUpdate = await nextcloudSync.getRemoteUpdateCheck();
		if (remoteUpdate.newerThanLocal) {
			pendingRemoteUpdate.value = remoteUpdate;
			showRemoteUpdatePrompt.value = true;
			return;
		}
	} catch (error) {
		console.error('Error checking startup sync state:', error);
	}

	finishStartupSync();
};

const onApplyRemoteDatabase = async () => {
	startupSyncMessage.value = t('sync.startup_restoring');
	try {
		await nextcloudSync.applyRemoteDatabase();
	} catch (error) {
		console.error('Error applying remote database update:', error);
	} finally {
		finishStartupSync();
	}
};

const onKeepLocalDatabase = () => {
	finishStartupSync();
};

const handleBeforeQuitSync = async () => {
	try {
		await runLifecycleSync();
	} finally {
		await platformBridge.invoke('sync:completeBeforeQuit');
	}
};

onMounted(async() => {
	if (platformBridge.isCapacitor) {
		const platform = Capacitor.getPlatform();
		if (platform === 'android' || platform === 'ios') {
			document.documentElement.classList.add('mobile-ui-scale');
			await StatusBar.setStyle({ style: Style.Dark });
			await StatusBar.setBackgroundColor({ color: '#ffffff' });
		}
		platformBridge.onBackButton?.(() => {
			handleBackNavigation();
		});
	}

	if (platformBridge.isElectron) {
		window.addEventListener('keydown', handleDesktopBackspace);
		platformBridge.on('sync:requestBeforeQuit', () => {
			handleBeforeQuitSync();
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

	await refreshAppSettings();

	await handleStartupSync();
});

onBeforeUnmount(() => {
	if (platformBridge.isElectron) {
		window.removeEventListener('keydown', handleDesktopBackspace);
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
			<div
				v-if="syncProgressState.active"
				class="sticky top-0 z-20 border-b border-blue-100 bg-white/95 px-6 py-3 shadow-sm backdrop-blur"
			>
				<div class="flex items-center justify-between gap-4 text-sm">
					<div class="font-medium text-gray-800">{{ syncProgressLabel }}</div>
					<div class="shrink-0 text-xs font-semibold text-blue-700">{{ syncProgressState.percent }}%</div>
				</div>
				<div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
					<div
						class="h-full rounded-full bg-blue-500 transition-all duration-300"
						:style="{ width: `${syncProgressState.percent}%` }"
					></div>
				</div>
			</div>
			<div class="p-6">
				<div v-if="startupSyncPending" class="py-10 text-center text-gray-500">
					{{ startupSyncMessage || t('sync.startup_checking') }}
				</div>
				<router-view v-else/>
			</div>
		</main>

		<ConfirmDialog
			v-model="showRemoteUpdatePrompt"
			:title="t('sync.startup_update_title')"
			:message="startupPromptMessage"
			:confirm-text="t('sync.startup_update_confirm')"
			:cancel-text="t('sync.startup_update_cancel')"
			:close-on-backdrop="false"
			@confirm="onApplyRemoteDatabase"
			@cancel="onKeepLocalDatabase"
		/>
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
	--app-header-offset: calc(4.25rem + env(safe-area-inset-top));
	height: calc(100% - var(--app-header-offset));
	overflow: auto;
	margin-top: var(--app-header-offset);
}
</style>