import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import story from './story/plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), story()],
  server: {
    // dev: React(5173) -> Spring Boot(8080)
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
