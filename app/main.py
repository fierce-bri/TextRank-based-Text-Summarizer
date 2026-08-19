"""FastAPI application for the TextRank summarization service."""

from fastapi import FastAPI, HTTPException, status

from app.schemas import (
    ErrorResponse,
    HealthResponse,
    SummarizeRequest,
    SummarizeResponse,
)
from app.summarizer import summarize_text


app = FastAPI(
    title="TextRank Summarization API",
    description=(
        "A lightweight extractive text-summarization service using "
        "TF-IDF sentence similarity, graph construction, and PageRank."
    ),
    version="1.0.0",
    contact={
        "name": "Aphiwe Mzulwini",
        "url": "https://github.com/fierce-bri",
    },
)


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Check service health",
    description=(
        "Returns a simple response confirming that the API is running."
    ),
)
def health_check() -> HealthResponse:
    """Return the current health status of the service."""

    return HealthResponse()


@app.post(
    "/summarize",
    response_model=SummarizeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Summarization"],
    summary="Generate an extractive summary",
    description=(
        "Summarizes the supplied text using TF-IDF sentence similarity "
        "and a TextRank-style PageRank algorithm."
    ),
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": (
                "The supplied text or summarization configuration "
                "could not be processed."
            ),
        }
    },
)
def summarize_endpoint(
    request: SummarizeRequest,
) -> SummarizeResponse:
    """
    Generate an extractive summary from the supplied text.

    Request validation is handled by Pydantic before the summarization
    service is called. Errors raised by the core service are converted
    into client-friendly HTTP 400 responses.
    """

    try:
        result = summarize_text(
            text=request.text,
            sentence_count=request.sentence_count,
            similarity_threshold=request.similarity_threshold,
        )

    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    return SummarizeResponse(
        summary=result.summary,
        original_sentence_count=result.original_sentence_count,
        selected_sentence_count=result.selected_sentence_count,
    )
