# Wallapop Tracker — Local dev

Quick start for the database and worker skeleton.

Prerequisites:
- Docker / Docker Compose
- pnpm

Run MongoDB (Docker):

```bash
docker-compose up -d
```

Worker (development):

```bash
cd worker
pnpm install
cp .env.example .env
# configure .env (MONGODB_URI, WALLAPOP_API_BASE_URL, WALLAPOP_API_KEY if available)
pnpm run dev
```

Notes:
- Mongo runs on `mongodb://localhost:27000` by default.
- The worker contains a polling skeleton; configure the Wallapop API details to enable real requests.
