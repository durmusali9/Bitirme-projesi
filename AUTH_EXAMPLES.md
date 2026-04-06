# Auth API examples (register, login, get current user)

Base URL: http://localhost:4000/api

Register (POST /api/auth/register)

curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test+timed@example.com",
    "password": "TestPass123",
    "confirmPassword": "TestPass123",
    "languages": ["en", "tr"]
  }'

Successful response: HTTP 201 with JSON { token, data: { user }, message }

Login (POST /api/auth/login)

curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test+timed@example.com","password":"TestPass123"}'

Successful response: HTTP 200 with JSON { token, data: { user }, message }

Get current user (GET /api/auth/me)

curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <TOKEN_FROM_LOGIN>"

Successful response: HTTP 200 with user object (password omitted)

Notes:
- If MongoDB is not available the endpoints will return 503 with bilingual messages.
- The project’s smoke test (`npm test`) attempts these flows automatically if DB is available.
