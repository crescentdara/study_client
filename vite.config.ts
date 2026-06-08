import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite 설정 파일
 *
 * Vite는 빠른 개발 서버와 번들러입니다.
 * Create React App(CRA)보다 훨씬 빠른 개발 경험을 제공합니다.
 *
 * proxy 설정:
 * 개발 환경에서 /api 와 /ws 로 시작하는 요청을
 * 백엔드 서버(localhost:9090)로 자동으로 전달합니다.
 * → CORS 없이 동일 출처처럼 동작하게 해주는 개발 편의 기능
 */
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const backendUrl = env.VITE_BACKEND_URL;

    if (!backendUrl) {
        throw new Error('VITE_BACKEND_URL is required. Set it in .env or your shell environment.');
    }

    return {
        plugins: [react()],
        // sockjs-client가 브라우저에 없는 Node.js의 global 변수를 참조하므로
        // globalThis(브라우저 전역 객체)로 대체해줍니다.
        define: {
            global: 'globalThis',
        },
        server: {
            port: 8000,
            host: true, // 0.0.0.0 바인딩 → 같은 네트워크의 다른 기기에서 IP로 접근 가능
            proxy: {
                // REST API 프록시
                '/api': {
                    target: backendUrl,
                    changeOrigin: true,
                },
                // WebSocket 프록시 (SockJS 포함)
                '/ws': {
                    target: backendUrl,
                    changeOrigin: true,
                    ws: true, // WebSocket 프록시 활성화
                },
            },
        },
    };
});
