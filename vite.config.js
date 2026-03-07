import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Vercel reads from dist/ by default with Vite
  build: {
    outDir: 'dist',
  },
})
