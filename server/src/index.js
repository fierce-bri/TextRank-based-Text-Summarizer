import { createApp } from './app.js'
import { pool } from './db.js'

const host = '127.0.0.1'
const port = Number(process.env.PORT ?? 3001)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}

// Supply the real database pool when running the application normally.
const app = createApp({ pool })

const server = app.listen(port, host)

server.on('listening', () => {
  console.log(`TextRank Node API listening at http://${host}:${port}`)
})

server.on('error', (error) => {
  console.error(`Could not start the Node API: ${error.message}`)
  process.exitCode = 1
})