import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/configurador/',
  server: {
    port: 5175,
    host: '0.0.0.0',
    proxy: {
      '/api/v1/auth': 'http://localhost:3000',
      '/api/v1/core': 'http://localhost:3000',
    },
  },
})
