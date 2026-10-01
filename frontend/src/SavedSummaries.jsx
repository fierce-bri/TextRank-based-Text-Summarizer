import { useEffect, useState } from 'react'
import './SavedSummaries.css'

function isValidSummary(item) {
  return (
    typeof item?.id === 'string' &&
    item.id.length > 0 &&
    typeof item.summary === 'string' &&
    item.summary.trim().length > 0 &&
    Number.isInteger(item.original_sentence_count) &&
    item.original_sentence_count >= 1 &&
    Number.isInteger(item.selected_sentence_count) &&
    item.selected_sentence_count >= 1 &&
    item.selected_sentence_count <= 20 &&
    item.selected_sentence_count <= item.original_sentence_count &&
    typeof item.created_at === 'string' &&
    Number.isFinite(Date.parse(item.created_at))
  )
}

export default function SavedSummaries() {
  const [summaries, setSummaries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    const timeoutId = window.setTimeout(() => {
      controller.abort()
    }, 15_000)

    async function loadHistory() {
      try {
        const response = await fetch('/api/summaries', {
          signal: controller.signal,
          cache: 'no-store',
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            typeof data?.detail === 'string'
              ? data.detail
              : `Could not load history (HTTP ${response.status}).`,
          )
        }

        if (
          !Array.isArray(data?.summaries) ||
          !data.summaries.every(isValidSummary)
        ) {
          throw new Error('The API returned an unexpected history response.')
        }

        if (active) {
          setSummaries(data.summaries)
        }
      } catch (failure) {
        if (!active) return

        if (controller.signal.aborted) {
          setError('Loading history took too long. Try Refresh history.')
        } else if (failure instanceof TypeError) {
          setError('Could not reach the history API. Check the Node server.')
        } else {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not load saved summaries.',
          )
        }
      } finally {
        window.clearTimeout(timeoutId)
        if (active) setIsLoading(false)
      }
    }

    loadHistory()

    // Ignore stale responses and cancel this request on cleanup.
    return () => {
      active = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [refreshCount])

  function refreshHistory() {
    setIsLoading(true)
    setError('')
    setRefreshCount((count) => count + 1)
  }

  return (
    <section
      className="panel history-panel"
      aria-labelledby="history-heading"
    >
      <div className="history-toolbar">
        <h2 id="history-heading">Saved summaries</h2>

        <button
          type="button"
          onClick={refreshHistory}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : 'Refresh history'}
        </button>
      </div>

      <p className="field-note">
        Up to 20 newest saves. Use Refresh history after saving a new summary.
      </p>

      {isLoading && (
        <p className="field-note" role="status">
          Loading saved summaries…
        </p>
      )}

      {error && (
        <p className="error-message" role="alert">{error}</p>
      )}

      {!isLoading && !error && summaries.length === 0 && (
        <p className="field-note" role="status">
          No saved summaries yet. Generate one, save it, then refresh history.
        </p>
      )}

      {!isLoading && !error && summaries.length > 0 && (
        <ul className="history-list">
          {summaries.map((item) => (
            <li key={item.id} className="history-item">
              <p className="field-note">
                <time dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString()}
                </time>
                {' · '}
                Selected {item.selected_sentence_count} of{' '}
                {item.original_sentence_count} sentences.
              </p>

              <p className="summary-text">
                {item.summary.length > 240
                  ? `${item.summary.slice(0, 240)}…`
                  : item.summary}
              </p>

              {item.summary.length > 240 && (
                <details>
                  <summary>Read full summary</summary>
                  <p className="summary-text">{item.summary}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
