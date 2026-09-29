# AI FitTrack

AI FitTrack is a fitness tracking and AI-powered fitness insights application. It has two parts:

- **`server/`** — a Node.js / Express / MongoDB REST API that lets members log workouts, track fitness goals, monitor progress, record gym attendance, and receive AI-generated fitness recommendations and insights (via Google Gemini). It also provides an admin API for member management and system oversight.
- **`client/`** — a React (Vite) single-page app that consumes the backend API and provides the member- and admin-facing UI.

The backend is fully independent and can be run and tested (via Postman/Thunder Client/curl) with no frontend at all. The client is an optional consumer of the same REST API — every rule it displays (roles, ownership, validation) is enforced by the backend, not by the UI.

---

## 1. Project Overview

AI FitTrack exposes REST APIs for:

- **User authentication** — registration and login with JWT
- **User profiles** — fitness profile data used to personalize AI features
- **Workout management** — full CRUD on personal workout logs, with search
- **Goal management** — fitness goals with server-calculated progress and status
- **Progress tracking** — aggregated statistics, streaks, consistency, and weekly breakdowns
- **Attendance / check-in tracking** — gym check-in and check-out history
- **AI-powered fitness insights and recommendations** — Google Gemini integration for personalized workout plans and performance analysis
- **Admin dashboard / member management** — system statistics and full visibility into every member's workouts, goals, progress, and attendance

---

## 2. Technology Stack

- **Node.js** (>= 20.0.0)
- **Express.js** (`express`) — HTTP server and routing
- **MongoDB** with **Mongoose** — data persistence and modeling
- **jsonwebtoken** — JWT-based authentication (HS256, algorithm pinned on verification)
- **bcryptjs** — password hashing
- **@google/genai** — Google Gemini integration for AI recommendations and insights
- **dotenv** — environment variable loading
- **cors** — cross-origin request handling
- **nodemon** (dev dependency) — auto-restart during development
- A custom, dependency-free request validation middleware (`middleware/validate.js`) for body/query validation and whitelisting

---

## 3. Project Structure

```
server/
├── server.js
├── package.json
├── .env.example
├── config/
│   ├── db.js
│   ├── defaultAdmin.js
│   └── validateEnv.js
├── controllers/
│   ├── adminController.js
│   ├── aiController.js
│   ├── attendanceController.js
│   ├── authController.js
│   ├── goalController.js
│   ├── progressController.js
│   └── workoutController.js
├── middleware/
│   ├── authMiddleware.js
│   ├── dbConnectionMiddleware.js
│   ├── errorMiddleware.js
│   └── validate.js
├── models/
│   ├── Attendance.js
│   ├── FitnessGoal.js
│   ├── User.js
│   └── Workout.js
├── routes/
│   ├── adminRoutes.js
│   ├── aiRoutes.js
│   ├── attendanceRoutes.js
│   ├── authRoutes.js
│   ├── goalRoutes.js
│   ├── progressRoutes.js
│   └── workoutRoutes.js
├── services/
│   ├── adminService.js
│   ├── attendanceService.js
│   ├── geminiService.js
│   ├── goalService.js
│   ├── insightsService.js
│   ├── jwtService.js
│   ├── passwordService.js
│   ├── progressService.js
│   └── recommendationService.js
├── scripts/
│   └── createAdmin.js
├── utils/
│   ├── AppError.js
│   ├── asyncHandler.js
│   ├── dateUtils.js
│   ├── ids.js
│   ├── pagination.js
│   ├── progressCalc.js
│   ├── response.js
│   └── text.js
└── tests/
    ├── api.integration.js
    ├── dateUtils.test.js
    ├── insights.test.js
    ├── progressCalc.test.js
    └── validate.test.js
```

---

## Frontend (`client/`)

The `client/` folder is a React single-page app that consumes the backend REST API described in this README.

### Frontend Technology Stack

- **React 19** with **React Router 7** for client-side routing
- **Vite 8** as the build tool / dev server, with `@vitejs/plugin-react`
- **Axios** for HTTP requests to the backend
- **oxlint** for linting
- Plain, hand-written CSS (`src/styles/tokens.css`, `src/styles/components.css`) — no CSS framework

### Frontend Project Structure

