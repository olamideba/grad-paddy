# Grad Paddy API Documentation

This document outlines the high-level specifications and endpoint examples for the Grad Paddy backend API.

## Global Response Envelope
All API endpoints wrap their data in a standard response shape for consistency:

```json
{
  "success": true,
  "data": {},
  "message": "Optional descriptive status message"
}
```

- **`success`** (boolean): Indicates if the operation was successful.
- **`data`** (object/array/null): Contains the response payload.
- **`message`** (string): Provides context (e.g., success message or blank).

---

## Authentication
Every request to endpoints starting with `/api/` requires a valid Firebase ID Token passed in the `Authorization` header:

```http
Authorization: Bearer <firebase_id_token>
```
The backend automatically resolves the user's `uid` from this token.

---

## 1. User & Preferences (`/api/users`)

### Create or Fetch Profile
- **Method**: `POST`
- **Path**: `/api/users/me`
- **Request Example**:
  ```json
  {
    "email": "student@example.edu",
    "name": "Jane Doe",
    "avatar_url": "https://example.com/avatar.jpg"
  }
  ```
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "id": "user_uid_123",
      "email": "student@example.edu",
      "name": "Jane Doe",
      "avatar_url": "https://example.com/avatar.jpg",
      "onboarded": false,
      "created_at": "2026-05-20T04:00:00Z",
      "updated_at": "2026-05-20T04:00:00Z"
    },
    "message": "Profile created or fetched successfully"
  }
  ```

### Get Preferences
- **Method**: `GET`
- **Path**: `/api/users/me/preferences`
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "research_interests": ["NLP", "Bioinformatics"],
      "target_countries": ["United States", "United Kingdom"],
      "target_universities": ["MIT", "Oxford"],
      "degree_type": "PhD",
      "funding_required": true
    },
    "message": ""
  }
  ```

---

## 2. Chat Sessions (`/api/sessions`)

### Create Session
- **Method**: `POST`
- **Path**: `/api/sessions/`
- **Request Example**:
  ```json
  {
    "first_message": "Can you help me find PhD programs in NLP?"
  }
  ```
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "id": "session_id_456",
      "title": "Can you help me find PhD programs in NLP?",
      "user_id": "user_uid_123",
      "created_at": "2026-05-20T04:05:00Z",
      "updated_at": "2026-05-20T04:05:00Z"
    },
    "message": "Session created successfully"
  }
  ```

---

## 3. Shortlist (`/api/shortlist`)

### Add Faculty to Shortlist
- **Method**: `POST`
- **Path**: `/api/shortlist/`
- **Request Example**:
  ```json
  {
    "name": "Dr. Regina Barzilay",
    "university": "MIT",
    "department": "EECS",
    "email": "regina@csail.mit.edu",
    "webpage": "https://people.csail.mit.edu/regina/",
    "research_summary": "Machine learning for healthcare and NLP",
    "fit_score": 9.5,
    "position_status": "open",
    "outreach_status": "not_contacted"
  }
  ```

### Get Shortlist Stats
- **Method**: `GET`
- **Path**: `/api/shortlist/stats`
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "total": 5,
      "open_positions": 3,
      "contacted": 1
    },
    "message": ""
  }
  ```

---

## 4. Tracker (`/api/tracker`)

### Create Application Entry
- **Method**: `POST`
- **Path**: `/api/tracker/`
- **Request Example**:
  ```json
  {
    "university": "Stanford University",
    "program": "Computer Science PhD",
    "department": "AI Lab",
    "deadline": "2026-12-15T23:59:59Z",
    "status": "tracking",
    "sop_status": "not_started",
    "cv_status": "in_progress",
    "recommenders": [
      {
        "name": "Prof. Alan Turing",
        "status": "confirmed"
      }
    ],
    "funded": "yes",
    "notes": "Spoke to Dr. Fei-Fei Li."
  }
  ```

---

## 5. Drafts (`/api/drafts`)

### Create Statement of Purpose / Outreach Draft
- **Method**: `POST`
- **Path**: `/api/drafts/`
- **Request Example**:
  ```json
  {
    "type": "sop",
    "title": "MIT Statement of Purpose",
    "content": "I am passionate about research in NLP...",
    "ai_generated": true,
    "source_tags": ["MIT NLP Group", "Barzilay Lab"],
    "linked_faculty_id": "faculty_789",
    "linked_application_id": "app_456"
  }
  ```
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "id": "draft_uid_777",
      "type": "sop",
      "title": "MIT Statement of Purpose",
      "content": "I am passionate about research in NLP...",
      "word_count": 8,
      "status": "draft",
      "ai_generated": true,
      "source_tags": ["MIT NLP Group", "Barzilay Lab"],
      "linked_faculty_id": "faculty_789",
      "linked_application_id": "app_456",
      "created_at": "2026-05-20T04:10:00Z",
      "updated_at": "2026-05-20T04:10:00Z"
    },
    "message": "Draft created successfully"
  }
  ```
