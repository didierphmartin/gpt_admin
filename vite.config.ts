import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so the built app works when Apache serves it from
  // /gpt_admin/dist/ (the root index/affiliate .html stay as Vite build inputs).
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        affiliate: resolve(__dirname, 'affiliate.html'),
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/gpt/backend': {
        target: 'http://localhost',
        changeOrigin: true,
      },
      '/PortfolioManagement/backend': {
        target: 'http://localhost',
        changeOrigin: true,
      },
      '/LandingPage/Ledger': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
})
