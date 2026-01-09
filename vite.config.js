import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const workerOrigin =
    env.WORKER_ORIGIN || env.VITE_WORKER_ORIGIN || 'http://localhost:8787'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: workerOrigin,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
