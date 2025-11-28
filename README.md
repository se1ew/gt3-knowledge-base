# GT3 HUB

Knowledge base about GT3 cars, tracks, teams, pilots and championships. The project provides a static frontend (multiple HTML pages) backed by an Express API that serves content from a SQLite database and supports authentication with JWT tokens.

## Features

- 📚 Entity directories: cars, tracks, teams, pilots, champions, regulations
- 🔐 Auth system with registration, login, JWT-based sessions and role `admin`
- 🛠️ Admin tooling for CRUD operations via API (cars, tracks, teams, pilots, champions)
- 🔎 Глобальный поиск по всем сущностям с главной страницы
- 🧱 Reusable partials for header/footer, responsive layout styles

## Tech Stack

| Layer          | Technology |
| -------------- | ---------- |
| Backend        | Node.js + Express |
| Database       | SQLite (`api/data/gt3.db`) через `better-sqlite3` |
| Auth           | JWT (jsonwebtoken) + bcrypt |
| Validation     | express-validator |
| Frontend       | HTML, CSS, Vanilla JS |

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- No additional database server required (SQLite file is included)

## Getting Started

```bash
npm install
npm run dev   # start API with nodemon on http://localhost:4000
# or
npm start     # production-like start
```

Static frontend files are served from the project root; by default Express exposes everything in `./` as static assets.

### Environment Variables

Create a `.env` file (see example below). Defaults from `api/config.js` will be used if variables are missing.

```env
PORT=4000
STATIC_ROOT=..
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
```

## Database

- SQLite file: `api/data/gt3.db`
- Schema defined in `api/db.js`
- Seeder script `api/seed.js` can populate tables from JSON sources (optional)

Since JSON data files were removed from the repo, seeding is disabled by default. To re-seed:

1. Restore JSON files under `data/`
2. Run `node api/seed.js` manually or re-enable `runSeed()` call in `api/server.js`

## Frontend Pages

| Page           | Script               | Notes |
| -------------- | -------------------- | ----- |
| `index.html`   | `js/index.js`        | hero, auth modal, global search |
| `cars.html`    | `js/cars.js`         | filters, CRUD modals, admin actions |
| `tracks.html`  | `js/tracks.js`       | list + detail modal |
| `teams.html`   | `js/teams.js`        | cards + admin management |
| `champions.html` | `js/champions.js`  | grouped champions view |
| `pilots.html`  | `js/pilots.js`       | list + details |
| `regulations.html` | `js/regulations.js` | accordion-style info |

Common utilities:

- `js/layout.js` loads header/footer partials
- `js/api.js` handles API requests, tokens and errors
- `js/auth.js` centralizes auth state

## API Overview

Base URL: `/api`

| Endpoint          | Description |
| ----------------- | ----------- |
| `POST /auth/register` | Register new user (unique email & display name) |
| `POST /auth/login`    | Sign in, receive JWT |
| `GET /auth/profile`   | Current user info (authorized) |
| `GET /search`         | Global search across entities |
| `GET/POST/PUT/DELETE /{cars|tracks|teams|pilots|champions}` | CRUD (admin only for write operations) |
| `GET/POST/... /users` | Admin-only user management |

Authentication middleware lives in `api/middleware/auth.js`.

## Development Tips

- Use `npm run dev` to auto-restart the API on changes.
- Frontend references static files directly; updating JS/CSS requires manual reload.
- JWT is stored in localStorage (`gt3_auth_session_v1`). Use browser devtools to clear sessions.
- To create an admin user manually, insert record into `users` with `role='admin'` (password must be bcrypt hash).

## Project Structure

```
api/
  config.js           # env vars + defaults
  db.js               # SQLite schema + connection
  middleware/
  routes/             # REST endpoints (cars, tracks, teams, etc.)
  server.js           # Express bootstrap (without automatic seeding)
css/
images/
js/                   # Frontend scripts per page + shared utilities
partials/             # Header/footer partials
index.html            # Landing page
cars.html ...         # Additional sections
```

## Roadmap Ideas

- Добавить тесты (Vitest/Jest + supertest)
- Вынести конфигурацию .env.example и подробный installation guide
- Объединить фронтенд скрипты сборщиком (Vite/Webpack)
- Улучшить accessibility/SEO (ARIA, meta tags, sitemap)
- Ввести refresh-токены и менеджмент сессий

## License

MIT.
