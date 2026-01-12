<script lang="ts" setup>
import { ref } from 'vue';


const count = ref(0);
</script>

<template>
	<h1 class="text-3xl font-bold">Home Page</h1>
	<button class="mt-4 px-4 py-2 bg-blue-500 text-white rounded" @click="count++">{{ count }}</button>
</template>
