import { buildApp } from './app'

const app = buildApp()

app.listen({ port: 3001, host: '0.0.0.0' }).then(() => {
  console.log('API ready on http://localhost:3001')
})
