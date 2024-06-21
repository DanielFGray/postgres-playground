import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsPaths(),
  ],
  server: {
    port: 3000,
    proxy: {
      "/auth": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ""),
      },
    },
  },
})
