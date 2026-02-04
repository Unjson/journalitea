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
	const ver = await platformBridge.invoke('app:getVersion');
	version.value = ver;
});

</script>

<template>
	<h1 class="text-3xl font-bold">{{ t('aboutPage.title') }}</h1>
	<div class="mt-4">
		Journalitea is free software, licensed under the <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank" class="text-blue-600 hover:underline" @click.prevent="openExternal('https://www.gnu.org/licenses/gpl-3.0.en.html')">GNU GPL v3.0</a>. 
		The complete source code can be found through the link below:
		<div class="mt-2 mb-2">
		<a href="https://github.com/Unjson/journalitea" target="_blank" class="text-blue-600 hover:underline" @click.prevent="openExternal('https://github.com/Unjson/journalitea')">GitHub</a>
		</div>
		I made Journalitea because I wanted to build it, not because I am trying to make any money off of it. 
		If you like the app, I encourage you to also build things you enjoy making and share them with the community.
	</div>

	<div class="mt-4">
		Code: <b>Jonas Hundertmark</b><br />
		Design & Art: <b>Roewna Strack</b>
	</div>


	
	<div class="mt-4 justify-end-safe">
		{{ t('aboutPage.versionNumber') }}: <b>{{ version }}</b>
	</div>

</template>
