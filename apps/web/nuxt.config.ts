// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devProxy: {
    '/api': { target: 'http://localhost:3001', changeOrigin: true },
  }
})
