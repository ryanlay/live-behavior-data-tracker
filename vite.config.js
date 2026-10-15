import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project-site path: https://<user>.github.io/live-behavior-data-tracker/
export default defineConfig({
  base: '/live-behavior-data-tracker/',
  plugins: [react()],
})
