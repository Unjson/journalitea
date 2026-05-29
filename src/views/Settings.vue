<script lang="ts" setup>
import { computed, ref, onMounted } from 'vue';
import { Language, CurrencyType, WeightUnit, languageLabels, currencyLabels, weightUnitLabels, getLocaleFromLanguage, setCustomCurrency } from '../models/enums';
import { lookUpExchangeRates } from '../models/teaStats';
import { useI18n } from 'vue-i18n';
import { PREFS, DEFAULT_PREFS } from '../appSettings.js';
import SelectDropdown from '../components/SelectDropdown.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { platformBridge } from '../services/platformBridge';
import { nextcloudSync, type PendingSourceChoiceState, type SyncConnectionResult, type SyncSourceChoice } from '../services/nextcloudSync';
import { DEFAULT_NEXTCLOUD_BACKUP_RETENTION, DEFAULT_NEXTCLOUD_FOLDER, loadSyncConfig, normalizeRemoteFolder, saveSyncConfig, setSyncError } from '../services/syncConfig';
const { t, locale } = useI18n();
const languageSetting = ref<Language>(Language.ENGLISH);
const preferredCurrency = ref<CurrencyType>(CurrencyType.USD);
const preferredWeightUnit = ref<WeightUnit>(WeightUnit.METRIC_GRAM);
const histogramBuckets = ref<number>(DEFAULT_PREFS.HISTOGRAM_BUCKETS);
const customCurrency = ref<{ symbol: string; rate: number }>({ symbol: '', rate: 1.0 });
const showImportConfirm = ref(false);
const pendingImportPath = ref<string | null>(null);
const pendingImportData = ref<string | null>(null);
const pendingImportName = ref<string | null>(null);
const showExportDialog = ref(false);
const exportDialogTitle = ref('');
const exportDialogMessage = ref('');
const syncEnabled = ref(false);
const syncPictures = ref(false);
const syncServerUrl = ref('');
const syncRemoteFolder = ref(DEFAULT_NEXTCLOUD_FOLDER);
const syncBackupRetention = ref(DEFAULT_NEXTCLOUD_BACKUP_RETENTION);
const syncLoginName = ref('');
const syncUserId = ref('');
const syncBusy = ref(false);
const syncStatus = ref('');
const syncError = ref<string | null>(null);
const syncLastSyncAt = ref('');
const syncLastErrorAt = ref('');
const syncDirty = ref(false);
const hasStoredSyncSecret = ref(false);
const showDisconnectConfirm = ref(false);
const syncSourceChoiceRequired = ref(false);
const pendingSourceChoiceState = ref<PendingSourceChoiceState | null>(null);
const pendingSourceChoice = ref<SyncSourceChoice | null>(null);
const showSourceChoiceDialog = ref(false);
const showSourceChoiceConfirm = ref(false);

const syncLastSyncLabel = computed(() =>
	syncLastSyncAt.value
		? new Date(syncLastSyncAt.value).toLocaleString()
		: t('sync.last_sync_never'),
);

const sourceChoiceRemoteDateLabel = computed(() => {
	if (!pendingSourceChoiceState.value?.remoteLastModified) {
		return t('sync.source_choice_remote_unknown');
	}
	return new Date(pendingSourceChoiceState.value.remoteLastModified).toLocaleString();
});

const sourceChoiceMessage = computed(() => {
	const localCount = pendingSourceChoiceState.value?.localRecordCount ?? 0;
	return `${t('sync.source_choice_intro')}\n\n${t('sync.source_choice_local_summary', { count: localCount })}\n${t('sync.source_choice_remote_summary', { date: sourceChoiceRemoteDateLabel.value })}`;
});

const sourceChoiceConfirmMessage = computed(() => {
	if (pendingSourceChoice.value === 'local') {
		return t('sync.source_choice_confirm_local_message');
	}
	if (pendingSourceChoice.value === 'remote') {
		return t('sync.source_choice_confirm_remote_message');
	}
	return '';
});

const sourceChoiceConfirmTitle = computed(() => {
	if (pendingSourceChoice.value === 'local') {
		return t('sync.source_choice_confirm_local_title');
	}
	if (pendingSourceChoice.value === 'remote') {
		return t('sync.source_choice_confirm_remote_title');
	}
	return t('sync.source_choice_title');
});

