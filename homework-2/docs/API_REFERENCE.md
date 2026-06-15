# API Reference

Base URL: `http://localhost:3000`

---

## Data Models

### Ticket

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "customer_id": "cust-001",
  "customer_email": "user@example.com",
  "customer_name": "Jane Doe",
  "subject": "Cannot log in to my account",
  "description": "I have been unable to log in since yesterday. I reset my password but still get an error.",
  "category": "account_access",
  "priority": "high",
  "status": "new",
  "created_at": "2026-05-04T10:00:00.000Z",
  "updated_at": "2026-05-04T10:00:00.000Z",
  "resolved_at": null,
  "assigned_to": null,
  "tags": ["login", "urgent"],
  "metadata": {
    "source": "web_form",
    "browser": "Chrome 124",
    "device_type": "desktop"
  },
  "classification_meta": {
    "confidence": 0.6,
    "reasoning": "Matched 3 category keywords and detected priority level \"high\".",
    "keywords_found": ["login", "account", "access denied"]
  }
}
```

`classification_meta` is present only after auto-classification has run.

**Enum values**

| Field | Allowed values |
|---|---|
| `category` | `account_access` `technical_issue` `billing_question` `feature_request` `bug_report` `other` |
| `priority` | `urgent` `high` `medium` `low` |
| `status` | `new` `in_progress` `waiting_customer` `resolved` `closed` |
| `metadata.source` | `web_form` `email` `api` `chat` `phone` |
| `metadata.device_type` | `desktop` `mobile` `tablet` |

### Classification Result

```json
{
  "category": "account_access",
  "priority": "high",
  "confidence": 0.6,
  "reasoning": "Matched 3 category keywords and detected priority level \"high\".",
  "keywords_found": ["login", "account", "blocking"]
}
```

### Error Response

```json
{
  "error": true,
  "message": "Ticket not found",
  "details": null
}
```

Validation errors populate `details` with the Joi error detail array. In non-production environments a `stack` field is also included.

---

## Endpoints

### POST /tickets

Create a new ticket.

**Query params**

| Param | Type | Description |
|---|---|---|
| `auto_classify` | boolean | Pass `true` to run auto-classification immediately |

**Required body fields:** `customer_id`, `customer_email`, `customer_name`, `subject`, `description`

**Request**
```bash
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust-001",
    "customer_email": "user@example.com",
    "customer_name": "Jane Doe",
    "subject": "Cannot log in to my account",
    "description": "I have been unable to log in since yesterday. Reset password did not help."
  }'
```

**With auto-classification**
```bash
curl -X POST "http://localhost:3000/tickets?auto_classify=true" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust-001",
    "customer_email": "user@example.com",
    "customer_name": "Jane Doe",
    "subject": "Production down - critical error",
    "description": "Our production environment is completely down due to a critical authentication error."
  }'
```

**Response `201 Created`** — the created ticket object (with `classification_meta` when `auto_classify=true`).

**Error responses**

| Status | Cause |
|---|---|
| `400` | Missing required field or validation failure |

---

### POST /tickets/import

Bulk import tickets from a file. Format is detected from MIME type, then file extension (`.csv`, `.json`, `.xml`). File size limit: 5 MB.

**Request** — `multipart/form-data`, field name `file`.

```bash
# CSV
curl -X POST http://localhost:3000/tickets/import \
  -F "file=@sample_tickets.csv;type=text/csv"

# JSON
curl -X POST http://localhost:3000/tickets/import \
  -F "file=@sample_tickets.json;type=application/json"

# XML
curl -X POST http://localhost:3000/tickets/import \
  -F "file=@sample_tickets.xml;type=text/xml"
```

JSON files may use a root array `[...]` or an envelope `{ "tickets": [...] }`.

XML files must use `<tickets>` as the root element with `<ticket>` children.

Each successfully parsed row is auto-classified before saving.

**Response `207 Multi-Status`**
```json
{
  "total": 10,
  "successful": 8,
  "failed": 2,
  "errors": [
    { "row": 3, "message": "\"customer_email\" must be a valid email" },
    { "row": 7, "message": "\"subject\" is not allowed to be empty" }
  ],
  "tickets": [ ]
}
```

`tickets` contains the saved ticket objects.

**Error responses**

| Status | Cause |
|---|---|
| `400` | No file provided or unsupported format |

---

### GET /tickets

List all tickets with optional filtering.

**Query params** (all optional, exact-match)

| Param | Example |
|---|---|
| `status` | `?status=new` |
| `priority` | `?priority=urgent` |
| `category` | `?category=billing_question` |
| `customer_id` | `?customer_id=cust-001` |

Params can be combined: `?priority=high&category=technical_issue`

**Request**
```bash
# All tickets
curl http://localhost:3000/tickets

# Filtered
curl "http://localhost:3000/tickets?status=new&priority=urgent"
```

**Response `200 OK`** — array of ticket objects (empty array when none match).

---

### GET /tickets/:id

Get a single ticket by UUID.

**Request**
```bash
curl http://localhost:3000/tickets/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response `200 OK`** — ticket object.

**Error responses**

| Status | Cause |
|---|---|
| `404` | Ticket not found |

---

### PUT /tickets/:id

Update a ticket. All fields are optional; only provided fields are changed. `id`, `created_at` cannot be changed.

**Request**
```bash
curl -X PUT http://localhost:3000/tickets/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "assigned_to": "agent-42",
    "priority": "high"
  }'
```

**Response `200 OK`** — updated ticket object.

**Error responses**

| Status | Cause |
|---|---|
| `400` | Invalid field value |
| `404` | Ticket not found |

---

### DELETE /tickets/:id

Delete a ticket permanently.

**Request**
```bash
curl -X DELETE http://localhost:3000/tickets/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response `204 No Content`** — empty body.

**Error responses**

| Status | Cause |
|---|---|
| `404` | Ticket not found |

---

### POST /tickets/:id/auto-classify

Run the classification engine on an existing ticket and persist the result.

**Request**
```bash
curl -X POST http://localhost:3000/tickets/a1b2c3d4-e5f6-7890-abcd-ef1234567890/auto-classify
```

**Response `200 OK`** — classification result object:
```json
{
  "category": "technical_issue",
  "priority": "urgent",
  "confidence": 0.8,
  "reasoning": "Matched 4 category keywords and detected priority level \"urgent\".",
  "keywords_found": ["error", "crash", "critical", "production down"]
}
```

The ticket's `category`, `priority`, and `classification_meta` are updated in the store.

**Error responses**

| Status | Cause |
|---|---|
| `404` | Ticket not found |
