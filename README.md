# Claims Intelligence (Task A)

Working slice of the L'Oréal Claims Intelligence Engine. Thinking is in `PROPOSAL.md`. This file is just how to run it.

## Docker (easiest)

Needs Docker Desktop. From the repo root:

```
docker compose up --build
```

Then open http://localhost:5173. API is http://localhost:3000.

No OpenAI key required — Assess uses a demo model. To use your own key:

```
OPENAI_API_KEY=sk-... docker compose up --build
```

Stop with Ctrl+C, or `docker compose down`.

## Without Docker

Needs Node 22.

Backend:

```
cd backend
npm install
npx prisma migrate dev
npm run start:dev
```

Frontend:

```
cd frontend
npm install
npm run dev
```

Optional: copy `backend/.env.example` to `backend/.env` and set `OPENAI_API_KEY`.

```
POST http://localhost:3000/api/claims/assess
{
  "claimText": "Reduces wrinkles by 20% in 4 weeks",
  "evidence": "…study text…",
  "productName": "optional",
  "formula": "optional"
}
```
