# Socket.IO Chat Realtime – Backend Audit Report

**Scope:** NestJS backend (LOCAL dev). Goal: why two devices can send chat via REST but do not receive realtime socket events.

**Rules applied:** No invented events/endpoints; evidence with file paths, gateway event names, room names, payload shapes.

---

## 1) Socket.IO setup

### Gateways

| File | Gateway | Namespace | CORS |
|------|---------|-----------|------|
| `src/chat/chat.gateway.ts` | `ChatGateway` | **`/chat`** | `{ origin: true, credentials: true }` |
| `src/notifications/notifications.gateway.ts` | `NotificationsGateway` | `/ws` | `{ origin: '*', credentials: true }` |

- **Chat** (messages, typing, presence) is only on namespace **`/chat`**.  
- Notifications (push-style) are on **`/ws`**.  
- No other WebSocket gateways found.

### Adapter and path

- **No custom IoAdapter** in `src/main.ts` or `src/app.module.ts`. Nest uses default `@nestjs/platform-socket.io` (see `package.json`).
- **Default Socket.IO path:** `/socket.io` (engine at `http://<host>:<port>/socket.io`).
- **Namespace is not the path:** the namespace is the Socket.IO namespace name. Client must connect to the **`/chat`** namespace (e.g. `io('http://localhost:3000/chat', { ... })`), not to `http://localhost:3000` (default namespace `/`) and not to `/ws`.

### Module wiring

- `src/chat/chat.module.ts`: imports `AuthModule`, provides `ChatGateway`, `ChatService`, `WsJwtGuard`; exports `ChatGateway` so `ChatService` can inject it.
- `src/app.module.ts`: imports `ChatModule`. No global WebSocket or Socket.IO config.

**Conclusion (setup):** Chat realtime is only available on namespace **`/chat`**. Using the default namespace or `/ws` will result in no chat events.

---

## 2) Authentication

### Where token is read

**File:** `src/auth/guards/ws-jwt.guard.ts`

Token is taken in this order:

1. `client.handshake.auth?.token`
2. `client.handshake.query?.token`
3. `client.handshake.headers?.authorization` (strip `"Bearer "`)

So the client must send the JWT via **auth**, **query**, or **Authorization** header.

### If token is missing or invalid

- Guard throws `WsException('Missing authentication token')` or `WsException('Invalid authentication token')`.
- In Nest WebSockets, the guard runs on the **connection** when `@UseGuards(WsJwtGuard)` is applied at class level on `ChatGateway`. So:
  - **Missing/invalid token → connection is rejected** (client never reaches `handleConnection`).
- The server does **not** accept the connection and then block room join/emits; unauthenticated clients never get into the gateway.

**Conclusion (auth):** Socket must connect with a valid JWT in `handshake.auth.token`, `handshake.query.token`, or `Authorization` header. Otherwise the connection is closed and no chat events are possible.

---

## 3) Rooms and joins

### Join: no client “join” event

- There is **no** `@SubscribeMessage('join')` (or similar) for the client to emit.
- **File:** `src/chat/chat.gateway.ts`, `handleConnection` (lines 46–78):
  - After auth, the server loads all conversations for the user from DB:
    - `conversationParticipant.findMany({ where: { userId } })`
  - For each conversation it runs:
    - `client.join(\`conversation:${c.conversationId}\`)`

So **room name** is always: **`conversation:<conversationId>`** (e.g. `conversation:1`, `conversation:2`).

### Important limitation: join only at connection time

- Joins happen **only** in `handleConnection`.
- If a **new** conversation is created **after** the user is already connected (e.g. via `POST /api/chat/conversations`), that user’s socket is **not** joined to the new room.
- So when the first message is sent in that new conversation, the emit goes to `conversation:<newId>` where **no socket is present** → nobody receives it.

### Leave / disconnect

- **File:** `src/chat/chat.gateway.ts`, `handleDisconnect` (lines 80–107):
  - Removes the socket from `onlineUsers`, broadcasts `presence:change` (offline) if it was the last socket for that user.
  - Cleans up typing state and emits `typing:stop` to the conversation rooms.
- Socket.IO automatically removes the socket from all rooms on disconnect; no explicit “leave” event is used.

**Conclusion (rooms):**  
- Room name: **`conversation:<conversationId>`**.  
- Join: **automatic on connect**; no client “join” event.  
- **New conversations created after connect:** participants are not in the room, so they will not receive `message:new` until they reconnect (or you add a way to join new rooms).

---

## 4) Emissions (REST → socket)

### When a REST message is created

- **Endpoint:** `POST /api/chat/messages` (global prefix `api`).
- **File:** `src/chat/chat.controller.ts` (line 113–115): `sendText` → `ChatService.sendText`.
- **File:** `src/chat/chat.service.ts` (lines 183–204):
  - Creates message in DB, updates conversation `lastMessageAt` / `lastMessageId`.
  - Then: **`this.chatGateway.emitNewMessage(dto.conversationId, msg)`**.

### Who emits and where

- **File:** `src/chat/chat.gateway.ts` (lines 110–115):

```ts
emitNewMessage(conversationId: number, message: any) {
  this.server
    .to(`conversation:${conversationId}`)
    .emit('message:new', { conversationId, message });
}
```

