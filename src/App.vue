<script lang="ts" setup>
import fs = require('fs');
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

const electron = window.require("electron");
const router = useRouter();

onMounted(() => {
  electron.ipcRenderer.on('goToHome', () => {
    router.push('/');
  });
	electron.ipcRenderer.on('goToAbout', () => {
	console.log('navigating to about');
    router.push('/about');
  });
});

</script>

<template>
	<h1 class="text-3xl font-bold">Hello {{ packageJson.name }}</h1>
	<div id="app">
    <div id="nav">
      <router-link class="nav-link" to="/">Home</router-link> |
      <router-link class="nav-link" to="/about">About</router-link>
    </div>
    <router-view/>
  </div>
</template>
