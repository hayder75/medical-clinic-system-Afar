import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.REACT_APP_API_URL': JSON.stringify(process.env.REACT_APP_API_URL || ''),
  },
  server: {
    host: 'localhost',
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  preview: {
    host: 'localhost',
    port: 3000
  }
})
