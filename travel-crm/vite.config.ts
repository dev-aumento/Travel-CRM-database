import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    open: true,
    hmr: {
      // Keep HMR on Vite when the app is opened through the API port (5000)
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      clientPort: 5173,
    },
    proxy: {
      '/api': {
        // 127.0.0.1 avoids Windows localhost → IPv6 (::1) misses on the IPv4 API
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 120000,
      },
    },
  },
  preview: {
    host: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 120000,
      },
    },
  },
})