- **Gateway:** `ChatGateway` (namespace `/chat`).
- **Event name:** **`message:new`**.
- **Room:** **`conversation:<conversationId>`**.
- **Payload shape:** `{ conversationId: number, message: <message object with sender, attachments, etc.> }`.
- **Recipients:** every socket **in that room** (including the sender if they are in the room). So all participants in the room get the event.

Same pattern for attachments: `src/chat/chat.service.ts` (line 278) calls `this.chatGateway.emitNewMessage(conversationId, msg)` after creating the message.

**Conclusion (emissions):**  
When a message is created via REST, the backend **does** emit a socket event: **`message:new`** on namespace **`/chat`** to room **`conversation:<conversationId>`**. So the backend emit is present and correct for existing rooms.

---

## 5) Structured report and root cause

### Connection / auth expectations

| Item | Expectation |
|------|-------------|
| URL | Base URL of the API (e.g. `http://localhost:3000`). |
| Namespace | **Must use `/chat`** (e.g. `io('http://localhost:3000/chat', options)`). |
| Path | Default `/socket.io` (no custom path in backend). |
| Token | JWT in `auth.token`, `query.token`, or `Authorization` header. |
| Result if auth fails | Connection rejected; no `handleConnection`, no rooms. |

### Join and room naming

| Item | Value |
|------|--------|
| Join event | None. Server joins the client to all its conversations in `handleConnection`. |
| Room name | **`conversation:<conversationId>`** (e.g. `conversation:1`). |
| When join happens | Only at connection time. New conversations created later are not joined. |

### Emit points and event names

| Trigger | File:method | Event name | Room | Payload |
|--------|-------------|------------|------|--------|
| POST /api/chat/messages (text) | `chat.service.ts` → `chatGateway.emitNewMessage` | `message:new` | `conversation:<id>` | `{ conversationId, message }` |
| Attach file/image | same | `message:new` | same | same |
| Mark read | `chat.service.ts` → `chatGateway.emitMessageRead` | `message:read` | same | `{ conversationId, userId, lastReadAt }` |
| Typing start/stop | `chat.gateway.ts` (client events) | `typing:start` / `typing:stop` | same | `{ conversationId, userId }` |
| Presence | `chat.gateway.ts` (broadcastPresence) | `presence:change` | same | `{ userId, status: 'online' \| 'offline' }` |

### Why a connected + “joined” client might still not receive events

1. **Wrong namespace (most likely)**  
   If the client connects to the default namespace (`io('http://localhost:3000')`) or to `io('http://localhost:3000/ws')`, it will never receive chat events, because those are emitted only on **`/chat`**. REST works because HTTP is namespace-agnostic; sockets do not.

2. **Conversation created after connect**  
   If the conversation was created via REST after both users were already connected, neither user’s socket was ever joined to `conversation:<newId>`. The emit goes to an empty room, so nobody receives it.

3. **Auth failure**  
   If the token is missing or invalid, the connection is rejected and the client is never in any room.

4. **Different server/port**  
   If the client points to another origin/port than where the Nest app runs, it would be a different server (no shared rooms).

### Minimal fix plan (no implementation unless obvious)

- **Verify client connection:**  
  Ensure the app connects to the **`/chat`** namespace with the same base URL as the API, e.g.  
  `io('http://<API_HOST>:<PORT>/chat', { auth: { token: '<JWT>' } })` (or equivalent for your client).  
  This is the first thing to check when “REST works but realtime doesn’t”.

- **New conversations:**  
  To get realtime for conversations created after connect, either:  
  - Add a server-handled event (e.g. `conversation:join`) that calls `socket.join(\`conversation:${conversationId}\`)` after checking the user is a participant, and have the client emit it when opening a conversation, or  
  - When `openConversation` (or equivalent) is called, have the backend join the relevant user sockets to `conversation:<newId>` (e.g. via a gateway method that looks up sockets by userId and joins the room).  
  No change to event names or payloads; only join logic.

- **Optional debug logging (NODE_ENV !== 'production'):**  
  - In `chat.gateway.ts` `handleConnection`: log `userId`, number of rooms joined (e.g. `conversations.length`).  
  - In `emitNewMessage`: log `conversationId` and optionally room size (e.g. `this.server.sockets.adapter.rooms.get(\`conversation:${conversationId}\`)?.size ?? 0`) to confirm someone is in the room when emitting.

---

## Summary table

| Topic | Location | Value |
|-------|----------|--------|
| Chat gateway | `src/chat/chat.gateway.ts` | `ChatGateway` |
| Chat namespace | same | **`/chat`** |
| Socket auth | `src/auth/guards/ws-jwt.guard.ts` | `handshake.auth.token` \| `query.token` \| `Authorization` |
| Room name | `src/chat/chat.gateway.ts` | **`conversation:<conversationId>`** |
| Join | same, `handleConnection` | Automatic from DB; no client “join” event |
| REST → emit | `src/chat/chat.service.ts` → `emitNewMessage` | Yes |
| Event name | `src/chat/chat.gateway.ts` | **`message:new`** |
| Payload | same | `{ conversationId, message }` |
| Most likely cause | Client | Connecting to wrong namespace (not `/chat`) |
| Secondary cause | Backend | New conversation created after connect → no one in room |

End of audit.
