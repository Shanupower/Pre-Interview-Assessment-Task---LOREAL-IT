# L'Oréal Claims Intelligence Engine

Task A — technical proposal. The working slice lives in `backend/` and `frontend/`. This note is the thinking behind it.

## Business process understanding

The flow they described isn't a single form. It's a relay.

Business puts a product on the table with a set of claims. Some of those will be ambitious ("reduces wrinkles by 20% in 4 weeks"), some will be table stakes, some won't survive contact with regulation. Claim managers then cut the list: is this claim even allowed for the category, and is it feasible given the formula and the time we have? Only after that does Paris R&I spend money. A scientist locks a formula. An evaluator runs (or commissions) the study and attaches the results.

The expensive mistake is downstream of that relay: treating a study as if it automatically carries the claim. A 2-week wrinkle study does not support a 4-week claim, even if the graph looks great. That's the slice this MVP covers — evaluator evidence in, a first-pass read on whether the study actually speaks to the wording of the claim, result stored, shown in the UI.

I didn't build the manager queue or the formulation lab. Those are real stages. They're not the core feature they asked for. `POST /api/claims/assess` sits after the evaluator has something to attach.

## Research performed designing the solution

Cosmetic claims in the EU aren't a marketing opinion. Regulation 655/2013 (the common criteria) is blunt about it: claims have to be truthful, evidential, honest, and fair. "Evidential support" is the one that bites R&I. The evidence has to match what you said, not a nearby story. If you claimed 20% in 4 weeks, a well-run 2-week study at 21% is still a miss on duration. Consumer quotes about "glow" don't move an instrumental wrinkle claim.

I also don't trust an LLM as a sign-off. These models are decent at comparing two texts and sloppy with numbers. They'll happily round a study into a yes. So the model here is a reviewer, not a judge: it returns `justified`, a confidence, and reasoning we persist. A person in evaluation still owns the decision. That's why Assessment is a row we write, not a flag we flip on Claim — if they attach a second study later, we keep the first read.

Structured JSON out of the model is the other practical bit. Free-text "yes it seems supported" is useless in a UI and worse in a database. Force `{ justified, confidence, reasoning }` or fail the call.

## Technical architecture justification

They asked for NestJS, a Claim + Assessment model, one POST, and a React screen. That's what I built. Prisma over TypeORM because the schema is two tables and I wanted the reviewer to run this without a Postgres container. SQLite is a demo convenience; the models don't care. Swap the datasource later.

The API is intentionally small. Validate the body, insert the claim (formula included, because that's what the scientist submitted), call the model, insert the assessment, return both. OpenAI is `gpt-4o-mini` with `json_object`. If there's no API key — likely, on a laptop during review — the same method returns a deterministic stand-in so the UI still works. I didn't hide that behind a strategy interface. It's a take-home, not a platform.

Append-only assessments are the one design choice I'd argue for in a real review: overwriting yesterday's result would make an audit trail lie.

## Product roadmap if you had ample time and no boundaries on solution evolution design

If this were a real R&I tool and time wasn't a day:

1. Put the claim manager stage in software. Applicability / feasibility as an explicit gate, with a reason when something dies. That's where most claims should stop, before a study is paid for.
2. Let evaluators drop in the actual report (PDF), pull out methods and endpoints, and hang that on the assessment instead of a paste box.
3. Human override: evaluator can disagree with the model, and we store both. Disagreement is useful data.
4. A library of our own studies, so the question isn't "does this paste match this sentence" but "have we already generated evidence that could carry this claim, or a narrower one?"
5. More than one claim per product, versioned formulas, and a French/English UI because that's how Paris actually works.

I wouldn't start with identity, Kubernetes, or a claims "platform." The bottleneck is the relay and the evidence, not the cluster.
