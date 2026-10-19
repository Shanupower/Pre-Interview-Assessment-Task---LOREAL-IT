# Claims Intelligence — Task A

L'Oréal R&I asked for the core of a Claims Intelligence Engine: a scientist’s formula, an evaluator’s clinical write-up, a first-pass check that the study actually carries the claim as worded, that result in a database, and a React screen with **Justified / Confidence / Reasoning**.

This repo is that slice. The four headings below are the write-up they asked for.

## Live demo

https://shanupower.github.io/Pre-Interview-Assessment-Task---LOREAL-IT/

Same screens as the app. History stays in the browser (`localStorage`). Nest, Prisma and OpenAI are not behind this URL — use Docker for that.

First visit already has **Revitalift test batch**: one claim waiting on a study, one already assessed. Open it. **Already assessed** shows the clinical write-up they attached, not just Yes/No. **Submit formula** is the scientist: product, formula, claim, nothing assessed yet. That lands on the evaluator desk. Paste a write-up → **Attach study & assess**. A 4-week wrinkle claim against a 2-week study should come back No.

## Run the full stack

Docker Desktop:

```
docker compose up --build
```

App at http://localhost:5173 — API at http://localhost:3000.

No OpenAI key needed. Assess still talks to a model so a reviewer can click through. With a key:

```
OPENAI_API_KEY=sk-... docker compose up --build
```

Without Docker, Node 22, two terminals:

```
cd backend && npm install && npx prisma migrate dev && npm run start:dev
cd frontend && npm install && npm run dev
```

```
cd backend && npm test
```

## How to click through

1. **Submit formula** — scientist files product, formula, claim. No study, no verdict.
2. Evaluator desk — claims waiting on a study sit on the left. Paste **Clinical study results** → **Attach study & assess**.
3. Right-hand side is Justified, Confidence Score, Reasoning, and the study text. **Already assessed** keeps that paste next to the verdict.

The hosted demo seeds Revitalift so step 2 is already waiting.

## API

All routes sit under `/api`.

| Method | Path | Who |
| --- | --- | --- |
| `POST` | `/api/claims` | Scientist. `{ productName, formula, claimText }` |
| `POST` | `/api/claims/:id/assess` | Evaluator. `{ evidence }` |
| `POST` | `/api/claims/assess` | One-shot, because that’s the endpoint the brief named |
| `GET` | `/api/claims/products` | Product list. `waiting: true` if a claim for that name has no study yet |
| `GET` | `/api/claims?product=` | Claims and their assessments for that product |

One-shot body:

```json
{
  "productName": "Revitalift test batch",
  "formula": "retinol 0.3%",
  "claimText": "Reduces wrinkles by 20% in 4 weeks",
  "evidence": "Split-face instrumental study, 72 women, 4 weeks. Mean wrinkle volume -22% vs vehicle, p<0.05."
}
```

What we store on each assessment: `justified`, `confidence` (0–1), `reasoning`, the study text, and which model said it.

## Business process understanding

The flow they described isn’t a form. It’s a relay.

Business puts a product on the table with a pile of claims. Some are ambitious (“reduces wrinkles by 20% in 4 weeks”), some are table stakes, some will never survive regulation. Claim managers cut that list: is the claim even allowed for the category, and is it feasible given the formula and the calendar? Only then does Paris R&I spend money. A scientist locks a formula. An evaluator runs or commissions the study and attaches the results.

The expensive mistake sits after that: treating a study as if it automatically carries the wording of the claim. A clean 2-week wrinkle study does not support a 4-week claim, even if the graph looks great. A hydration Corneometer readout does not carry a wrinkle %. “Women loved the glow” does not move an instrumental claim.

That’s the slice I built. Scientist hits **Submit formula** (`POST /api/claims`) — product, formula, claim, no study yet. Evaluator opens the product, attaches the clinical write-up (`POST /api/claims/:id/assess`), and we store Justified / Confidence / Reasoning plus the study text itself. History is the paste, not a summary of it. The one-shot `POST /api/claims/assess` is still there because that’s what the brief named. I didn’t build the manager queue. That wasn’t the core feature.

## Research performed designing the solution

Cosmetic claims in the EU are not a marketing opinion. Regulation 655/2013 (the common criteria) wants them truthful, evidential, honest and fair. Evidential support is the one that bites R&I: the evidence has to match what you said, not a nearby story. 21% in 2 weeks is not 20% in 4 weeks.

I don’t trust an LLM as a sign-off. These models are decent at comparing two texts and sloppy with numbers. They’ll round a study into a yes. The system prompt is the evidential test, not “does this sound supported”:

- duration has to match, or the claimed timepoint has to be reported inside a longer study
- the endpoint has to be the one claimed
- the number has to be met — a miss is not rounded into a hit
- missing stats stay missing
- a different formula in the write-up is a no
- consumer quotes are not an instrumental result

`justified` is whether the paste carries the wording. `confidence` is how sure we are of that call — a 2-week study against a 4-week claim is a no with high confidence, not a maybe. A person in evaluation still owns the decision. We persist all three fields, the study text, and which model said it.

That’s why Assessment is a new row, not a flag on Claim. If they attach a second study next month, yesterday’s read has to still be there. Structured JSON is the other practical bit. Free-text “seems supported” is useless on a screen and worse in a table.

## Technical architecture justification

They asked for NestJS, Claim + Assessment, one POST, and React. That’s the stack.

- **Prisma + SQLite** instead of TypeORM + Postgres so a reviewer isn’t standing up a database for two tables. The schema doesn’t care; swap the datasource later.
- **Append-only assessments.** Overwriting yesterday’s result would make an audit trail lie. Evidence lives on Assessment, which is why history can show what they actually pasted.
- **One module.** `ClaimsController` / `ClaimsService` / `assess.dto`. The OpenAI call and the reviewer prompt live in the service. I didn’t invent an `ILlmAssessor` or a prompt framework for a take-home.
- **Scientist then evaluator, not one form.** Claim is filed first. Assessment only exists once a study is attached. Product list shows “waiting on study” when that’s the case.
- **Models.** `gpt-4o-mini` if `OPENAI_API_KEY` is set. Otherwise a demo model so Assess isn’t dead on a laptop. If that call fails, local rules on duration, endpoint, magnitude, formula and consumer language — the same hard nos as the prompt, so a reviewer without a key still gets a real No. I would not send unpublished formulas to a public demo from a real R&I network. That’s a review convenience, called out on the screen.
- **Hosted demo** is `VITE_DEMO=1` on GitHub Pages. No Nest behind it. Docker is the full stack.
- **Tests** (`cd backend && npm test`) cover submit-without-study, persist of the three fields, the 2-week trap, hydration vs wrinkles, 12% vs 20%, glow quotes, vitamin C vs retinol, and a 4-week readout inside a 12-week study.
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

## Repo

```
backend/prisma/schema.prisma              Claim, Assessment
backend/src/claims/                       submit, attach study, assess, products
backend/src/claims/claims.service.spec.ts
frontend/src/App.jsx                      list → scientist submit → evaluator desk
docker-compose.yml
.github/workflows/pages.yml               hosted demo
```