```
client/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx
    ├── App.jsx                 Route definitions
    ├── api/
    │   ├── client.js            Axios instance (base URL, JWT header, 401 handling)
    │   └── endpoints.js         One function per backend endpoint, grouped by resource
    ├── context/
    │   └── AuthContext.jsx      Auth state (current user, token) shared across the app
    ├── components/              Layout, ProtectedRoute, RoleRoute, and shared UI pieces
    ├── pages/                   One component per screen (see below)
    └── styles/                  Design tokens and shared component styles
```

### Frontend Features / Pages

- **Login / Register** (`/login`, `/register`) — public pages; a successful login/registration stores the JWT and redirects into the app
- **Dashboard** (`/`) — the member's own overview, or the Admin Dashboard when logged in as an admin (role-based rendering on the same route)
- **Workout log** (`/workouts`, `/workouts/new`, `/workouts/:id`, `/workouts/:id/edit`) — list, add, view, and edit workouts; shown as the gym-wide `WorkoutsAdmin` view for admins on the same `/workouts` route
- **Goals** (`/goals`) — create, view, and manage fitness goals; renders the admin, cross-member view for admins
- **Progress** (`/progress`) — charts and statistics from the Progress API; renders the admin overview for admins
- **Attendance** (`/attendance`) — check-in / check-out and visit history; renders the admin, per-member attendance table for admins
- **AI recommendation** (`/recommendation`) — calls `POST /api/ai/recommendation` and displays the generated plan (member-only)
- **AI Fitness Insights** (`/fitness-insights`) — calls `GET /api/ai/fitness-insights` and displays the analysis (member-only)
- **Profile** (`/profile`) — view/update the fitness profile used by the AI features
- **Admin — Members** (`/admin/members`, `/admin/members/:id`) — the searchable members overview and the full member-detail view described in [Section 5](#5-admin--member-management)
- **Admin — Dashboard** (`/admin`, kept for backward compatibility; the sidebar links to `/`, which renders the same admin view for an admin user)

Route access is controlled by two wrapper components: `ProtectedRoute` (redirects to `/login` if there is no valid session) and `RoleRoute` (restricts a route to specific roles, e.g. `/admin/members` to `admin`). These only control what the UI *shows* — the backend independently re-enforces authentication and role checks on every request, so a hidden or blocked UI route can never be used to bypass API-level authorization.

### Connecting the Frontend to the Backend

The client talks to the backend over plain HTTP using the base URL in `VITE_API_BASE_URL` (see `client/.env.example`), and attaches the JWT from `localStorage` to every request via an Axios interceptor (`src/api/client.js`). A `401` response clears the stored session and the user is sent back to `/login`.

### Frontend Environment Variables

```
# Base URL of the AI FitTrack backend API
VITE_API_BASE_URL=http://localhost:5000/api
```

### Frontend Installation, Configuration, and Running

```
cd client
copy .env.example .env      # edit VITE_API_BASE_URL if the backend isn't on localhost:5000
npm install
npm run dev                 # starts the Vite dev server, typically at http://localhost:5173
```

Other available scripts (from `client/package.json`):

- `npm run build` — production build (output to `dist/`)
- `npm run preview` — serves the production build locally
- `npm run lint` — runs `oxlint`

The backend must be running (with `CLIENT_ORIGIN` in `server/.env` including the client's origin, e.g. `http://localhost:5173`) for the frontend to work — the client makes no direct database or Gemini calls of its own.

---

## 4. Features

- **Registration / login** — email + password, passwords hashed with bcryptjs; every registration is created with the `user` role (a client can never register as `admin`)
- **JWT authentication** — `Authorization: Bearer <token>` header, HS256 tokens with configurable expiry; the current role is re-read from the database on every request
- **Profile management** — view and update name and fitness profile (age, height, weight, experience level, fitness goal); email, password, and role cannot be changed through this endpoint
- **Workout CRUD** — create, list (paginated), get by id, update, delete; a dedicated search endpoint filters by name, category, or date; every workout operation is scoped to the authenticated user's own data
- **Goal CRUD** — create, list, get, update, delete fitness goals. Goals can be `manual` (the user reports `currentValue`) or derived from stored data (`workouts`, `workout_minutes`, `calories`, `visits` completed between the goal's start and target dates). `progress` and `status` (`active` / `completed` / `expired` / `cancelled`) are always calculated by the server and can never be set directly by the client
- **Progress / statistics** — totals, average workout duration, category distribution, recent frequency, workout streaks, a consistency percentage, and weekly buckets, all computed with MongoDB aggregation from the user's own workouts and attendance
- **Attendance** — check-in / check-out with a single-open-visit rule enforced at the database level, plus the user's own attendance history
- **AI fitness insights / recommendations** — two separate Gemini-backed capabilities (see Section 8)
- **Admin dashboard** — system-wide statistics (users by role, workouts, goals, progress records, attendance) plus a short preview of the members overview
- **Admin member management** — searchable, paginated list of members with real per-member statistics; full detail view for a single member; role changes; account deletion (cascading to that member's workouts, goals, and attendance)
- **Role management** — an admin can promote/demote any other user's role, but can neither change their own role nor delete their own account
- **Validation and error handling** — every request body and query string is validated and whitelisted before it reaches a controller; all API responses (success and error) share one consistent JSON shape

---

## 5. Admin / Member Management

All routes under `/api/admin` require a valid JWT **and** the `admin` role (`authenticate` then `authorize("admin")`); a normal authenticated user receives `403`, and an unauthenticated request receives `401`.

Implemented admin capabilities:

- **View members** — a searchable, paginated "Members Overview" (`GET /api/admin/members`) with each member's real workout count, goal totals, days with logged progress, attendance count, last activity date, and a derived `Active` / `Inactive` status
- **View individual member details** — `GET /api/admin/members/:id` returns a member's profile, fitness totals (workouts, total duration, total calories), goal counts, attendance totals, and their most recent workouts, goals, and attendance records
- **View member workout information** — `GET /api/admin/workouts` lists workouts across all members (or one member via `?userId=`), each annotated with the owning member's name and email
- **View goals** — `GET /api/admin/goals` lists goals across all members (or one member via `?userId=`)
- **View attendance / progress information** — `GET /api/admin/attendance` returns a per-member attendance table for a given day plus summary counts; `GET /api/admin/progress` returns either an overview row per member or, with `?userId=`, that one member's own summary and weekly breakdown
- **Change roles** — `PUT /api/admin/users/:id/role` (an admin cannot change their own role)
- **Delete users** — `DELETE /api/admin/users/:id` removes the user together with their workouts, goals, and attendance records (an admin cannot delete their own account)
- **Admin authorization protection** — enforced once at the top of `routes/adminRoutes.js` (`router.use(authenticate, authorize("admin"))`), so every route below it is unreachable by anyone other than an admin

There is no permission for an admin to create or edit a member's workouts/goals on their behalf — admin access is read/manage-account only, plus role and deletion controls, as implemented above.

---

## 6. API Endpoints

Base path: `/api`. All request/response bodies are JSON. Protected routes require `Authorization: Bearer <token>`.

### Authentication (`/api/auth`)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user (always created with role `user`) | Public |
| POST | `/api/auth/login` | Log in and receive a JWT | Public |
| GET | `/api/auth/profile` | Get the authenticated user's profile | Required |
| PUT | `/api/auth/profile` | Update name and/or fitness profile fields | Required |

### Users / Profile

Profile management is handled entirely by the Authentication routes above (`GET`/`PUT /api/auth/profile`); there is no separate `/api/users` route group.

### Workouts (`/api/workouts`)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/workouts/search` | Search own workouts by name, category, and/or date | Required |
| POST | `/api/workouts` | Create a workout | Required |
| GET | `/api/workouts` | List own workouts, paginated | Required |
| GET | `/api/workouts/:id` | Get one own workout | Required |
| PUT | `/api/workouts/:id` | Update one own workout | Required |
| DELETE | `/api/workouts/:id` | Delete one own workout | Required |

### Goals (`/api/goals`)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/goals` | List own goals, paginated, filterable by status | Required |
| POST | `/api/goals` | Create a goal | Required |
| GET | `/api/goals/:id` | Get one own goal | Required |
| PUT | `/api/goals/:id` | Update one own goal | Required |
| DELETE | `/api/goals/:id` | Delete one own goal | Required |

### Progress (`/api/progress`)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/progress/summary` | Totals, streaks, consistency, and category breakdown for the authenticated user | Required |
| GET | `/api/progress/weekly` | Weekly workout buckets (`?weeks=`, default 8) | Required |

### Attendance (`/api/attendance`)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/attendance/check-in` | Check in to the gym | Required |
| POST | `/api/attendance/check-out` | Check out of the currently open visit | Required |
| GET | `/api/attendance` | Own attendance history, paginated, filterable by date range | Required |

### AI (`/api/ai`)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/ai/recommendation` | Generate a personalized AI workout recommendation | Required |
| GET | `/api/ai/fitness-insights` | Generate AI fitness insights from the user's own workout statistics | Required |

### Admin (`/api/admin`)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/admin/stats` | System-wide statistics | Admin |
| GET | `/api/admin/dashboard` | Stats plus a short members preview | Admin |
| GET | `/api/admin/users` | List/search all users | Admin |
| GET | `/api/admin/users/:id` | Get one user with their record counts | Admin |
| PUT | `/api/admin/users/:id/role` | Change a user's role | Admin |
| DELETE | `/api/admin/users/:id` | Delete a user and their data | Admin |
| GET | `/api/admin/members` | Members overview with per-member statistics | Admin |
| GET | `/api/admin/members/:id` | Full detail view for one member | Admin |
| GET | `/api/admin/workouts` | Workouts across all members (or one via `?userId=`) | Admin |
| GET | `/api/admin/goals` | Goals across all members (or one via `?userId=`) | Admin |
| GET | `/api/admin/progress` | Progress overview, or one member's summary via `?userId=` | Admin |
| GET | `/api/admin/attendance` | Per-member attendance table for a given day | Admin |

### Health (public)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | Server, database, and Gemini configuration status | Public |

---

## 7. Database

- **MongoDB** is used as the primary data store, accessed through **Mongoose** object models.
- Required environment variable: **`MONGO_URI`** (a `mongodb://` or `mongodb+srv://` connection string).
- **Main models:**
  - `User` — account, credentials (hashed, never returned by default), role (`user` / `admin`), and fitness profile
  - `Workout` — one logged workout, owned by a user
  - `FitnessGoal` — one fitness goal, owned by a user, with server-calculated `currentValue`/`progress`/`status` for non-manual metrics
  - `Attendance` — one gym visit (check-in/check-out) per user, with a database-enforced rule that a user can have at most one open visit at a time
- **Connection error handling:** the server calls `connectDB()` during startup and does not begin listening until MongoDB has connected. If the initial connection fails, the process exits with a diagnostic hint (e.g. refused connection, auth failure, unresolved host, timed-out server selection, or an invalid connection string). If the connection is later lost, `middleware/dbConnectionMiddleware.js` makes every database-dependent route answer `503` immediately (instead of letting Mongoose queue and time out the query), and the connection recovers automatically when MongoDB becomes reachable again.

---

## 8. AI Integration

AI FitTrack integrates with **Google Gemini** through the official `@google/genai` SDK, entirely on the server (`services/geminiService.js`). The API key never reaches a client.

Two independent AI capabilities are implemented:

1. **AI Workout Recommendation** (`POST /api/ai/recommendation`, `services/recommendationService.js`) — builds a prompt from the user's fitness profile (age, fitness goal, experience level — from the request body or the saved profile), active goals, recent workouts, and progress statistics, and asks Gemini for a structured JSON workout plan (overview, weekly schedule, suitable exercises, training tips, safety recommendations, a motivational message, and a disclaimer).
2. **AI Fitness Insights** (`GET /api/ai/fitness-insights`, `services/insightsService.js`) — calculates the user's total workouts, average workout duration, and total calories burned (the same numbers used by the Progress endpoints), and asks Gemini for a structured JSON analysis (performance analysis, improvement suggestions, motivational advice, and a fitness progress summary). If the user has no workouts yet, Gemini is not called and `insights` is returned as `null`.

`geminiService.js` centralizes the model name, timeout, and retry policy shared by both features: temporary failures (e.g. `503`/`UNAVAILABLE`, other `5xx`, timeouts, transient network errors) are retried up to 3 times with exponential backoff; permanent failures (bad API key, invalid request, unknown model) fail immediately with a clear error and status code.

**Required environment variable:** `GEMINI_API_KEY`. If it is missing or still a placeholder, the server starts normally and every other endpoint works — only the two AI endpoints respond with a clear JSON error.

---

## 9. Environment Variables

All variables are read from `server/.env` (see `server/.env.example` for the template). Use your own values — never commit real secrets.

```
# Server configuration
PORT=5000

# MongoDB connection string
MONGO_URI=your_mongodb_connection_string

# JWT secret used to sign authentication tokens (32+ random characters recommended)
JWT_SECRET=your_secure_jwt_secret

# JWT token expiry (e.g. 7d, 12h, 30m)
JWT_EXPIRES_IN=7d

# Google Gemini API key - required only for the AI endpoints
GEMINI_API_KEY=your_gemini_api_key

# Gemini model name used by both AI features
GEMINI_MODEL=gemini-2.5-flash

# Milliseconds to wait for a Gemini response before aborting the request
GEMINI_TIMEOUT_MS=30000

# Comma separated list of allowed frontend/API-consumer origins for CORS
CLIENT_ORIGIN=http://localhost:5173

# Default admin bootstrap - created automatically on first server start if it does not exist
ADMIN_NAME=Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=choose_a_strong_password

# Used only by the API test script `npm run test:api`
# TEST_BASE_URL=http://localhost:5000
# TEST_ADMIN_EMAIL=admin@example.com
# TEST_ADMIN_PASSWORD=choose_a_strong_password
```

`MONGO_URI` and `JWT_SECRET` are required — the server refuses to start without them (`config/validateEnv.js`). `GEMINI_API_KEY` only produces a startup warning if missing.

---

## 10. Installation

```
cd server
npm install
```

Requires **Node.js 20 or later** and a reachable MongoDB instance (local or Atlas).

---

## 11. Configuration

1. Copy the example file:
   ```
   cd server
   copy .env.example .env
   ```
   (On Windows Command Prompt, `copy` works as shown above; PowerShell also accepts `cp`.)
2. Open `server/.env` and fill in real values for `MONGO_URI` and `JWT_SECRET` at minimum. Add `GEMINI_API_KEY` if you want the AI endpoints to work. Adjust `PORT`, `CLIENT_ORIGIN`, and the default admin credentials as needed.

---

## 12. Running the Backend

From inside `server/`:

```
npm start
```

runs the server with plain Node (`node server.js`).

For development with automatic restarts on file changes:

```
npm run dev
```

runs the server with `nodemon`.

To create or promote an admin account from the command line (registration through the API always creates role `user`):

```
npm run create-admin -- "Admin Name" admin@example.com "StrongPassword123"
```

---

## 13. API Usage

This backend is a plain REST API and can be exercised with any HTTP client, for example:

- **Postman**
- **Thunder Client** (as a VS Code extension, used ad hoc — no bundled collection ships with this repository)
- **curl**

Example:

```
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"user@example.com\",\"password\":\"yourpassword\"}"
```

---

## 14. Health Check

```
GET /api/health
```

Public, requires no authentication, and never touches business data — it only reports server, database, and Gemini status:

- `server`: always `"running"`
- `database`: one of `connected`, `disconnected`, `connecting`, `disconnecting` (from the live Mongoose connection state)
- `gemini`: `"configured"` or `"not_configured"`
- `uptimeSeconds` and `timestamp`

Returns HTTP `200` with `success: true` when the database is connected, or HTTP `503` with `success: false` when it is not.

---

## 15. Testing

Test files exist under `server/tests/`:

- `dateUtils.test.js`, `progressCalc.test.js`, `validate.test.js` — unit tests for date helpers, progress/streak calculations, and the request validation middleware
- `insights.test.js` — tests for the AI Fitness Insights flow
- `api.integration.js` — HTTP-level integration tests intended to run against a live backend and database

Run the unit test suite with Node's built-in test runner:

```
npm test
```

Run the API integration tests (requires a running server and MongoDB, plus `TEST_BASE_URL`/`TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD` if you want the admin-only cases to run):

```
npm run test:api
```

---

## 16. Security

- **JWT authentication** — HS256 tokens with a configurable expiry; the signing/verification algorithm is pinned so it cannot be substituted
- **Password hashing** — bcryptjs, applied before a user document is ever saved
- **Role-based authorization** — `authorize("admin")` middleware guards every admin route; roles are re-read from the database on every request, not trusted from the token payload
- **Request validation** — `middleware/validate.js` type-checks, coerces, and whitelists every request body and query string, dropping any unexpected field (preventing mass-assignment of fields like `role`)
- **CORS** — restricted to the origins listed in `CLIENT_ORIGIN`
- **Environment variables for secrets** — `MONGO_URI`, `JWT_SECRET`, and `GEMINI_API_KEY` are only ever read from environment variables, never hardcoded
- **Protection of admin routes** — enforced centrally in `routes/adminRoutes.js`, not per-endpoint
- **Ownership checks** — every workout/goal/attendance operation confirms the record belongs to the requesting user before acting on it
- Password hashes are excluded from query results by default and stripped from any JSON representation of a `User` document as defense in depth

---

## 17. Error Handling

All errors are funneled through a single centralized handler (`middleware/errorMiddleware.js`), which returns a consistent JSON shape:

```
{ "success": false, "message": "...", "errors": [ ... ] }
```

Specific cases handled:

- **Business/permission errors** (`AppError`) — return the status code and message the service specified
- **Gemini failures** — return a distinct status/message depending on failure type (invalid key, unknown model, rate limit, temporary unavailability, timeout)
- **Malformed or oversized JSON bodies** — `400` / `413`
- **Mongoose validation errors** — `400` with a list of field-level messages
- **Duplicate key errors** (e.g. duplicate email) — `409`
- **Invalid ObjectId** — `400`
- **Database unavailable** — `503`
- **Expired or invalid JWT** — `401`
- **Unmatched routes** — `404`
- **Anything unexpected** — logged server-side in full, returned to the client as a generic `500` with no internal details, stack trace, or secret leaked

---

## 18. Important Notes

- The backend (`server/`) is fully self-contained and does not require the frontend to run or be tested — it can be exercised entirely with Postman, Thunder Client, or curl.
- The frontend (`client/`) is a React (Vite) app that consumes the backend REST API; it requires the backend to be running and reachable at `VITE_API_BASE_URL`.
- **MongoDB must be available** for any database-dependent operation; the health check and startup logs make connectivity issues clear.
- **Gemini API configuration is required only for the AI endpoints** (`POST /api/ai/recommendation` and `GET /api/ai/fitness-insights`); every other endpoint works without it.
- API requests can be tested using **Postman**, **Thunder Client**, or **curl** — no bundled test collection is required or provided.

---

## 19. Troubleshooting

- **MongoDB connection failure at startup** — the server logs a specific hint and exits: `ECONNREFUSED` means MongoDB isn't running (try `127.0.0.1` instead of `localhost`); an auth-related message means the credentials in `MONGO_URI` are wrong; an unresolved host means the connection string's host is wrong; a timed-out server selection (common with Atlas) usually means your IP isn't allow-listed.
- **Missing environment variables** — the server refuses to start and lists exactly which of `MONGO_URI` / `JWT_SECRET` is missing or still a placeholder; copy `server/.env.example` to `server/.env` and fill in real values.
- **Port already in use** — the server logs `Port <PORT> is already in use` and exits; stop the other process or change `PORT` in `.env`.
- **Invalid JWT / authentication errors** — `401 Not authorized` means no or a malformed `Authorization` header; `401 Session expired` means the token expired; `401 Invalid token` means the token is malformed or was signed with a different secret. Log in again to get a fresh token.
- **Gemini API configuration failure** — a `500` "Gemini API key is not configured" means `GEMINI_API_KEY` is missing/placeholder; other Gemini-related errors (`502`/`503`/`504`/`429`) indicate the request to Gemini itself failed, was rate-limited, or timed out — only the two AI endpoints are affected.
- **Dependency installation problems** — ensure Node.js 20+ is installed, then delete `node_modules` and re-run `npm install` from inside `server/`.

---

## 20. License

Per `server/package.json`, this project is licensed under the **MIT License**. No author or organization information is declared in the project's package metadata.
