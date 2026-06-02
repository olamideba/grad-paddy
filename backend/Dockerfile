FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 8080

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080", \
     "--timeout-keep-alive", "75", \
     "--ws-ping-interval", "20", \
     "--ws-ping-timeout", "60"]

HEALTHCHECK --interval=3h --timeout=5s --start-period=60s --retries=3 \
     CMD curl -fsS http://127.0.0.1:8080/health || exit 1
