<script lang="ts" setup>
import fs = require('fs');
import { ref } from 'vue';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const count = ref(0);
</script>

<template>
	<h1>Hello {{ packageJson.name }}</h1>
	<button @click="count++">{{ count }}</button>
</template>
