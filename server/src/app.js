import express from 'express'

// Normal startup supplies the real database pool.
// Tests can supply controlled substitutes for the database and HTTP calls.
export function createApp({ pool, fetch = globalThis.fetch }) {
  const app = express()
  const summarizerUrl = 'http://127.0.0.1:8000/summarize'


app.disable('x-powered-by')

// Parse JSON requests with a separate limit on the HTTP body size.
app.use(express.json({ limit: '256kb', strict: false }))

app.get('/api/health', (_request, response) => {
  response.set('Cache-Control', 'no-store')

  response.json({
    status: 'ok',
    service: 'textrank-web-api',
  })
})

app.post('/api/summarize', async (request, response) => {
  response.set('Cache-Control', 'no-store')

  if (!request.is('application/json')) {
    return response.status(415).json({
      detail: 'Content-Type must be application/json.',
    })
  }

  const input = request.body

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return response.status(422).json({
      detail: 'The request body must be a JSON object.',
    })
  }

  // Limit how long Node waits for the Python service.
  const signal = AbortSignal.timeout(10_000)

  try {
    const upstream = await fetch(summarizerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal,
      redirect: 'error',
    })

    const data = await upstream.json()

    // Python remains responsible for the summarization input schema.
    if (!upstream.ok) {
      if (upstream.status === 400 || upstream.status === 422) {
        return response.status(upstream.status).json({
          detail: data?.detail ?? 'Invalid summarization input.',
        })
      }

      return response.status(502).json({
        detail: 'The Python summarizer returned an error.',
      })
    }

    // Check the response before passing it to our client.
    if (
      typeof data?.summary !== 'string' ||
      !data.summary.trim() ||
      !Number.isInteger(data.original_sentence_count) ||
      !Number.isInteger(data.selected_sentence_count) ||
      data.original_sentence_count < 1 ||
      data.selected_sentence_count < 1 ||
      data.selected_sentence_count > data.original_sentence_count
    ) {
      return response.status(502).json({
        detail: 'The Python summarizer returned an invalid response.',
      })
    }

    return response.json({
      summary: data.summary,
      original_sentence_count: data.original_sentence_count,
      selected_sentence_count: data.selected_sentence_count,
    })
  } catch (error) {
    console.error('Summarizer request failed:', error.name)

    return response.status(signal.aborted ? 504 : 502).json({
      detail: signal.aborted
        ? 'The Python summarizer did not respond within 10 seconds.'
        : 'The Python summarizer is unavailable or returned invalid JSON.',
    })
  }
})

// Save a summary submitted by the client.
app.post('/api/summaries', async (request, response) => {
  response.set('Cache-Control', 'no-store')

  if (!request.is('application/json')) {
    return response.status(415).json({
      detail: 'Content-Type must be application/json.',
    })
  }

  const input = request.body

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return response.status(422).json({
      detail: 'The request body must be a JSON object.',
    })
  }

  const allowedFields = [
    'source_text',
    'summary',
    'original_sentence_count',
    'selected_sentence_count',
  ]

  if (Object.keys(input).some((key) => !allowedFields.includes(key))) {
    return response.status(422).json({
      detail: 'The request contains unexpected fields.',
    })
  }

  if (
    typeof input.source_text !== 'string' ||
    typeof input.summary !== 'string'
  ) {
    return response.status(422).json({
      detail: 'source_text and summary must be strings.',
    })
  }

  const sourceText = input.source_text.trim()
  const summaryText = input.summary.trim()

  // Count Unicode characters rather than JavaScript UTF-16 code units.
  const sourceLength = Array.from(sourceText).length
  const summaryLength = Array.from(summaryText).length

  if (
    sourceLength < 1 ||
    sourceLength > 50_000 ||
    summaryLength < 1 ||
    summaryLength > 50_000 ||
    sourceText.includes('\u0000') ||
    summaryText.includes('\u0000')
  ) {
    return response.status(422).json({
      detail:
        'Text fields must contain 1–50,000 characters and no null characters.',
    })
  }

  const originalCount = input.original_sentence_count
  const selectedCount = input.selected_sentence_count

  if (
    !Number.isInteger(originalCount) ||
    originalCount < 1 ||
    originalCount > sourceLength ||
    !Number.isInteger(selectedCount) ||
    selectedCount < 1 ||
    selectedCount > 20 ||
    selectedCount > originalCount
  ) {
    return response.status(422).json({
      detail:
        'Invalid sentence counts. Select 1–20 sentences, no more than the original count.',
    })
  }

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO public.saved_summaries (
          source_text,
          summary,
          original_sentence_count,
          selected_sentence_count
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          summary,
          original_sentence_count,
          selected_sentence_count,
          created_at
      `,
      [sourceText, summaryText, originalCount, selectedCount],
    )

    return response.status(201).json({
      saved_summary: rows[0],
    })
  } catch (error) {
    console.error(
      'Could not save summary:',
      error.code ?? 'UNKNOWN',
    )

    return response.status(500).json({
      detail: 'Could not save the summary. Please try again.',
    })
  }
})
// Delete one saved summary by its unique ID.
// This remains a local, single-user API without per-user authorization.
app.delete('/api/summaries/:id', async (request, response) => {
  response.set('Cache-Control', 'no-store')

  const { id } = request.params
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (
    typeof id !== 'string' ||
    id.length !== 36 ||
    !uuidPattern.test(id)
  ) {
    return response.status(400).json({
      detail: 'Summary ID must be a valid UUID.',
    })
  }

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM public.saved_summaries WHERE id = $1::uuid',
      [id],
    )

    if (rowCount === 0) {
      return response.status(404).json({
        detail: 'Saved summary not found.',
      })
    }

    // Successful deletion: deliberately return no response body.
    return response.status(204).end()
  } catch (error) {
    console.error(
      'Could not delete saved summary:',
      error.code ?? 'UNKNOWN',
    )

    return response.status(500).json({
      detail: 'Could not delete the saved summary. Please try again.',
    })
  }
})
// Read the 20 newest saved summaries.
app.get('/api/summaries', async (_request, response) => {
  response.set('Cache-Control', 'no-store')

  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        summary,
        original_sentence_count,
        selected_sentence_count,
        created_at
      FROM public.saved_summaries
      ORDER BY created_at DESC, id DESC
      LIMIT 20
    `)

    return response.json({
      summaries: rows,
    })
  } catch (error) {
    console.error(
      'Could not load saved summaries:',
      error.code ?? 'UNKNOWN',
    )

    return response.status(500).json({
      detail: 'Could not load saved summaries. Please try again.',
    })
  }
})

app.use((_request, response) => {
  response.status(404).json({
    detail: 'Route not found',
  })
})

// Express error handlers need all four parameters.
app.use((error, _request, response, next) => {
  if (response.headersSent) return next(error)

  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({
      detail: 'Request body is not valid JSON.',
    })
  }

  if (error.type === 'entity.too.large') {
    return response.status(413).json({
      detail: 'Request body exceeds 256 KiB.',
    })
  }

  if (error.status === 415) {
    return response.status(415).json({
      detail: 'Unsupported request encoding.',
    })
  }

  console.error('Node API error:', error.message)

  return response.status(500).json({
    detail: 'An unexpected server error occurred.',
  })
})

  return app
}