const loadPendingSourceChoiceState = async (providedState?: PendingSourceChoiceState | SyncConnectionResult | null) => {
	const state = providedState ?? await nextcloudSync.getPendingSourceChoiceState();
	pendingSourceChoiceState.value = state;
	syncSourceChoiceRequired.value = state.requiresSourceChoice;
	if (state.requiresSourceChoice) {
		syncStatus.value = t('sync.status_source_choice_required');
	}
	return state;
};

const openSourceChoiceDialog = async (providedState?: PendingSourceChoiceState | SyncConnectionResult | null) => {
	const state = await loadPendingSourceChoiceState(providedState);
	if (!state.requiresSourceChoice) {
		return;
	}
	showSourceChoiceDialog.value = true;
};

const applySyncConfig = async () => {
	const config = loadSyncConfig();
	syncEnabled.value = config.enabled;
	syncPictures.value = config.syncPictures;
	syncSourceChoiceRequired.value = config.requiresSourceChoice;
	syncServerUrl.value = config.serverUrl;
	syncRemoteFolder.value = config.remoteFolder;
	syncBackupRetention.value = config.backupRetention;
	syncLoginName.value = config.loginName;
	syncUserId.value = config.userId;
	syncLastSyncAt.value = config.lastSyncAt;
	syncLastErrorAt.value = config.lastErrorAt;
	syncDirty.value = config.dirty;
	syncError.value = config.lastError || null;
	hasStoredSyncSecret.value = await nextcloudSync.hasStoredSecret();
	if (config.requiresSourceChoice && hasStoredSyncSecret.value) {
		await loadPendingSourceChoiceState();
	}
	syncStatus.value = hasStoredSyncSecret.value
		? t('sync.status_connected')
		: t('sync.status_not_connected');
	if (config.requiresSourceChoice && hasStoredSyncSecret.value) {
		syncStatus.value = t('sync.status_source_choice_required');
	}
};

const persistSyncConfig = () => {
	const config = saveSyncConfig({
		enabled: syncEnabled.value,
		syncPictures: syncPictures.value,
		serverUrl: syncServerUrl.value.trim(),
		remoteFolder: syncRemoteFolder.value,
		backupRetention: syncBackupRetention.value,
	});
	syncEnabled.value = config.enabled;
	syncPictures.value = config.syncPictures;
	syncServerUrl.value = config.serverUrl;
	syncRemoteFolder.value = config.remoteFolder;
	syncBackupRetention.value = config.backupRetention;
	syncDirty.value = config.dirty;
	if (!config.lastError) {
		syncError.value = null;
	}
};

const onCurrencyChanged = async () => {
  try {
	await platformBridge.invoke('db:setSetting', PREFS.CURRENCY, preferredCurrency.value);
	const exchangeRates = await lookUpExchangeRates(preferredCurrency.value);

	await platformBridge.invoke('db:setSetting', PREFS.EXCHANGE_RATES, -1, JSON.stringify(exchangeRates));
  } catch (err) {
	console.error('Error saving preferred currency:', err);
  }
};

const onCustomCurrencyChanged = async () => {
  try {
	const sanitizedRate = Number.isFinite(customCurrency.value.rate) ? customCurrency.value.rate : 1;
	const customCurrencyValue = setCustomCurrency(customCurrency.value.symbol.trim(), sanitizedRate);
	await platformBridge.invoke('db:setSetting', PREFS.CUSTOM_CURRENCY, -1, JSON.stringify(customCurrencyValue));
  } catch (err) {
	console.error('Error saving custom currency:', err);
  }
};

const onLanguageChanged = async () => {
  try {
	await platformBridge.invoke('db:setSetting', PREFS.LANGUAGE, languageSetting.value);
	locale.value = getLocaleFromLanguage(languageSetting.value);
  } catch (err) {
	console.error('Error saving language setting:', err);
  }
};

const onWeightUnitChanged = async () => {
  try {
	await platformBridge.invoke('db:setSetting', PREFS.WEIGHT_UNIT, preferredWeightUnit.value);
  } catch (err) {
	console.error('Error saving preferred weight unit:', err);
  }
};

