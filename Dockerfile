FROM python:3.11-slim

LABEL org.opencontainers.image.title="TextRank Summarization API" \
      org.opencontainers.image.description="Extractive text summarization service using TF-IDF and PageRank" \
      org.opencontainers.image.source="https://github.com/fierce-bri/TextRank-based-Text-Summarizer"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Copy dependencies separately so Docker can reuse the installation layer
# when only the application source changes.
COPY requirements.txt ./requirements.txt

RUN python -m pip install --no-cache-dir -r requirements.txt

# Copy only the production application package.
COPY app ./app

# Run the application as an unprivileged user.
RUN chown -R 10001:10001 /app

USER 10001:10001

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).read()"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
