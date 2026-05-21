# grad-paddy backend

## Quick Start

### Prerequisites
- Python 3.10+ and uv installed — [Install UV](https://docs.astral.sh/uv/getting-started/installation/).

### Install dependencies
```bash
uv sync
```

### Firebase Admin setup

Use Google Cloud attached service account credentials in production when running on Cloud Run, GKE, or Compute Engine:

```python
firebase_admin.initialize_app()
```

For local development, set `GOOGLE_APPLICATION_CREDENTIALS` in `.env` to a service account JSON file that is kept outside version control. The app will initialize Firebase on startup and fall back to application default credentials when that setting is not present.

Protected example endpoint:

```text
GET /api/users/me
Authorization: Bearer <firebase-id-token>
```

### Start the development server

```bash
uv run fastapi dev
```

Visit [http://localhost:8000](http://localhost:8000)

## Project Structure

- `main.py` - Your FastAPI application
- `pyproject.toml` - Project dependencies
