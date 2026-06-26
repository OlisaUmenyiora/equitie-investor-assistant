# ai-workflow.md

How AI was used to build this prototype, and how I kept it honest.

## Which AI tools and models did I use, and for what?

- **Claude (Anthropic) as the coding agent** — used to scaffold the Next.js app,
  write the deterministic data/finance/tool layers, the OpenAI orchestration, the
  UI, and these docs. It also explored the dataset (header/edge-case inspection) and
  drove the browser to visually verify the running app.
- **OpenAI `gpt-5.1` (Chat Completions + function calling)** — this is the runtime
  model inside the product. It parses the investor's question, calls the deterministic
  tools, and phrases the answer in the investor's preferred tone. `reasoning_effort`
  is set to `low` for snappy responses.
- **`gpt-realtime`** — selected (and the key verified against it) for the planned
  voice surface; not yet wired.

Model choice was grounded, not assumed: I listed the API key's actually-available
models before committing, rather than hard-coding a guess.

## Roughly what percentage of the code was AI-generated?

**~90%.** Almost all of the TypeScript (data layer, FX, finance, tools, OpenAI loop,
React components, tests) was AI-written. My role was the **judgment**: the
architecture (deterministic core vs. model), the edge-case list to test, the exact
financial formulas and their interpretation, the privacy invariant, the model and
parameter choices, and the design direction. The ~10% I hand-shaped were the decisions
that determine whether the numbers are right.

## What did I reject or materially change from AI suggestions, and why?

- **Let the LLM do the maths → rejected.** The instinctive "give the model the CSVs
  and ask it" approach fails the dataset's traps (multi-round, FX, carry, discounts).
  I forced all arithmetic into tested code and limited the model to orchestration and
  language. This is the central design decision.
- **`investorId` as a tool argument → rejected.** Letting the model pass the investor
  id would make data isolation a matter of trust. I bound the id server-side so the
  model *cannot* request another investor's data, and added a test for it.
- **Pending allocation valued at units × mark → changed.** A signed-but-unfunded
  allocation lists nominal units, which would inflate "current value." I treat Pending
  (0% contributed) as a commitment, not a holding, so its live value is 0 and MOIC is
  undefined — matching the guide's "not deployed capital."
- **Injecting model output as raw HTML → replaced.** A security check (rightly) flagged
  the raw-HTML rendering path. I rewrote the markdown renderer to emit React elements,
  so there's no HTML-injection surface even though the model output is semi-trusted.
- **Hand-rolled CSV parsing and ad-hoc rounding → tightened.** I used `csv-parse`,
  kept all rounding to display only (never inside running calculations), and always
  convert currency via USD using the row's own currency (important: the admin fee is
  billed in USD even on non-USD deals).

## How did I verify the assistant's answers were correct?

Three layers, strongest first:

1. **Hand-computed unit tests (36).** Before any model call, I derived expected values
   from source rows (e.g. INV001's Forgecraft Seed: 17,777.78 units × $15.40 mark ÷
   $40k contributed = 6.84× MOIC) and asserted the tool layer reproduces them — across
   every trap: multi-round, price discount, exit, write-off, down round, partial
   secondary, pending, zero-holdings, multi-currency, and the USD admin fee. The
   privacy-isolation invariant is a test too.
2. **End-to-end smoke runs (`scripts/smoke.ts`).** Real questions through the live
   model, printing the tools used and the cited row ids, to confirm the model's
   surfaced numbers equal the tested layer's — and that ambiguity (Northpeak) triggers
   a clarifying question instead of a guess.
3. **In-app verification.** Drove the running UI in a browser and read the rendered DOM
   to confirm, for example, that the obligations answer shows the $450 admin fee as
   £333.33 and the $10,400 outstanding as a £7,703.70 capital call — correct FX, cited.

Because the numbers come from code, "did the model get the maths right?" reduces to
"do the tests pass?" — which is a far stronger guarantee than eyeballing LLM output.

## If I had an autonomous coding agent for another 8 hours, what would I point it at?

In priority order:

1. **An eval set.** Generate ~50 question/expected-answer pairs spanning all edge
   cases, and a grader that checks the model's stated figures against the deterministic
   layer. This turns "looks right" into a regression-proof score and guards prompt or
   model changes.
2. **Streaming responses** for a snappier feel, with the citation chips resolved at the
   end of the stream.
3. **The Realtime voice surface** — mint an ephemeral token server-side, register the
   same tool definitions, and surface citations in the transcript pane.
4. **A "show the workings" affordance** — clicking a citation chip opens the exact
   source row(s), so an investor or their RM can audit a figure inline.
5. **Hardening** — request validation, rate limiting, server-side conversation
   persistence, and a small guardrail eval for "no investment advice."
