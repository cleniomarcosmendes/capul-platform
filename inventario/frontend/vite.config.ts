import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/inventario/',
  server: {
    port: 5174,
    host: '0.0.0.0',
    proxy: {
      '/api/v1/auth': 'http://localhost:3000',
      '/api/v1/core': 'http://localhost:3000',
      '/api/v1/inventory': 'http://localhost:8000',
      '/api/v1/products': 'http://localhost:8000',
      '/api/v1/sync': 'http://localhost:8000',
      '/api/v1/integration': 'http://localhost:8000',
      '/api/v1/import': 'http://localhost:8000',
      '/api/v1/warehouses': 'http://localhost:8000',
      '/api/v1/assignments': 'http://localhost:8000',
      '/api/v1/cycles': 'http://localhost:8000',
      '/api/v1/lot-draft': 'http://localhost:8000',
      '/api/v1/validation': 'http://localhost:8000',
      '/api/v1/monitoring': 'http://localhost:8000',
      '/api/v1/counting-lists': 'http://localhost:8000',
      '/api/v1/dashboard': 'http://localhost:8000',
      '/api/v1/reports': 'http://localhost:8000',
    },
  },
})
