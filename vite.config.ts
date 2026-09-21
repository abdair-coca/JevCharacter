import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const localDecisionFallback = (): Plugin => ({
  name: 'jevling-local-decision-fallback',
  configureServer(server) {
    server.middlewares.use('/api/decide', (request, response, next) => {
      if (request.method !== 'POST') {
        next()
        return
      }

      response.statusCode = 200
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ unavailable: true }))
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localDecisionFallback()],
})
