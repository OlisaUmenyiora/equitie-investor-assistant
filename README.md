# EquiTie Investor Assistant

A personalised, **grounded** AI assistant an EquiTie investor can ask, in plain
language, about their own portfolio, holdings, MOIC, fees, obligations, exits and
account statement. Every number is computed deterministically from the provided
dataset and **cited by source row**; the language model only decides which tool to
call and how to phrase the answer for that specific investor.

> Prototype for the EquiTie Senior Software Engineer case study. Report date is
> fixed at **25 June 2026**. Synthetic dataset only.

---

## What it does

The assistant answers the seven question types in the brief, for a single
authenticated investor:

| Area | Example question |
|---|---|
| Portfolio overview | "How is my portfolio doing? What's my blended MOIC?" |
| A single position | "What share price did I pay for Forgecraft in each round?" |
| Obligations | "Do I have any upcoming capital calls or overdue fees?" |
| Realised outcomes | "What did I actually receive from exits after carry?" |
| Fees | "What fees am I paying on Inferna, and did I get a discount?" |
| Valuations | "How has Qubrium's valuation moved, and what's my MOIC?" |
| Account statement | "Give me a plain-language summary of my account." |

It **personalises tone and depth** (not the numbers) using each investor's profile
(age, tech-savviness) plus derived signals (deal count, top sectors, concentration):
a low-tech or older investor gets plain language with jargon explained; a
sophisticated multi-deal investor gets concise, data-dense answers.

---

## The core idea: deterministic numbers, LLM for language

The single most important design decision:

> **Code does the maths. The model does the words.**

The dataset is full of traps, the same company across multiple rounds, per-investor
share-price and fee discounts, four currencies, commitment-vs-contributed, exits,
write-offs, down rounds, partial secondaries, and similar company names. If the model
did arithmetic, it would get these wrong and present them with false confidence.

Instead, a **deterministic TypeScript layer** computes every figure and returns it
together with the dataset row ids it used. The model receives those structured
results as tool outputs and cannot invent a number, it can only relay and frame what
the tools computed. This is what wins the case study's heaviest weight (reliability &
verification) and makes answers auditable.

```
CSV files ──build step──▶ typed JSON bundle (in-memory store)
                                │
              Deterministic finance + tool layer  ◀── all scoped to investorId
                                │  (returns figures + source row ids)
        ┌───────────────────────┴────────────────────────┐
   /api/chat  (OpenAI tool-calling loop, server-side)     /api/profile, /api/investors
        │
   Next.js chat UI ──▶ renders the answer + citation chips
```

### Layers

- **`src/lib/data/`**, typed model, the CSV→JSON build step, and an in-memory store
  with the indexes the tools need (by investor, by deal, latest valuation per deal…).
- **`src/lib/fx.ts`**, currency conversion via USD. Every summed figure passes
  through it because deals are denominated in USD/GBP/EUR/AED while investors report
  in their own currency.
- **`src/lib/finance.ts`**, per-allocation computations (current value, MOIC, DPI,
  RVPI, realised fraction), the single source of truth for every number.
- **`src/lib/tools.ts`**, the eight tools the model can call (overview, position,
  obligations, realised, fees, valuations, statement, profile). Each is **hard-scoped
  to one `investorId`** and returns `sources`.
- **`src/lib/openai/`**, the OpenAI tool definitions and the chat orchestration loop.
- **`src/app/`**, the Next.js App Router UI and the API route handlers.

---

## Data isolation (privacy)

Investor-data isolation is a **code invariant, not a model instruction**. The
`investorId` is supplied by the server (the "authenticated" session user) and bound to
every tool call. It is **not** a tool parameter the model can set, so the model has no
way to query another investor's data. The UI investor-switcher simply changes which
session user is logged in. There is a unit test (`tools.test.ts`) asserting that every
cited row belongs to the requested investor.

---

## Models / APIs used and why

- **OpenAI Chat Completions with function calling**, the orchestration layer. The
  model parses intent, calls the deterministic tools, and writes the final answer.
  Configurable via `OPENAI_CHAT_MODEL` (default **`gpt-5.1`**). Chosen because GPT-5.x
  has excellent, reliable tool-calling and instruction-following; `reasoning_effort` is
  set to `low` (`OPENAI_REASONING_EFFORT`) to keep latency ~3s on follow-ups while tool
  selection here is simple.