const onHistogramBucketsChanged = async () => {
	histogramBuckets.value = Math.min(50, Math.max(5, Math.round(histogramBuckets.value)));
	try {
	await platformBridge.invoke('db:setSetting', PREFS.HISTOGRAM_BUCKETS, histogramBuckets.value);
	} catch (err) {
	console.error('Error saving histogram bucket setting:', err);
	}
};

const buildExportSuccessMessage = (result: any): string => {
	const lines: string[] = [];
	if (platformBridge.isCapacitor) {
		lines.push(t('settings.database_export_success_cap'));
	} else {
		lines.push(`${t('settings.database_export_success')}:`);
		if (result?.path) {
			lines.push(String(result.path));
		}
	}

	if (result?.photoArchivePath) {
		lines.push(t('settings.database_export_photo_archive', {
			path: String(result.photoArchivePath),
		}));
	}

	return lines.join('\n');
};

const buildImportSuccessMessage = (
	mode: 'append' | 'replace',
	result: any,
): string => {
	const lines = [
		t(
			mode === 'append'
				? 'settings.database_import_success_append'
				: 'settings.database_import_success_replace',
		),
	];

	if (result?.photoArchivePath) {
		lines.push(t('settings.database_import_photos_restored', {
			path: String(result.photoArchivePath),
		}));
	} else {
		lines.push(t('settings.database_import_photos_missing'));
	}

	return lines.join('\n');
};

const onExportDatabase = async () => {
	try {
		const result = await platformBridge.invoke('db:exportDatabase');
		if (result?.cancelled) return;
		if (result?.success || result?.path) {
			exportDialogTitle.value = t('settings.database_export_success_title');
			exportDialogMessage.value = buildExportSuccessMessage(result);
			showExportDialog.value = true;
			return;
		}

		exportDialogTitle.value = t('settings.database_export_error_title');
		exportDialogMessage.value = t('settings.database_export_error');
		showExportDialog.value = true;
	} catch (err) {
		exportDialogTitle.value = t('settings.database_export_error_title');
		exportDialogMessage.value =
			err instanceof Error 
			? t('settings.database_export_error') + ': \n' + err.message 
			: t('settings.database_export_error');
		showExportDialog.value = true;
		console.error('Error exporting database:', err);
	}
};

const onImportDatabase = async () => {
	try {
		const result = await platformBridge.invoke('db:pickDatabaseFile');
		if (result?.path || result?.data) {
			pendingImportPath.value = result?.path ?? null;
			pendingImportData.value = result?.data ?? null;
			pendingImportName.value = result?.name ?? null;
			showImportConfirm.value = true;
		}
	} catch (err) {
	console.error('Error importing database:', err);
	}
};

const appendImport = async () => {
	try {
		if (!pendingImportPath.value) return;
		const result = await platformBridge.invoke('db:importDatabase', {
			mode: 'append',
			sourcePath: pendingImportPath.value,
			sourceData: pendingImportData.value,
			sourceName: pendingImportName.value,
		});
		if (result?.success) {
			window.alert(buildImportSuccessMessage('append', result));
		}
	} catch (err) {
		console.error('Error appending database:', err);
	} finally {
		pendingImportPath.value = null;
		pendingImportData.value = null;
		pendingImportName.value = null;
	}
};

const replaceImport = async () => {
	try {
		if (!pendingImportPath.value) return;
		const result = await platformBridge.invoke('db:importDatabase', {
			mode: 'replace',
			sourcePath: pendingImportPath.value,
			sourceData: pendingImportData.value,
			sourceName: pendingImportName.value,
		});
		if (result?.success) {
			window.alert(buildImportSuccessMessage('replace', result));
		}
	} catch (err) {
		console.error('Error replacing database:', err);
	} finally {
		pendingImportPath.value = null;
		pendingImportData.value = null;
		pendingImportName.value = null;
	}
};

const cancelImport = () => {
	pendingImportPath.value = null;
	pendingImportData.value = null;
	pendingImportName.value = null;
};

