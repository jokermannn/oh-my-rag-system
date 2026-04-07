FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .

# Use PyTorch CPU-only index as primary so pip never picks the CUDA build.
# --extra-index-url falls back to PyPI for all non-torch packages.
RUN pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cpu \
    --extra-index-url https://pypi.org/simple/ \
    -e .

COPY app/ app/
COPY run.py .

EXPOSE 8000

ENV QDRANT_HOST=localhost \
    QDRANT_PORT=6333

CMD ["python", "run.py"]
