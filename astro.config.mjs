import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  session: false,
  server: {
    port: 4000,
    host: true
  },
  security: {
    checkOrigin: false
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: true
    }
  }
})
