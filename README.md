# TextRank Summarization API

[![Tests](https://github.com/fierce-bri/TextRank-based-Text-Summarizer/actions/workflows/tests.yml/badge.svg)](https://github.com/fierce-bri/TextRank-based-Text-Summarizer/actions/workflows/tests.yml)
[![Docker](https://github.com/fierce-bri/TextRank-based-Text-Summarizer/actions/workflows/docker.yml/badge.svg)](https://github.com/fierce-bri/TextRank-based-Text-Summarizer/actions/workflows/docker.yml)

A lightweight REST API for extractive text summarization using **TF-IDF sentence similarity**, a weighted graph, and **PageRank**. The service accepts arbitrary text, ranks its most important sentences, and returns a concise summary while preserving the original wording and document order.

This repository began as an academic TextRank notebook and has been refactored into a reusable, validated, tested, and containerized FastAPI service.

## The Problem It Solves

Long articles, reports, notes, and other documents can take time to review. This project provides a local summarization service that selects the most relevant sentences without requiring a hosted generative-AI provider or external model API.

Because the summarizer is extractive, every sentence in the output comes directly from the source text. This makes the result easier to trace back to the original document.

## What I Designed and Implemented

- Refactored the original notebook into separate algorithm, schema, and HTTP layers
- Implemented reusable TextRank-style summarization for arbitrary input text
- Built TF-IDF sentence vectors and a weighted sentence-similarity graph
- Used PageRank to identify important sentences
- Preserved original sentence order in the generated summary
- Added fallback ranking for disconnected or weak similarity graphs
- Designed validated API request and response models with Pydantic
- Added FastAPI health and summarization endpoints with interactive OpenAPI documentation
- Added unit tests, endpoint tests, multi-version CI, Docker packaging, and container smoke tests

## How the Algorithm Works

1. Normalizes whitespace and splits the source text into sentences.
2. Converts the sentences into TF-IDF vectors.
3. Calculates sentence-to-sentence cosine similarity.
4. Removes weak relationships using a configurable similarity threshold.
5. Builds a weighted graph in which sentences are nodes and similarities are edges.
6. Runs PageRank to score the importance of each sentence.
7. Selects the highest-ranked sentences and restores their original document order.
8. Falls back to TF-IDF relevance when the graph has no useful connections or PageRank does not converge.

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Confirms that the service is running |
| `POST` | `/summarize` | Generates an extractive summary |
| `GET` | `/docs` | Interactive Swagger UI documentation |
| `GET` | `/redoc` | Alternative ReDoc documentation |
| `GET` | `/openapi.json` | Generated OpenAPI schema |

## Request Format

Only `text` is required. The other properties use defaults when omitted.

```json
{
  "text": "TextRank represents sentences as graph nodes. Related sentences are connected by weighted edges. PageRank scores the sentence nodes. The highest-ranked sentences form the summary.",
  "sentence_count": 2,
  "similarity_threshold": 0.05
}
```

### Request Fields

| Field | Type | Required | Rules | Default |
|---|---|---:|---|---:|
| `text` | string | Yes | 1 to 50,000 characters | — |
| `sentence_count` | integer | No | 1 to 20 | `3` |
| `similarity_threshold` | number | No | 0.0 to 1.0 | `0.05` |

Unknown request fields are rejected rather than silently ignored.

## Response Format

```json
{
  "summary": "TextRank represents sentences as graph nodes. Related sentences are connected by weighted edges.",
  "original_sentence_count": 4,
  "selected_sentence_count": 2
}
```

## Run Locally

### Requirements

- Python 3.11 or newer
- `pip`

### macOS or Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Windows PowerShell

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Interactive documentation:

```text
http://127.0.0.1:8000/docs
```

## Example API Calls

### Health Check

```bash
curl --fail http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "textrank-summarizer"
}
```

### Generate a Summary

```bash
curl --request POST \
  --url http://127.0.0.1:8000/summarize \
  --header "Content-Type: application/json" \
  --data '{
    "text": "TextRank represents sentences as graph nodes. Related sentences are connected by weighted edges. PageRank scores the sentence nodes. The highest-ranked sentences form the summary.",
    "sentence_count": 2,
    "similarity_threshold": 0.05
  }'
```

## Run the Tests

Install the development dependencies:

```bash
python -m pip install -r requirements-dev.txt
```

Run the full suite:

```bash
python -m pytest -q
```

The tests cover:

- Sentence splitting and whitespace normalization
- Short-input handling
- Requested summary length
- Original sentence ordering
- Invalid core-service arguments
- Health and summarization endpoints
- Default API values
- Pydantic request validation
- Unknown request properties
- HTTP error conversion

## Run with Docker

Build the production image:

```bash
docker build --tag textrank-summarizer .
```

Run the container:

```bash
docker run --rm --publish 8000:8000 textrank-summarizer
```

Then open:

```text
http://127.0.0.1:8000/docs
```

The container:

- Uses Python 3.11 Slim
- Installs only runtime dependencies
- Runs the API as an unprivileged user
- Exposes port 8000
- Includes a health check against `/health`

## Continuous Integration

Two GitHub Actions workflows run automatically on pushes to `main` and on pull requests.

### Tests

Runs the pytest suite against:

- Python 3.11
- Python 3.12
- Python 3.13

### Docker

- Builds the production image
- Starts the API container
- Waits for the health endpoint
- Sends a real request to `/summarize`
- Validates the returned sentence metadata
- Prints container logs when a smoke test fails

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       ├── docker.yml              # Container build and smoke tests
│       └── tests.yml               # Multi-version Python test suite
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI application and endpoints
│   ├── schemas.py                  # Pydantic request and response models
│   └── summarizer.py               # Core TextRank summarization logic
├── tests/
│   ├── test_api.py                 # Endpoint and validation tests
│   └── test_summarizer.py          # Core algorithm tests
├── .dockerignore
├── .gitignore
├── Dockerfile
├── requirements-dev.txt
├── requirements.txt
├── text_summarization.ipynb        # Original research notebook
└── README.md
```
## Project Background

This project began as a university NLP experiment and was later redesigned as a reusable FastAPI service.

The current `app/` package is the maintained implementation. It replaces the original notebook-based workflow with reusable Python modules, validated API endpoints, automated tests, Docker packaging, and continuous integration.

## Design Decisions

### Separate Core Logic from the API

The summarization algorithm does not depend on FastAPI. It can be imported and used directly from Python, while the HTTP layer handles request validation and error responses.

```python
from app.summarizer import summarize_text

result = summarize_text(
    text="First sentence. Second sentence. Third sentence.",
    sentence_count=2,
)

print(result.summary)
```

### Preserve Document Order

PageRank determines importance, but ranking order is not necessarily reading order. Selected sentences are reordered according to their original positions so the final summary reads more naturally.

### Avoid Runtime Model Downloads

The service uses a lightweight sentence splitter and does not download NLTK data or a language model during startup. This keeps installation and Docker builds more reproducible.

### Handle Weak Graphs Gracefully

Some documents contain sentences with little vocabulary overlap. When the graph has no useful edges, the service falls back to TF-IDF relevance instead of failing or returning an empty summary.

## Original Research Material

The repository retains the original Jupyter notebook and academic report to show the project’s progression from an exploratory NLP implementation to a reusable API.

The current `app/` package should be used for running or integrating the service. The notebook is preserved for historical and research context.

## Current Limitations

- The summarizer is extractive and does not rewrite or paraphrase sentences.
- The lightweight sentence splitter may not handle every abbreviation, decimal, or unusual punctuation pattern.
- TF-IDF currently uses English stop words.
- Requests are processed synchronously and in memory.
- The API currently supports one document per request.
- The project does not include authentication, persistence, or rate limiting.

## Possible Future Improvements

- Add more advanced sentence segmentation
- Support additional languages
- Add a batch summarization endpoint
- Add configurable stop-word handling
- Benchmark summaries with ROUGE and other evaluation metrics
- Add request tracing and structured logging
- Deploy the container to a public cloud service

## Author

Developed and maintained by **Aphiwe Mzulwini**.

- GitHub: [fierce-bri](https://github.com/fierce-bri)
- LinkedIn: [Aphiwe Mzulwini](https://www.linkedin.com/in/aphiwe-mzulwini-310214318)
