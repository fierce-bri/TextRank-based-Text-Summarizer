"""Pydantic request and response models for the TextRank API."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SummarizeRequest(BaseModel):
    """Input accepted by the summarization endpoint."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "text": (
                    "TextRank is a graph-based ranking algorithm. "
                    "It represents sentences as nodes in a graph. "
                    "Similar sentences are connected by weighted edges. "
                    "PageRank identifies the most important sentences."
                ),
                "sentence_count": 2,
                "similarity_threshold": 0.05,
            }
        },
    )

    text: str = Field(
        ...,
        min_length=1,
        max_length=50_000,
        description="Source text that should be summarized.",
    )

    sentence_count: int = Field(
        default=3,
        ge=1,
        le=20,
        description=(
            "Maximum number of sentences to include in the summary."
        ),
    )

    similarity_threshold: float = Field(
        default=0.05,
        ge=0.0,
        le=1.0,
        description=(
            "Minimum TF-IDF similarity required to connect two "
            "sentences in the TextRank graph."
        ),
    )


class SummarizeResponse(BaseModel):
    """Successful response returned by the summarization endpoint."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "summary": (
                    "TextRank is a graph-based ranking algorithm. "
                    "PageRank identifies the most important sentences."
                ),
                "original_sentence_count": 4,
                "selected_sentence_count": 2,
            }
        },
    )

    summary: str = Field(
        ...,
        min_length=1,
        description="Extractive summary generated from the source text.",
    )

    original_sentence_count: int = Field(
        ...,
        ge=1,
        description="Number of sentences found in the original text.",
    )

    selected_sentence_count: int = Field(
        ...,
        ge=1,
        description="Number of sentences included in the summary.",
    )


class HealthResponse(BaseModel):
    """Response returned by the service health-check endpoint."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"] = Field(
        default="ok",
        description="Current status of the API.",
    )

    service: str = Field(
        default="textrank-summarizer",
        description="Name of the running service.",
    )


class ErrorResponse(BaseModel):
    """Response returned when summarization cannot be completed."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "detail": "text must contain at least one sentence"
            }
        },
    )

    detail: str = Field(
        ...,
        min_length=1,
        description="Human-readable explanation of the error.",
    )
