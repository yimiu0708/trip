import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // MapLibre is intentionally isolated as an async route chunk; warn only above that known map payload.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor'
            }
            if (id.includes('maplibre-gl')) {
              return 'map-vendor'
            }
            if (id.includes('echarts') || id.includes('zrender')) {
              return 'chart-vendor'
            }
            if (id.includes('lucide-react')) {
              return 'ui-vendor'
            }
            return 'vendor'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
