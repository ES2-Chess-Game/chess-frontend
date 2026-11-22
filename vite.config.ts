import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.CHESS_API_URL ?? 'http://127.0.0.1:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (outgoing, incoming) => {
            if (incoming.headers.origin === `http://${incoming.headers.host}`) {
              outgoing.setHeader('Origin', backend)
            }
          })
        },
      },
    },
  },
})
