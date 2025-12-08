import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  envDir: '..', // Read .env from root directory (shared with backend)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // backend address
        changeOrigin: true,
      }
    }
  }
})
