FROM python:3.11-slim

WORKDIR /app

# Install CPU-only torch first to keep image size smaller (~200MB vs ~2GB GPU version)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY app/ app/
COPY run.py .

EXPOSE 8000

ENV QDRANT_HOST=localhost \
    QDRANT_PORT=6333

CMD ["python", "run.py"]
