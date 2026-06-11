import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const backendUrl = env.VITE_BACKEND_URL;

    if (!backendUrl) {
        throw new Error('VITE_BACKEND_URL is required. Set it in .env or your shell environment.');
    }

    return {
        plugins: [react()],
        define: {
            global: 'globalThis',
        },
        server: {
            port: 8000,
            host: true,
            proxy: {
                '/api': {
                    target: backendUrl,
                    changeOrigin: true,
                },
                '/ws': {
                    target: backendUrl,
                    changeOrigin: true,
                    ws: true,
                },
                '/uploads': {
                    target: backendUrl,
                    changeOrigin: true,
                },
            },
        },
    };
});
