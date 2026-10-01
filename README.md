# TextRank Fullstack Summarization Application

[![Tests](https://github.com/fierce-bri/TextRank-based-Text-Summarizer/actions/workflows/tests.yml/badge.svg)](https://github.com/fierce-bri/TextRank-based-Text-Summarizer/actions/workflows/tests.yml)
[![Docker](https://github.com/fierce-bri/TextRank-based-Text-Summarizer/actions/workflows/docker.yml/badge.svg)](https://github.com/fierce-bri/TextRank-based-Text-Summarizer/actions/workflows/docker.yml)
[![Web checks](https://github.com/fierce-bri/TextRank-based-Text-Summarizer/actions/workflows/web.yml/badge.svg?branch=main)](https://github.com/fierce-bri/TextRank-based-Text-Summarizer/actions/workflows/web.yml)

A fullstack extractive text-summarization application built with **React, Node.js, Express, PostgreSQL, FastAPI, scikit-learn, and NetworkX**.

The application accepts arbitrary text, ranks important sentences using **TF-IDF sentence similarity and TextRank/PageRank**, and returns a concise summary while preserving the original wording and document order.

The project began as a university NLP notebook and has since been refactored and extended into a multi-service application with a browser interface, backend API layer, persistent summary history, automated tests, Docker tooling, and continuous integration.

## Demo

<p align="center">
  <img
    src="docs/screenshots/textrank-fullstack-demo.png"
    alt="TextRank fullstack summarization application"
    width="900"
  >
</p>

<p align="center">
  <em>
    React interface for generating, saving, reviewing, and deleting
    TextRank summaries.
  </em>
</p>

## What the Application Does

Users can:

- Enter or paste text into a responsive React interface
- Choose the maximum number of sentences in the generated summary
- Generate an extractive summary using the Python TextRank service
- See loading, validation, timeout, and dependency-error states
- Save generated summaries to PostgreSQL
- View the 20 most recently saved summaries
- Delete individual saved summaries with confirmation
- Recover cleanly when the Python summarization service is unavailable

## Architecture

```text
                       Browser
                          │
                          ▼
                 React + Vite frontend
                          │
                     /api requests
                          │
                          ▼
                 Node.js / Express API
                    │             │
                    │             │
             summarization     persistence
                    │             │
                    ▼             ▼
              FastAPI API     PostgreSQL 17
                    │
                    ▼
           TextRank summarization
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   TF-IDF similarity      PageRank graph