# Claims Intelligence — Task A

L'Oréal R&I asked for the core of a Claims Intelligence Engine: a scientist’s formula, an evaluator’s clinical write-up, a model that checks whether the study actually carries the claim, the result in a database, and a React screen with **Justified / Confidence / Reasoning**.

This repo is that slice. It runs. The rest of this file is the thinking they asked for.

## Live demo (no setup)

GitHub Pages, in-browser only — same screens, history in `localStorage`. Nest/Prisma/OpenAI are not behind this URL; that’s `docker compose`.

After the repo is on GitHub and Pages is set to **GitHub Actions**:

https://\<you\>.github.io/\<repo\>/

First visit already has a Revitalift example. Open it, or New product and Assess. A 4-week claim against a 2-week study should come back No.

The workflow is `.github/workflows/pages.yml`. It builds on every push to `main`.

## Run it locally

Docker Desktop:

```
docker compose up --build
```

http://localhost:5173 — API on :3000.

No OpenAI key needed. Assess still talks to a model so you can click through. If you have a key:

```
OPENAI_API_KEY=sk-... docker compose up --build
```

Without Docker (Node 22):

```
cd backend && npm install && npx prisma migrate dev && npm run start:dev
cd frontend && npm install && npm run dev
```

What to click: **New product**, fill a claim and a study, **Assess claim**. Open a product from the list to see history. Try a 4-week claim against a 2-week study — that’s the interesting case.

`POST /api/claims/assess`

```
{
  "productName": "Revitalift test batch",
  "formula": "retinol 0.3%",
  "claimText": "Reduces wrinkles by 20% in 4 weeks",
  "evidence": "…clinical write-up…"
}
```

## Business process understanding

The flow they described isn’t a form. It’s a relay.

Business puts a product on the table with a pile of claims. Some are ambitious (“reduces wrinkles by 20% in 4 weeks”), some are table stakes, some will never survive regulation. Claim managers cut that list: is the claim even allowed for the category, and is it feasible given the formula and the calendar? Only then does Paris R&I spend money. A scientist locks a formula. An evaluator runs or commissions the study and attaches the results.

The expensive mistake sits after that: treating a study as if it automatically carries the wording of the claim. A clean 2-week wrinkle study does not support a 4-week claim, even if the graph looks great.

That’s the slice I built. `POST /api/claims/assess` is the evaluator desk — evidence in, a first-pass read on whether the study speaks to the claim, row in the database, shown in the UI. I didn’t build the manager queue or the formulation lab. Those are real stages. They weren’t the core feature.

## Research performed designing the solution

Cosmetic claims in the EU are not a marketing opinion. Regulation 655/2013 (the common criteria) wants them truthful, evidential, honest and fair. Evidential support is the one that bites R&I: the evidence has to match what you said, not a nearby story. 21% in 2 weeks is not 20% in 4 weeks. “Women loved the glow” does not move an instrumental wrinkle claim.

I also don’t trust an LLM as a sign-off. These models are decent at comparing two texts and sloppy with numbers. They’ll round a study into a yes. So the model here is a reviewer, not a judge. It returns `justified`, a confidence, and reasoning, and we persist all three plus which model said it. A person in evaluation still owns the decision.

That’s why Assessment is a new row, not a flag on Claim. If they attach a second study next month, yesterday’s read has to still be there.

Structured JSON is the other practical bit. Free-text “seems supported” is useless on a screen and worse in a table.

## Technical architecture justification

They asked for NestJS, Claim + Assessment, one POST, and React. That’s the stack.

- **Prisma + SQLite** instead of TypeORM + Postgres so a reviewer isn’t standing up a database for two tables. The schema doesn’t care; swap the datasource later.
- **Append-only assessments.** Overwriting yesterday’s result would make an audit trail lie.
- **One module.** `ClaimsController` / `ClaimsService` / `assess.dto`. The OpenAI call lives in the service. I didn’t invent an `ILlmAssessor` for a take-home.
- **Two screens, not a router.** Product list from the database, then the assess form. History is on the product, not jammed into a dropdown. New product starts empty.
- **Models.** `gpt-4o-mini` if `OPENAI_API_KEY` is set. Otherwise a demo model so Assess isn’t dead on a laptop. If that call fails, a local check on duration / magnitude / stats language. I would not send unpublished formulas to a public demo from a real R&I network — that’s a review convenience, called out on the screen.
- **Docker Compose** so Node versions aren’t part of the exercise.

What I refused: auth, Redis, Kubernetes, a component library, a prompt “framework”.

## Product roadmap if you had ample time and no boundaries on solution evolution design

If this were a real R&I tool and time wasn’t a day:

1. Claim-manager gate in software. Applicability / feasibility with a reason when something dies. That’s where most claims should stop, before a study is paid for.
2. Drop in the actual PDF, pull methods and endpoints, hang that on the assessment instead of a paste box.
3. Evaluator can disagree with the model. Store both. Disagreement is useful.
4. A library of our own studies, so the question isn’t “does this paste match this sentence” but “have we already generated evidence that could carry this claim, or a narrower one?”
5. Several claims per product, versioned formulas, French/English, because that’s how Paris works.

I wouldn’t start with identity or a “claims platform.” The bottleneck is the relay and the evidence.

## Layout

```
backend/prisma/schema.prisma     Claim, Assessment
backend/src/claims/              POST /api/claims/assess, GET products, GET history
frontend/src/App.jsx             both screens
docker-compose.yml
```
