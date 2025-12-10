import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  envDir: '..', // Read .env from root directory (shared with backend)
  server: {
    port: 3001
  }
})