const onSyncEnabledChanged = () => {
	persistSyncConfig();
};

const toggleSyncEnabled = () => {
	if (syncBusy.value) {
		return;
	}

	syncEnabled.value = !syncEnabled.value;
	onSyncEnabledChanged();
};

const toggleSyncPictures = () => {
	if (syncBusy.value) {
		return;
	}

	syncPictures.value = !syncPictures.value;
	persistSyncConfig();
};

const onSyncServerChanged = () => {
	persistSyncConfig();
};

const onSyncRemoteFolderChanged = () => {
	syncRemoteFolder.value = normalizeRemoteFolder(syncRemoteFolder.value);
	persistSyncConfig();
};

const onSyncBackupRetentionChanged = () => {
	syncBackupRetention.value = Math.min(20, Math.max(0, Math.round(syncBackupRetention.value)));
	persistSyncConfig();
};

const onConnectNextcloud = async () => {
	syncBusy.value = true;
	syncError.value = null;
	syncStatus.value = t('sync.status_waiting_browser');
	persistSyncConfig();
	try {
		const result = await nextcloudSync.startLogin(syncServerUrl.value);
		await applySyncConfig();
		if (result.requiresSourceChoice) {
			await openSourceChoiceDialog(result);
			return;
		}
		syncStatus.value = t('sync.status_connected');
	} catch (err) {
		const message = err instanceof Error ? err.message : t('sync.error_generic');
		syncError.value = message;
		setSyncError(message);
	} finally {
		syncBusy.value = false;
	}
};

const onDisconnectNextcloud = async () => {
	syncBusy.value = true;
	syncError.value = null;
	try {
		await nextcloudSync.disconnect();
		await applySyncConfig();
		syncStatus.value = t('sync.status_not_connected');
	} catch (err) {
		const message = err instanceof Error ? err.message : t('sync.error_generic');
		syncError.value = message;
		setSyncError(message);
	} finally {
		syncBusy.value = false;
	}
};

const onSyncNow = async () => {
	syncBusy.value = true;
	syncError.value = null;
	syncStatus.value = t('sync.status_syncing');
	try {
		await nextcloudSync.syncNow();
		await applySyncConfig();
		syncStatus.value = t('sync.status_connected');
	} catch (err) {
		const message = err instanceof Error ? err.message : t('sync.error_generic');
		syncError.value = message;
		setSyncError(message);
	} finally {
		syncBusy.value = false;
	}
};

const onChooseLocalSource = () => {
	pendingSourceChoice.value = 'local';
	showSourceChoiceConfirm.value = true;
};

const onChooseRemoteSource = () => {
	pendingSourceChoice.value = 'remote';
	showSourceChoiceConfirm.value = true;
};

const onCancelSourceChoice = () => {
	pendingSourceChoice.value = null;
	syncStatus.value = t('sync.status_source_choice_required');
};

const onCancelSourceChoiceConfirm = () => {
	showSourceChoiceDialog.value = true;
	pendingSourceChoice.value = null;
};

const onConfirmSourceChoice = async () => {
	if (!pendingSourceChoice.value) {
		return;
	}

	syncBusy.value = true;
	syncError.value = null;
	syncStatus.value = t('sync.status_syncing');
	try {
		if (pendingSourceChoice.value === 'local') {
			await nextcloudSync.syncNow();
		} else {
			await nextcloudSync.applyRemoteDatabase();
		}
		pendingSourceChoice.value = null;
		await applySyncConfig();
		syncStatus.value = t('sync.status_connected');
	} catch (err) {
		const message = err instanceof Error ? err.message : t('sync.error_generic');
		syncError.value = message;
		setSyncError(message);
		await applySyncConfig();
	} finally {
		syncBusy.value = false;
	}
};

