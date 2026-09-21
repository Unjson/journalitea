<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';
import ConfirmDialog from './ConfirmDialog.vue';
import { photoService } from '../services/photoService';
import {
	clearActivePhotoViewer,
	registerActivePhotoViewer,
} from '../services/photoViewerState';

const FALLBACK_IMAGE_WIDTH = 1600;
const FALLBACK_IMAGE_HEIGHT = 1200;

const props = withDefaults(
	defineProps<{
		src: string;
		alt: string;
		ariaLabel?: string;
		imageClass?: string;
		disabled?: boolean;
		photoPath?: string;
	}>(),
	{
		ariaLabel: '',
		imageClass: '',
		disabled: false,
		photoPath: '',
	},
);

const { t } = useI18n();

const naturalWidth = ref(0);
const naturalHeight = ref(0);
const isSavingPhoto = ref(false);
const showSaveDialog = ref(false);
const saveDialogTitle = ref('');
const saveDialogMessage = ref('');

let activeViewer: PhotoSwipe | null = null;
let measurementToken = 0;

const closeViewer = () => {
	activeViewer?.close();
};

const saveCurrentPhoto = async () => {
	const photoPath = props.photoPath.trim();
	if (!photoPath || isSavingPhoto.value) {
		return;
	}

	isSavingPhoto.value = true;
	let showResultDialog = false;

	try {
		const result = await photoService.saveToDownloads(photoPath);
		if ('cancelled' in result && result.cancelled) {
			return;
		}
		if (!('success' in result) || result.success !== true) {
		}

		const savedLocation = result.location === 'Downloads'
			? t('photo.downloads_location')
			: String(result.location ?? result.path ?? t('photo.downloads_location'));
		saveDialogTitle.value = t('photo.save_success_title');
		saveDialogMessage.value = t('photo.save_success_message', { path: savedLocation });
		showResultDialog = true;
	} catch (error) {
		const details = error instanceof Error ? error.message : t('photo.save_error');
		saveDialogTitle.value = t('photo.save_error_title');
		saveDialogMessage.value = `${t('photo.save_error')}\n${details}`;
		showResultDialog = true;
	} finally {
		isSavingPhoto.value = false;
		if (showResultDialog) {
			closeViewer();
			showSaveDialog.value = true;
		}
	}
};

watch(
	() => props.src,
	() => {
		measurementToken += 1;
		naturalWidth.value = 0;
		naturalHeight.value = 0;
	},
);

const handleImageLoad = (event: Event) => {
	const target = event.target;
	if (!(target instanceof HTMLImageElement)) {
		return;
	}

	naturalWidth.value = target.naturalWidth || FALLBACK_IMAGE_WIDTH;
	naturalHeight.value = target.naturalHeight || FALLBACK_IMAGE_HEIGHT;
};

const ensureImageDimensions = async () => {
	if (naturalWidth.value > 0 && naturalHeight.value > 0) {
		return;
	}

	const nextSrc = props.src.trim();
	if (!nextSrc) {
		naturalWidth.value = FALLBACK_IMAGE_WIDTH;
		naturalHeight.value = FALLBACK_IMAGE_HEIGHT;
		return;
	}

	const currentToken = ++measurementToken;
	await new Promise<void>((resolve) => {
		const image = new Image();
		image.onload = () => {
			if (currentToken === measurementToken) {
				naturalWidth.value = image.naturalWidth || FALLBACK_IMAGE_WIDTH;
				naturalHeight.value = image.naturalHeight || FALLBACK_IMAGE_HEIGHT;
			}
			resolve();
		};
		image.onerror = () => {
			if (currentToken === measurementToken) {
				naturalWidth.value = FALLBACK_IMAGE_WIDTH;
				naturalHeight.value = FALLBACK_IMAGE_HEIGHT;
			}
			resolve();
		};
		image.src = nextSrc;
	});
};

