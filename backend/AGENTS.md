# Grad Paddy Backend - AI Agent Guidelines

## 1. Project Overview & Goal

Grad Paddy is a multi-step AI agent built for the Google Cloud Rapid Agent Hackathon. It targets the graduate school application process — one of the most cognitively demanding, high-stakes pipelines a young professional can run while simultaneously managing a career.

## 2. Technology Stack & Key Standards

- **Core:** Python 3.10+, FastAPI, Google ADK, Firebase, Elastic Search, Cloud Run.
- **Asynchronous:** All database and I/O-bound operations must be `async`.
- **Strict Typing:** All functions must have type hints. No `Any` unless absolutely necessary.
- **Dependency Management:** Use uv 

## 3. Core Architecture: Pragmatic Clean Architecture

We follow a layered pattern. Dependencies only point **inwards**.

- **Agent (`agent/`):** Defines agent orchestration
- **Router (`api/`):** **Thin controllers** for HTTP requests, validation (Pydantic), and calling services.
- **Service (`services/`):** Isolated business logic. No database or web-framework code here.
- **Repository (`repositories/`):** Data access layer. Handles communication with the Firestore and Elastic.

## 4. Project Structure

```text
backend
├── .env
├── .env.example
├── AGENTS.md
├── README.md
├── pyproject.toml
├── src
│   ├── agents
│   │   ├── __init__.py
│   │   └── root.py
│   ├── api
│   │   └── chat.py
│   ├── core
│   │   └── config.py
│   ├── main.py
│   ├── repositories
│   └── services
└── uv.lock
```

## 5. API Response & Design Rules
Use AG-UI protocol for streaming agent interactions.