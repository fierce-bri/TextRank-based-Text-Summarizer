import pg from 'pg'

const { Pool } = pg

const requiredSettings = [
  'PGHOST',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
]

for (const name of requiredSettings) {
  if (!process.env[name]) {
    throw new Error(
      `Missing ${name}. Start the server with its .env file loaded.`,
    )
  }
}

// One shared pool for this Node process, not a new pool per request.
// Connection credentials come from the PG... environment variables.
export const pool = new Pool({
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
  query_timeout: 7_000,
  application_name: 'textrank-web-api',
})

// Handle connection errors that happen while a connection is idle.
// Log the error code, not credentials or submitted text.
pool.on('error', (error) => {
  console.error(
    'Idle database connection failed:',
    error.code ?? 'UNKNOWN',
  )
})