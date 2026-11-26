FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app/backend \
    KIPU_IDL_PATH=/app/target/idl/kipu_vault.json

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app ./backend/app
COPY backend/pyproject.toml ./backend/pyproject.toml
COPY frontend/src/idl/kipu_vault.json ./target/idl/kipu_vault.json

RUN useradd --create-home --shell /bin/sh kipu \
    && chown -R kipu:kipu /app

USER kipu

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