onMounted(async() => {
  try{
	const language = await platformBridge.invoke('db:getSetting', PREFS.LANGUAGE);
	if(language.intVal != -1){
		languageSetting.value = language.intVal;
	}
	const currency = await platformBridge.invoke('db:getSetting', PREFS.CURRENCY);
	if(currency.intVal != -1){
		preferredCurrency.value = currency.intVal;
	}
	const weightUnit = await platformBridge.invoke('db:getSetting', PREFS.WEIGHT_UNIT);
	if(weightUnit.intVal != -1){
		preferredWeightUnit.value = weightUnit.intVal;
	}
	const histogramBucketSetting = await platformBridge.invoke('db:getSetting', PREFS.HISTOGRAM_BUCKETS);
	if(histogramBucketSetting.intVal != -1){
		histogramBuckets.value = Math.min(50, Math.max(5, histogramBucketSetting.intVal));
	}
	const customCurrencySetting = await platformBridge.invoke('db:getSetting', PREFS.CUSTOM_CURRENCY);
	if(customCurrencySetting.strVal){
		try{
			const parsed = JSON.parse(customCurrencySetting.strVal);
			if(parsed?.symbol !== undefined){
				customCurrency.value.symbol = parsed.symbol;
			}
			if(parsed?.rate !== undefined){
				customCurrency.value.rate = parsed.rate;
			}
			setCustomCurrency(customCurrency.value.symbol, customCurrency.value.rate);
		} catch (err) {
			console.error('Error parsing custom currency setting:', err);
		}
	}
	await applySyncConfig();
  } catch (err) {
	console.error('Error loading settings:', err);
  }
});

</script>

