# WhatsApp Clone Backend (MERN)

Minimal backend for a WhatsApp Web style chat app using Node.js, Express, MongoDB, and Socket.IO.

Enhanced with centralized error handling, graceful shutdown, schema indexes, and paginated chat history.

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- Socket.IO
- dotenv
- cors

## Folder Structure

```text
backend/
  config/
    db.js
  controllers/
    messageController.js
    userController.js
  models/
    Message.js
    User.js
  routes/
    messageRoutes.js
    userRoutes.js
  socket/
    index.js
  .env.example
  server.js
  package.json
```

## Environment Variables

Create a `.env` file in `backend/`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/whatsapp_clone
CLIENT_URL=http://localhost:5173
```

## Setup and Run

1. Install dependencies:

```bash
cd backend
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Start production mode:

```bash
npm start
```

Backend base URL:

```text
http://localhost:5000
```

## API Endpoints

### User APIs

- `POST /api/users`
  - Body:

```json
{
  "username": "john",
  "email": "john@example.com"
}
```

- `GET /api/users`

### Message APIs

- `POST /api/messages`
  - Body:

```json
{
  "sender": "USER_ID_1",
  "receiver": "USER_ID_2",
  "text": "Hello"
}
```

- `GET /api/messages/:senderId/:receiverId`
  - Optional query params: `page`, `limit`
  - Response now includes `messages` and `pagination`

## Socket.IO Events

Client emits:

- `register-user` with `userId`
- `send-message` with `{ toUserId, message }` (optional helper event)

Server emits:

- `receive-message` with message payload

Primary real-time flow in this backend: when `POST /api/messages` succeeds, the server emits `receive-message` to the receiver if connected.

## Notes

- Messages are stored in MongoDB and persist across refresh/restart.
- Validation includes empty message and invalid sender/receiver handling.
- This backend intentionally keeps features simple (no typing indicator, online status, or group chat).
- Health endpoint includes server uptime and active Socket.IO connections.
- Unknown routes return a clean 404 JSON response.
