# Webhook Middleware

A Node.js middleware that generates webhooks and handles API requests.

## Features

- Register webhooks with custom URLs and events
- Generate secure webhook secrets
- Sign webhook payloads with HMAC
- List registered webhooks
- Delete webhooks
- Trigger webhook events

## API Endpoints

### Register a Webhook
```http
POST /api/webhooks/register
Content-Type: application/json

{
    "url": "https://your-endpoint.com/webhook",
    "events": ["event1", "event2"]
}
```

### List Webhooks
```http
GET /api/webhooks
```

### Delete a Webhook
```http
DELETE /api/webhooks/:webhookId
```

### Trigger an Event
```http
POST /api/trigger
Content-Type: application/json

{
    "event": "event1",
    "data": {
        "key": "value"
    }
}
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on port 3000 by default. Set PORT environment variable to change it.
