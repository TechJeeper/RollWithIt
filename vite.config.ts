import { defineConfig } from 'vite'

// Relative base so GitHub Pages works from a project or user site.
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 43123,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 43123,
    strictPort: true,
  },
})
