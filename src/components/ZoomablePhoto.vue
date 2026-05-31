<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';
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
	}>(),
	{
		ariaLabel: '',
		imageClass: '',
		disabled: false,
	},
);

const { t } = useI18n();

const naturalWidth = ref(0);
const naturalHeight = ref(0);

let activeViewer: PhotoSwipe | null = null;
let measurementToken = 0;

const closeViewer = () => {
	activeViewer?.close();
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
		type="button"
		class="group block w-full cursor-zoom-in overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-default"
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
</template>

<style>
.journalitea-photo-viewer .pswp__top-bar {
	box-sizing: border-box;
	height: calc(60px + env(safe-area-inset-top) + 0.5rem);
	padding-top: calc(env(safe-area-inset-top) + 0.5rem);
	padding-left: calc(env(safe-area-inset-left) + 0.5rem);
	padding-right: calc(env(safe-area-inset-right) + 0.5rem);
}
</style>