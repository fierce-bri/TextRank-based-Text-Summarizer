import pg from 'pg'

const { Client } = pg

// Connection details come from the PG... environment variables.
const client = new Client({
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
  query_timeout: 7_000,
  application_name: 'textrank-db-check',
})

function reportError(error) {
  console.error(
    `Database check failed [${error.code ?? 'ERROR'}]: ${error.message}`,
  )
  process.exitCode = 1
}

// Handle an unexpected connection loss.
client.on('error', reportError)

try {
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
        `Missing ${name}. Check server/.env and use the --env-file option.`,
      )
    }
  }

  await client.connect()

  const { rows } = await client.query(`
    SELECT
      current_user AS database_user,
      current_database() AS database_name
  `)

  const { database_user, database_name } = rows[0]

  if (
    database_user !== 'textrank_app' ||
    database_name !== 'textrank'
  ) {
    throw new Error(
      'Expected the textrank_app account and textrank database. Check server/.env.',
    )
  }

  // Verify that the table exists and this account can read it.
  // The check also succeeds when the table is empty.
  await client.query('SELECT id FROM public.saved_summaries LIMIT 1')

  console.table(rows)
  console.log('Database check passed: saved_summaries is readable.')
} catch (error) {
  reportError(error)
} finally {
  await client.end()
}