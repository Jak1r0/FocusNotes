import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const entry = (name: string) => fileURLToPath(new URL(name, import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: { main: entry('index.html'), widget: entry('widget.html') },
    },
  },
})