- **`gpt-realtime-2`** (voice `marin`), powers the voice conversation surface over
  WebRTC. It registers the **same tool definitions**, so spoken answers use identical
  deterministic numbers, with citations shown in the live transcript.
- **No model does arithmetic, retrieval-ranking, or FX.** Those are plain code.

The UI follows the **equit.ai brand**: a dark, near-black teal canvas with a mint
accent and gold secondary, Space Grotesk + Inter Tight type, and the EquiTie logo.

---

## Running it

### Prerequisites
- Node 20+ (built on Node 22) and npm.
- An OpenAI API key with access to the configured model.

### 1. Configure the environment
Create `.env.local` in the project root (already git-ignored):

```bash
OPENAI_API_KEY=sk-...           # your key
OPENAI_CHAT_MODEL=gpt-5.1       # optional; any tool-calling OpenAI model
OPENAI_REASONING_EFFORT=low     # optional; low|medium|high for gpt-5/o-series
```

> ⚠️ If you received a key in plaintext anywhere, **rotate it** at
> platform.openai.com/api-keys. The key lives only in `.env.local` / Vercel env vars
> and is never committed.

### 2. Install and run
```bash
npm install
npm run build:data     # CSV -> src/lib/data/dataset.generated.json (also runs on prebuild)
npm run dev            # http://localhost:3000
```

### 3. Test and build
```bash
npm test               # 36 unit tests over the finance + tool layers
npm run build          # production build (runs build:data first)
```

---

## Verification

Correctness is proven **before** the model is involved:

- **36 unit tests** (`src/lib/*.test.ts`) assert tool outputs against hand-computed
  values for every edge case in the dataset guide: multi-round aggregation, per-investor
  price discount, exit, write-off, down round, partial secondary, pending/unfunded,
  zero-holdings, multi-currency FX, the USD admin fee on non-USD deals, fee discount vs
  deal standard, and the privacy-isolation invariant.
- **`scripts/smoke.ts`** runs real end-to-end questions through the model and prints the
  tools used, the cited source ids, and the answer, so you can eyeball that the model's
  numbers match the tested layer.

Spot-checked example (INV001, reports in GBP): blended MOIC **2.60×**, total current
value **£438,494.76**, contributed **£168,592.59**, each traceable to the cited
allocation and valuation rows.

---

## Known limitations & failure modes

- **No streaming.** Answers arrive in one shot (a typing indicator covers the wait).
  Streaming is a small follow-up.
- **History is client-held** and re-sent each turn; there's no persistence or rate
  limiting (fine for a prototype, not for production).
- **Light markdown only.** The renderer supports bold, inline code and lists, enough
  for the assistant's output; it is not a full markdown engine.
- **Latency.** The portfolio-overview answer can take ~8s because it reasons over a
  larger tool result; follow-ups are ~3s.
- **Voice** (talk to the assistant) is built on the Realtime API and reuses the same
  tools; the spoken-audio loop needs a real microphone, so it is verified manually.
- **Personalisation is rule-based** from `tech_savviness`/`age` plus derived signals;
  it changes tone only. The underlying figures are identical for every investor.
- **No auth / landing page / infra**, per the brief. The investor-switcher stands in
  for login.

---

## Project layout

```
data/                         the provided CSVs (source of truth)
scripts/build-data.ts         CSV -> typed JSON bundle
scripts/smoke.ts              end-to-end question harness (dev)
src/lib/data/                 types, generated bundle, in-memory store
src/lib/fx.ts                 currency conversion via USD
src/lib/finance.ts            per-allocation computations (current value, MOIC…)
src/lib/tools.ts              the 8 investor-scoped tools (+ tests)
src/lib/openai/               tool definitions + chat orchestration
src/components/               Sidebar, ChatMessage, types
src/app/                      UI page + /api/chat, /api/profile, /api/investors
README.md  ai-workflow.md  roadmap.md
```