const openViewer = async () => {
	const nextSrc = props.src.trim();
	if (!nextSrc || props.disabled) {
		return;
	}

	await ensureImageDimensions();

	activeViewer?.destroy();
	activeViewer = new PhotoSwipe({
		dataSource: [
			{
				src: nextSrc,
				alt: props.alt,
				w: naturalWidth.value || FALLBACK_IMAGE_WIDTH,
				h: naturalHeight.value || FALLBACK_IMAGE_HEIGHT,
			},
		],
		index: 0,
		mainClass: 'journalitea-photo-viewer',
		bgOpacity: 0.96,
		wheelToZoom: true,
		pinchToClose: true,
		closeOnVerticalDrag: true,
		imageClickAction: 'zoom-or-close',
		tapAction: 'toggle-controls',
		doubleTapAction: 'zoom',
		closeTitle: t('photo.close_viewer'),
		zoomTitle: t('photo.zoom_viewer'),
		errorMsg: t('photo.image_error'),
	});
	activeViewer.on('uiRegister', () => {
		if (!activeViewer || !props.photoPath.trim()) {
			return;
		}

		activeViewer.ui.registerElement({
			name: 'download-button',
			order: 8,
			isButton: true,
			tagName: 'button',
			className: 'pswp__button--download',
			ariaLabel: t('photo.save_to_downloads'),
			title: t('photo.save_to_downloads'),
					html: '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" class="pswp__icn"><path class="pswp__icn-shadow" d="M16 5v15m0 0 5-5m-5 5-5-5M7 27h18"/><path d="M16 5v15m0 0 5-5m-5 5-5-5M7 27h18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>',
			onClick: () => {
				void saveCurrentPhoto();
			},
		});
	});
	registerActivePhotoViewer({ close: closeViewer });
	activeViewer.on('destroy', () => {
		clearActivePhotoViewer();
		activeViewer = null;
	});
	activeViewer.init();
};

onBeforeUnmount(() => {
	clearActivePhotoViewer();
	activeViewer?.destroy();
	activeViewer = null;
});
</script>

<template>
	<button
		v-bind="$attrs"
		type="button"
		class="photo-trigger relative group block w-full cursor-zoom-in overflow-hidden text-left disabled:cursor-default"
		:aria-label="ariaLabel || t('photo.open_viewer')"
		:disabled="disabled || !src.trim()"
		@click="openViewer"
	>
		<img
			:src="src"
			:alt="alt"
			:class="imageClass"
			@load="handleImageLoad"
		/>
		<slot />
	</button>
	<ConfirmDialog
		v-model="showSaveDialog"
		:title="saveDialogTitle"
		:message="saveDialogMessage"
		:confirm-text="t('settings.dialog_close')"
		:show-cancel="false"
		:confirm-neutral="true"
	/>
</template>

<style>
.photo-trigger:focus-visible {
	outline: 2px solid var(--color-focus);
	outline-offset: 2px;
}

.journalitea-photo-viewer .pswp__top-bar {
	box-sizing: border-box;
	height: calc(60px + env(safe-area-inset-top) + 0.5rem);
	padding-top: calc(env(safe-area-inset-top) + 0.5rem);
	padding-left: calc(env(safe-area-inset-left) + 0.5rem);
	padding-right: calc(env(safe-area-inset-right) + 0.5rem);
}

.journalitea-photo-viewer .pswp__top-bar .pswp__button--download {
	box-sizing: border-box;
	width: 50px;
	height: 60px;
	background: none;
	border: 0;
	color: #fff;
	opacity: 0.85;
}

.journalitea-photo-viewer .pswp__top-bar .pswp__button--download:hover,
.journalitea-photo-viewer .pswp__top-bar .pswp__button--download:active,
.journalitea-photo-viewer .pswp__top-bar .pswp__button--download:focus {
	background: none;
	border: 0;
	box-shadow: none;
	color: #fff;
	opacity: 1;
}

.journalitea-photo-viewer .pswp__top-bar .pswp__button--download .pswp__icn {
	color: #fff;
}
</style>