<template>
	<h1 class="text-3xl font-bold">Settings Page</h1>
	<div class="mt-6">
		<div class="mb-4">
			<label class="block text-gray-700 font-bold mb-2" for="language">
				{{ t('settings.language_title') }}
			</label>
			<SelectDropdown
				v-model="languageSetting"
				:options="languageLabels"
				:aria-label="t('settings.language_title')"
				@update:model-value="onLanguageChanged"
			/>
		</div>

		<div class="mb-4">
			<label class="block text-gray-700 font-bold mb-2" for="currency">
				{{ t('settings.currency_title') }}
			</label>
			<SelectDropdown
				v-model="preferredCurrency"
				:options="currencyLabels"
				:aria-label="t('settings.currency_title')"
				@update:model-value="onCurrencyChanged"
			/>
		</div>

		<div v-if="preferredCurrency === CurrencyType.OTHER" class="mb-2 flex flex-row gap-4">
			<div class="mb-3 flex-1">
				<label class="block text-gray-700 font-regular mb-1" for="customCurrencySymbol">
					{{ t('settings.custom_currency_symbol') }}
				</label>
				<input
					id="customCurrencySymbol"
					v-model="customCurrency.symbol"
					class="w-full h-8 rounded border border-gray-300 px-3 py-2"
					type="text"
					:placeholder="t('settings.custom_currency_symbol')"
					@input="onCustomCurrencyChanged"
				/>
			</div>
			<div class="flex-1">
				<label class="block text-gray-700 font-regular mb-1" for="customCurrencyRate">
					{{ t('settings.custom_currency_rate') }}
				</label>
				<input
					id="customCurrencyRate"
					v-model.number="customCurrency.rate"
					class="w-full h-8 rounded border border-gray-300 px-3 py-2"
					type="number"
					step="0.0001"
					min="0"
					:placeholder="t('settings.custom_currency_rate')"
					@input="onCustomCurrencyChanged"
				/>
			</div>
		</div>

		<div class="mb-4">
			<label class="block text-gray-700 font-bold mb-2" for="currency">
				{{ t('settings.weightunit_title') }}
			</label>
			<SelectDropdown
				v-model="preferredWeightUnit"
				:options="weightUnitLabels"
				:aria-label="t('settings.weightunit_title')"
				@update:model-value="onWeightUnitChanged"
			/>
		</div>

		<div class="mb-6">
			<label class="block text-gray-700 font-bold mb-2" for="histogramBuckets">
				{{ t('settings.histogram_buckets_title') }}
			</label>
			<div class="flex items-start gap-4">
				<div class="flex-1">
					<input
						id="histogramBuckets"
						v-model.number="histogramBuckets"
						class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
						type="range"
						min="5"
						max="50"
						step="1"
						:aria-label="t('settings.histogram_buckets_title')"
						@change="onHistogramBucketsChanged"
					/>
					<div class="mt-1 flex justify-between text-xs text-gray-500">
						<span>5</span>
						<span>50</span>
					</div>
					<div class="mt-1 text-center text-xs text-gray-500">
						{{ t('settings.histogram_buckets_hint') }}
					</div>
				</div>
				<span class="w-12 shrink-0 text-right font-medium text-gray-700">{{ histogramBuckets }}</span>
			</div>
		</div>

		<div class="mt-8">
			<h2 class="text-xl font-bold mb-3">{{ t('sync.section_title') }}</h2>
			<div class="rounded-lg border border-gray-200 p-4">
				<div class="flex items-start justify-between gap-4">
					<div>
						<div class="text-sm font-medium text-gray-700">
							{{ t('sync.enable_label') }}
						</div>
						<div class="mt-2 text-xs text-gray-500">
							{{ t('sync.disable_hint') }}
						</div>
					</div>
					<button
						type="button"
						role="switch"
						:aria-checked="syncEnabled"
						:aria-label="t('sync.enable_label')"
						:disabled="syncBusy"
						:class="[
							'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
							syncEnabled ? 'bg-gray-800' : 'bg-gray-300',
						]"
						@click="toggleSyncEnabled"
					>
						<span
							:class="[
								'inline-block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200',
								syncEnabled ? 'translate-x-7' : 'translate-x-1',
							]"
						></span>
					</button>
				</div>

				<div class="mt-4 flex items-start justify-between gap-4 border-t border-gray-200 pt-4">
					<div>
						<div class="text-sm font-medium text-gray-700">
							{{ t('sync.pictures_label') }}
						</div>
						<div class="mt-2 text-xs text-gray-500">
							{{ t('sync.pictures_hint') }}
						</div>
					</div>
					<button
						type="button"
						role="switch"
						:aria-checked="syncPictures"
						:aria-label="t('sync.pictures_label')"
						:disabled="syncBusy"
						:class="[
							'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
							syncPictures ? 'bg-gray-800' : 'bg-gray-300',
						]"
						@click="toggleSyncPictures"
					>
						<span
							:class="[
								'inline-block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200',
								syncPictures ? 'translate-x-7' : 'translate-x-1',
							]"
						></span>
					</button>
				</div>

				<div class="mt-4">
					<label class="block text-gray-700 font-bold mb-2" for="syncServerUrl">
						{{ t('sync.server_url') }}
					</label>
					<input
						id="syncServerUrl"
						v-model="syncServerUrl"
						class="w-full rounded border border-gray-300 px-3 py-2"
						type="url"
						:disabled="syncBusy"
						@change="onSyncServerChanged"
					/>
				</div>

				<div class="mt-4 grid gap-4 sm:grid-cols-2">
					<div>
						<label class="block text-gray-700 font-bold mb-2" for="syncRemoteFolder">
							{{ t('sync.folder_path') }}
						</label>
						<input
							id="syncRemoteFolder"
							v-model="syncRemoteFolder"
							class="w-full rounded border border-gray-300 px-3 py-2"
							type="text"
							:disabled="syncBusy"
							@change="onSyncRemoteFolderChanged"
						/>
					</div>
					<div>
						<label class="block text-gray-700 font-bold mb-2" for="syncBackupRetention">
							{{ t('sync.backup_retention') }}
						</label>
						<input
							id="syncBackupRetention"
							v-model.number="syncBackupRetention"
							class="w-full rounded border border-gray-300 px-3 py-2"
							type="number"
							min="0"
							max="20"
							:disabled="syncBusy"
							@change="onSyncBackupRetentionChanged"
						/>
					</div>
				</div>

				<div class="mt-4 rounded bg-gray-50 px-4 py-3 text-sm text-gray-700">
					<div class="font-medium">{{ t('sync.connection_title') }}</div>
					<div class="mt-1">{{ hasStoredSyncSecret ? t('sync.status_connected') : t('sync.status_not_connected') }}</div>
					<div v-if="syncLoginName" class="mt-1">
						{{ t('sync.connected_account') }}: {{ syncLoginName }}
					</div>
					<div v-if="syncUserId" class="mt-1 text-xs text-gray-500">
						UID: {{ syncUserId }}
					</div>
					<div class="mt-1">
						{{ t('sync.status_last_sync_prefix') }} {{ syncLastSyncLabel }}
					</div>
					<div v-if="syncDirty" class="mt-1 text-amber-700">
						{{ t('sync.status_dirty') }}
					</div>
					<div v-if="syncSourceChoiceRequired" class="mt-1 text-amber-700">
						{{ t('sync.status_source_choice_required') }}
					</div>
					<div v-if="syncStatus" class="mt-1 text-gray-600">
						{{ syncStatus }}
					</div>
					<div v-if="syncLastErrorAt" class="mt-1 text-xs text-gray-500">
						{{ new Date(syncLastErrorAt).toLocaleString() }}
					</div>
				</div>

				<div
					v-if="syncError"
					class="mt-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
				>
					{{ syncError }}
				</div>

				<div class="mt-4 flex flex-col gap-3 sm:flex-row">
					<button
						class="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
						:disabled="syncBusy || syncServerUrl.trim().length === 0"
						@click="onConnectNextcloud"
					>
						{{ t('sync.connect') }}
					</button>
					<button
						class="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
						:disabled="syncBusy || !hasStoredSyncSecret || syncSourceChoiceRequired"
						@click="onSyncNow"
					>
						{{ t('sync.sync_now') }}
					</button>
					<button
						v-if="syncSourceChoiceRequired"
						class="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
						:disabled="syncBusy || !hasStoredSyncSecret"
						@click="openSourceChoiceDialog()"
					>
						{{ t('sync.choose_source') }}
					</button>
					<button
						class="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						:disabled="syncBusy || !hasStoredSyncSecret"
						@click="showDisconnectConfirm = true"
					>
						{{ t('sync.disconnect') }}
					</button>
				</div>
			</div>
		</div>

		<div class="mt-6">
			<h2 class="text-xl font-bold mb-3">{{ t('settings.database_title') }}</h2>
			<div class="flex flex-col gap-3 sm:flex-row">
				<button
					class="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
					@click="onImportDatabase"
				>
					{{ t('settings.database_import') }}
				</button>
				<button
					class="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
					@click="onExportDatabase"
				>
					{{ t('settings.database_export') }}
				</button>

			</div>
		</div>
	
	</div>

	<ConfirmDialog
		v-model="showImportConfirm"
		:title="t('settings.database_import_prompt_title')"
		:message="t('settings.database_import_prompt_message')"
		:confirm-text="t('settings.database_import_replace')"
		:secondary-text="t('settings.database_import_append')"
		@cancel="cancelImport"
		@confirm="replaceImport"
		@secondary="appendImport"

	/>

	<ConfirmDialog
		v-model="showExportDialog"
		:title="exportDialogTitle"
		:message="exportDialogMessage"
		:confirm-text="t('settings.dialog_ok')"
		:show-cancel="false"
	/>

	<ConfirmDialog
		v-model="showDisconnectConfirm"
		:title="t('sync.disconnect_title')"
		:message="t('sync.disconnect_message')"
		:confirm-text="t('sync.disconnect_confirm')"
		:cancel-text="t('settings.database_import_cancel')"
		@confirm="onDisconnectNextcloud"
	/>

	<ConfirmDialog
		v-model="showSourceChoiceDialog"
		:title="t('sync.source_choice_title')"
		:message="sourceChoiceMessage"
		:confirm-text="t('sync.source_choice_use_remote')"
		:secondary-text="t('sync.source_choice_use_local')"
		:cancel-text="t('settings.database_import_cancel')"
		:close-on-backdrop="false"
		@confirm="onChooseRemoteSource"
		@secondary="onChooseLocalSource"
		@cancel="onCancelSourceChoice"
	/>

	<ConfirmDialog
		v-model="showSourceChoiceConfirm"
		:title="sourceChoiceConfirmTitle"
		:message="sourceChoiceConfirmMessage"
		:confirm-text="t('sync.source_choice_confirm_button')"
		:cancel-text="t('settings.database_import_cancel')"
		:close-on-backdrop="false"
		@confirm="onConfirmSourceChoice"
		@cancel="onCancelSourceChoiceConfirm"
	/>
</template>
