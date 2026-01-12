import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    base: './',
    build: {
        outDir: 'dist',
    },
    server: {
        port: 5173,
        strictPort: true,
        hmr: {
            protocol: 'ws',
            host: 'localhost',
            port: 5173,
        },
    },
});
