import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // ⚠️ 반드시 5173 이어야 한다. 없으면 vite 가 **조용히 5174 로 밀려나는데,
    //    5174 는 백엔드 포트다.** 그러면 아래 프록시가 자기 자신을 부른다:
    //      브라우저 → vite(5173) → localhost:5174 → (IPv6 ::1 을 먼저 잡아) vite
    //      → 다시 localhost:5174 → … 무한 루프
    //    2026-08-06 실측 — 요청 1건에 소켓 27,754개가 생겨 Windows 임시 포트
    //    16,384개가 고갈됐고, 모든 API 가 60~150초 뒤 500 이 됐다.
    //    포트가 막혔으면 조용히 옮겨가지 말고 **그냥 실패하는 게 낫다.**
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        // `localhost` 가 아니라 **127.0.0.1** 이다. Node 는 localhost 를 IPv6(::1)
        // 부터 해석하는데 백엔드(Flask)는 0.0.0.0, 즉 IPv4 만 듣는다.
        // localhost 로 두면 ::1 을 먼저 두드리느라 요청마다 수 초씩 새고,
        // 무엇보다 ::1:5174 에 다른 것이 붙으면 위의 루프가 성립한다.
        target: 'http://127.0.0.1:5174',
        changeOrigin: true,
        timeout: 600000,  // 10분 타임아웃
        proxyTimeout: 600000
      },
      '/llm': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/llm/, ''),
        timeout: 300000,  // 5분 타임아웃 (LLM 응답 대기)
        proxyTimeout: 300000,
        // SSE 스트리밍 지원: 프록시 버퍼링 비활성화
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const ct = proxyRes.headers['content-type'] || '';
            if (ct.includes('text/event-stream') || ct.includes('text/plain')) {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
