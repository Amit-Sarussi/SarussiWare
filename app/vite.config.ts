import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// When running in Docker, load env from a dir without .env so app/.env doesn't override APP_DATABASE_URL
const envDir = process.env.APP_DATABASE_URL ? path.join(__dirname, 'src') : undefined

// https://vite.dev/config/
export default defineConfig({
  envDir,
  plugins: [
    vue(),
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
