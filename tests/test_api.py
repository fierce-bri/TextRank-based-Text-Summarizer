"""Tests for the TextRank FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


SAMPLE_TEXT = (
    "TextRank is a graph-based ranking algorithm. "
    "It represents sentences as nodes in a graph. "
    "Related sentences are connected using weighted edges. "
    "PageRank identifies the most important sentences."
)


def test_health_endpoint() -> None:
    """The health endpoint should confirm that the API is running."""

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "textrank-summarizer",
    }


def test_summarize_endpoint() -> None:
    """A valid request should return a structured summary."""

    response = client.post(
        "/summarize",
        json={
            "text": SAMPLE_TEXT,
            "sentence_count": 2,
            "similarity_threshold": 0.05,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["summary"]
    assert body["original_sentence_count"] == 4
    assert body["selected_sentence_count"] == 2


def test_summarize_endpoint_uses_defaults() -> None:
    """Optional configuration values should have working defaults."""

    response = client.post(
        "/summarize",
        json={
            "text": SAMPLE_TEXT,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["original_sentence_count"] == 4
    assert body["selected_sentence_count"] == 3


def test_short_text_returns_all_sentences() -> None:
    """The API should not pad or duplicate short input."""

    response = client.post(
        "/summarize",
        json={
            "text": "First sentence. Second sentence.",
            "sentence_count": 3,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "summary": "First sentence. Second sentence.",
        "original_sentence_count": 2,
        "selected_sentence_count": 2,
    }


def test_blank_text_is_rejected() -> None:
    """Whitespace-only input should fail request validation."""

    response = client.post(
        "/summarize",
        json={
            "text": "   ",
        },
    )

    assert response.status_code == 422


def test_unknown_request_field_is_rejected() -> None:
    """Unexpected request properties should not be silently accepted."""

    response = client.post(
        "/summarize",
        json={
            "text": SAMPLE_TEXT,
            "unknown_option": True,
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "sentence_count",
    [
        0,
        21,
    ],
)
def test_sentence_count_outside_schema_limit_is_rejected(
    sentence_count: int,
) -> None:
    """Sentence counts outside the API limits should be rejected."""

    response = client.post(
        "/summarize",
        json={
            "text": SAMPLE_TEXT,
            "sentence_count": sentence_count,
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "similarity_threshold",
    [
        -0.01,
        1.01,
    ],
)
def test_threshold_outside_schema_limit_is_rejected(
    similarity_threshold: float,
) -> None:
    """Invalid similarity thresholds should fail validation."""

    response = client.post(
        "/summarize",
        json={
            "text": SAMPLE_TEXT,
            "similarity_threshold": similarity_threshold,
        },
    )

    assert response.status_code == 422


def test_service_value_error_becomes_http_400(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Errors from the core service should become client responses."""

    def raise_service_error(**_: object) -> None:
        raise ValueError("Unable to summarize the supplied text")

    monkeypatch.setattr(
        "app.main.summarize_text",
        raise_service_error,
    )

    response = client.post(
        "/summarize",
        json={
            "text": SAMPLE_TEXT,
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Unable to summarize the supplied text"
    }
