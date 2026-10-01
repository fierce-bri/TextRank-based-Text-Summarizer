import { useState } from 'react'
import SaveSummary from './SaveSummary.jsx'
import './App.css'

const MAX_TEXT_LENGTH = 50_000

const SENTENCE_OPTIONS = Array.from(
  { length: 20 },
  (_, index) => index + 1,
)

const EXAMPLE_TEXT = [
  'TextRank is a graph-based approach to text summarization.',
  'It represents sentences as nodes in a graph.',
  'Related sentences are connected using similarity scores.',
  'PageRank identifies important sentences within the graph.',
  'The selected sentences form an extractive summary.',
].join(' ')

// Python validation errors can contain either a string or a list.
function getErrorMessage(data, status) {
  if (typeof data?.detail === 'string') {
    return data.detail
  }

  if (Array.isArray(data?.detail)) {
    const messages = data.detail
      .map((item) => item?.msg)
      .filter((message) => typeof message === 'string')

    if (messages.length > 0) {
      return messages.join(' ')
    }
  }

  return `The request failed (HTTP ${status}). Please try again.`
}

export default function App() {
  const [text, setText] = useState('')
  const [sentenceCount, setSentenceCount] = useState(3)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Prevent editing or generating a new result during a save.
  const isBusy = isLoading || isSaving

  function resetFeedback() {
    setResult(null)
    setError('')
  }

  function updateText(value) {
    setText(value)
    resetFeedback()
  }

  async function handleSubmit(event) {
    // Submit through JavaScript instead of refreshing the page.
    event.preventDefault()

    if (isBusy || !text.trim()) {
      return
    }

    // Keep a snapshot of the input used for this request.
    const sourceText = text.trim()
    const requestedCount = sentenceCount

    setIsLoading(true)
    resetFeedback()

    // Allow a little more time than Node's upstream timeout.
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      controller.abort()
    }, 15_000)

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: sourceText,
          sentence_count: requestedCount,
          similarity_threshold: 0.05,
        }),
        signal: controller.signal,
      })

      // A proxy failure might not contain a JSON response.
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(getErrorMessage(data, response.status))
      }

      if (
        typeof data?.summary !== 'string' ||
        !data.summary.trim() ||
        !Number.isInteger(data.original_sentence_count) ||
        !Number.isInteger(data.selected_sentence_count) ||
        data.original_sentence_count < 1 ||
        data.selected_sentence_count < 1 ||
        data.selected_sentence_count > data.original_sentence_count ||
        data.selected_sentence_count > requestedCount
      ) {
        throw new Error('The API returned an unexpected response.')
      }

      // Save the source alongside the result so they stay paired.
      setResult({
        ...data,
        source_text: sourceText,
      })
    } catch (failure) {
      if (controller.signal.aborted) {
        setError('The request took too long. Please try again.')
      } else if (failure instanceof TypeError) {
        setError(
          'Could not reach the API. Check that your servers are running.',
        )
      } else {
        setError(
          failure instanceof Error
            ? failure.message
            : 'Something went wrong. Please try again.',
        )
      }
    } finally {
      window.clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">
          EXTRACTIVE TEXT SUMMARIZATION
        </p>

        <h1>TextRank</h1>

        <p className="subtitle">
          Find the key sentences in your text without rewriting
          the original wording.
        </p>
      </header>

      <div className="workspace">
        <section
          className="panel"
          aria-labelledby="input-heading"
        >
          <h2 id="input-heading">Original text</h2>

          <form onSubmit={handleSubmit}>
            <label htmlFor="source-text">
              Text to summarize
            </label>

            <textarea
              id="source-text"
              name="text"
              rows={12}
              required
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Paste an article, report, or set of notes..."
              value={text}
              onChange={(event) => updateText(event.target.value)}
              disabled={isBusy}
              aria-describedby="text-help"
            />

            <p id="text-help" className="field-note">
              {text.length.toLocaleString()} /{' '}
              {MAX_TEXT_LENGTH.toLocaleString()} characters
            </p>

            <label htmlFor="sentence-count">
              Maximum summary length
            </label>

            <select
              id="sentence-count"
              name="sentence_count"
              value={sentenceCount}
              onChange={(event) => {
                setSentenceCount(Number(event.target.value))
                resetFeedback()
              }}
              disabled={isBusy}
            >
              {SENTENCE_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count} {count === 1 ? 'sentence' : 'sentences'}
                </option>
              ))}
            </select>

            <div className="secondary-actions">
              <button
                type="button"
                onClick={() => updateText(EXAMPLE_TEXT)}
                disabled={isBusy}
              >
                Use example
              </button>

              <button
                type="button"
                onClick={() => updateText('')}
                disabled={isBusy || text.length === 0}
              >
                Clear text
              </button>
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={isBusy || !text.trim()}
            >
              {isLoading ? 'Generating…' : 'Generate summary'}
            </button>

            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}

            <p className="field-note">
              Text is sent to your local summarization service.
              Saving stores both the source text and summary
              in your local database.
            </p>
          </form>
        </section>

        <section
          className="panel"
          aria-labelledby="summary-heading"
        >
          <h2 id="summary-heading">Your summary</h2>

          <div aria-live="polite" aria-atomic="true">
            {isLoading ? (
              <p className="empty-state">
                Generating your summary…
              </p>
            ) : result ? (
              <div>
                <p className="summary-text">
                  {result.summary}
                </p>

                <p className="field-note">
                  Selected {result.selected_sentence_count} of{' '}
                  {result.original_sentence_count} sentences.
                </p>

                <SaveSummary
                  result={result}
                  onSavingChange={setIsSaving}
                />
              </div>
            ) : (
              <p className="empty-state">
                Enter text, choose a summary length, and click
                Generate summary to see the result.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}