<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { platformBridge } from '../services/platformBridge';

const version = ref<string>('devel');

onMounted(async() => {
	const ver = await platformBridge.invoke('app:getVersion');
	version.value = ver;
});

</script>

<template>
	<h1 class="text-3xl font-bold">About Page</h1>
	<span>Version number: {{ version }}</span>
</template>
