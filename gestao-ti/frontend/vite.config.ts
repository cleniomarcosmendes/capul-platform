import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/gestao-ti/',
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api/v1/auth': 'http://localhost:3000',
      '/api/v1/core': 'http://localhost:3000',
      '/api/v1/gestao-ti': 'http://localhost:3001',
    },
  },
})
