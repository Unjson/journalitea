<script lang="ts" setup>
import fs = require('fs');
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

const electron = window.require("electron");
const router = useRouter();
const sidebarCollapsed = ref(false);

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

onMounted(() => {
  electron.ipcRenderer.on('goToHome', () => {
    router.push('/');
  });
	electron.ipcRenderer.on('goToAbout', () => {
    router.push('/about');
	});
	electron.ipcRenderer.on('goToRecordsList', () => {
	router.push('/records-list');
	});
});

</script>

<template>
	<div id="app" class="flex h-screen">
		<!-- Sidebar -->
		<aside 
			:class="['sidebar', { 'collapsed': sidebarCollapsed }]"
			class="bg-gray-800 text-white transition-all duration-300"
		>
			<button 
				@click="toggleSidebar" 
				class="toggle-btn absolute -right-3 top-4 bg-gray-700 hover:bg-gray-600 rounded-full w-6 h-6 flex items-center justify-center"
			>
				<span v-if="sidebarCollapsed">→</span>
				<span v-else>←</span>
			</button>
			
			<div class="sidebar-content p-4">
				<h2 v-if="!sidebarCollapsed" class="text-xl font-bold mb-6">Navigation</h2>
				
				<nav class="flex flex-col gap-2">
					<router-link 
						to="/" 
						class="nav-link flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 transition-colors"
					>
						<span class="text-lg">🏠</span>
						<span v-if="!sidebarCollapsed">Home</span>
					</router-link>
					<router-link 
						to="/about" 
						class="nav-link flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 transition-colors"
					>
						<span class="text-lg">ℹ️</span>
						<span v-if="!sidebarCollapsed">About</span>
					</router-link>
					<router-link 
						to="/records-list" 
						class="nav-link flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 transition-colors"
					>
						<span class="text-lg">📋</span>
						<span v-if="!sidebarCollapsed">Records List</span>
					</router-link>
				</nav>
			</div>
		</aside>

		<!-- Main Content -->
		<main class="flex-1 overflow-auto">
			<header class="bg-white shadow p-4">
				<h1 class="text-3xl font-bold">Hello {{ packageJson.name }}</h1>
			</header>
			<div class="p-6">
				<router-view/>
			</div>
		</main>
	</div>
</template>

<style scoped>
.sidebar {
	width: 250px;
	position: relative;
	min-height: 100vh;
}

.sidebar.collapsed {
	width: 70px;
}

.toggle-btn {
	z-index: 10;
}

.nav-link {
	text-decoration: none;
	color: inherit;
}

.nav-link.router-link-active {
	background-color: #374151;
	font-weight: 600;
}
</style>
