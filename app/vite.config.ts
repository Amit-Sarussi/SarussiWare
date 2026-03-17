import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env from project root so a single .env is used for the whole project
const envDir = path.join(__dirname, '..')

// https://vite.dev/config/
export default defineConfig({
  envDir,
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: 'api',
      async configureServer(server) {
        const { apiMiddleware } = await import('./server/api.js')
        server.middlewares.use(apiMiddleware)
      },
    },
  ],
  server: {
    port: 3000,
    host: true, // listen on 0.0.0.0 so Docker can forward to host
    hmr: {
      host: 'localhost',
      port: 3000,
      protocol: 'ws',
    },
    watch: {
      usePolling: true, // required for file changes to be seen inside Docker bind mounts
    },
  },
})
