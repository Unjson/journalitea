<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { platformBridge } from '../services/platformBridge';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const version = ref<string>('devel');
const openExternal = async (url: string) => {
	try {
		await platformBridge.openExternal(url);
	} catch (error) {
		console.warn('Failed to open external URL', error);
	}
};

onMounted(async() => {
	version.value = await platformBridge.invoke('app:getVersion');;
});

</script>

<template>
	<div class="h-4 mt-4">
		<h1 class="text-3xl font-bold">{{ t('about.title') }}</h1>
		<div class="mt-4">
			{{ t('about.body1') }} <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank" class="app-link" @click.prevent="openExternal('https://www.gnu.org/licenses/gpl-3.0.en.html')">GNU GPL v3.0</a>.<br />
			{{ t('about.body2') }}
			<div class="mt-2 mb-2">
			<a href="https://github.com/Unjson/journalitea" target="_blank" class="app-link" @click.prevent="openExternal('https://github.com/Unjson/journalitea')">GitHub</a>
			</div>
			{{ t('about.body3') }} 
		</div>

		<div class="mt-4">
			Code: <b>Jonas Hundertmark</b><br />
			Design: <b>Roewna Strack</b>
		</div>

		<div class="mt-4">
			{{ t('about.fonts') }}<br />
			Ahellya: <b><a href="https://www.behance.net/string4" target="_blank" class="app-link" @click.prevent="openExternal('https://www.behance.net/string4')">Dmytro Barsukov</a></b><br />
			Min Sans: <b><a href="https://github.com/poposnail61" target="_blank" class="app-link" @click.prevent="openExternal('https://github.com/poposnail61')">Jinseong Kim</a> &amp; <a href="https://github.com/partrita" target="_blank" class="app-link" @click.prevent="openExternal('https://github.com/partrita')">Taeyoon Kim</a></b>
		</div>

		
		<div class="mt-4 justify-end-safe">
			{{ t('about.versionNumber') }}: <b>{{ version }}</b>
		</div>
	</div>
</template>
