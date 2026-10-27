import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Renderer is bundled into static assets and loaded from disk by Electron (file://).
// base: './' is required so asset URLs stay relative.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5273, strictPort: true },
})
