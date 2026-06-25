import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
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
  },
  // 워커 관련 설정을 한 번 더 강화
  worker: {
    format: 'es'
  }
})