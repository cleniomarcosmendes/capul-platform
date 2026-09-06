import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/gestao-pessoas/',
  server: {
    port: 5178,
    host: '0.0.0.0',
    proxy: {
      '/api/v1/auth': 'http://localhost:3000',
      '/api/v1/core': 'http://localhost:3000',
      '/api/v1/gestao-pessoas': 'http://localhost:3004',
    },
  },
});
