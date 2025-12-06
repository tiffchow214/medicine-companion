# Use a small Python base image
FROM python:3.11-slim

# Create and set work directory
WORKDIR /app

# Environment settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system deps (needed for building some Python packages)
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the backend code (and any shared libs)
COPY api ./api
COPY pyproject.toml ./pyproject.toml

# Switch into the api folder where index.py lives
WORKDIR /app/api

# Cloud Run will send traffic to this port via the PORT env var
EXPOSE 8080

# Start FastAPI app with uvicorn, listening on the port Cloud Run provides
CMD ["sh", "-c", "uvicorn index:app --host 0.0.0.0 --port ${PORT:-8080}"]
