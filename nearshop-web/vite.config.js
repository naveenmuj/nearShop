import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://165.232.182.130', changeOrigin: true, timeout: 90000, proxyTimeout: 90000 }
    }
  }
})
