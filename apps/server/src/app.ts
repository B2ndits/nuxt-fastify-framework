import Fastify from 'fastify'

export function buildApp() {
  const app = Fastify({ logger: true })

  app.get('/api/ping', async () => ({ ok: true, ts: Date.now() }))

  return app
}
