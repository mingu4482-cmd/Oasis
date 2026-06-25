<<<<<<< HEAD
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
=======
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
>>>>>>> 8fa67d1b9403662f98aa466c5957121fc1ddb55d

export default defineConfig({
  plugins: [react()],
  server: {
<<<<<<< HEAD
    // 🌟 핵심: Cesium 파일들을 Vite의 간섭에서 완전히 제외하기
    fs: {
      strict: false,
      allow: ['..'] 
    },
    proxy: {
      '/vworld-api': {
        target: 'https://api.vworld.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vworld-api/, '') 
      }
    }
=======
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
>>>>>>> 8fa67d1b9403662f98aa466c5957121fc1ddb55d
  },
  // 워커 관련 설정을 한 번 더 강화
  worker: {
    format: 'es'
  }
})