# Claims Intelligence (Task A)

Working slice of the L'Oréal Claims Intelligence Engine. Thinking is in `PROPOSAL.md`. This file is just how to run it.

Needs Node 22.

## Backend

```
cd backend
npm install
npx prisma migrate dev
npm run start:dev
```

API: `POST http://localhost:3000/api/claims/assess`

Optional: copy `backend/.env.example` to `backend/.env` and put in an `OPENAI_API_KEY`. Without it, the service uses a local fallback so you can still click around.

## Frontend

```
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). There's a wrinkle claim already filled in — submit it. Clear the claim box and submit if you want to see the browser's required-field check.

```
{
  "claimText": "Reduces wrinkles by 20% in 4 weeks",
  "evidence": "…study text…",
  "productName": "optional",
  "formula": "optional"
}
```
