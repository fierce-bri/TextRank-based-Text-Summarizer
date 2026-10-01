import express from 'express'

const app = express()
const host = '127.0.0.1'
const port = Number(process.env.PORT ?? 3001)
const summarizerUrl = 'http://127.0.0.1:8000/summarize'

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}

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

const server = app.listen(port, host)

server.on('listening', () => {
  console.log(`TextRank Node API listening at http://${host}:${port}`)
})

server.on('error', (error) => {
  console.error(`Could not start the Node API: ${error.message}`)
  process.exitCode = 1
})