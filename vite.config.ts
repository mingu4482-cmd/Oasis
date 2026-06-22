import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createHtmlPlugin } from 'vite-plugin-html';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      createHtmlPlugin({
        inject: {
          data: {
            VITE_KAKAO_MAP_KEY: env.VITE_KAKAO_MAP_KEY,
          },
        },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://127.0.0.1:4000',
      },
    },
  };
});