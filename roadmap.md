# Build Roadmap, EquiTie Relationship-Manager Bot

**Goal:** in six months, ship an AI relationship manager inside the EquiTie iOS
investor app that does much of what a human RM does today, not just answer questions,
but proactively manage the investor relationship, while keeping a human firmly in the
loop for advice and anything irreversible.

The prototype in this repo is Phase 0: the **grounded Q&A core** (deterministic
numbers, citations, personalisation). The roadmap turns that core into a product.

---

## 1. Scope and capabilities

**What the bot does (beyond Q&A):**

- **Grounded portfolio Q&A** (the prototype), positions, MOIC, fees, obligations,
  statements, in the investor's language and currency, always cited.
- **Proactive nudges & reminders**, upcoming capital calls, overdue/upcoming fees,
  new valuation marks, distributions hitting their account, document expiries. Push +
  in-app, scheduled from the ledger, never spammy.
- **Capital-call & payment assistance**, explain a call, show wiring details, confirm
  receipt; hand off the actual money movement to fund admin (the bot never moves cash).
- **Document & KYC workflows**, request and collect KYC/AML refreshes and tax forms,
  chase missing documents, route e-signatures, track status.
- **Onboarding**, guide a new investor from invite → KYC → first allocation, with the
  "you have no investments yet" state graduating into a funded portfolio.
- **Reporting**, generate the quarterly statement and a plain-language commentary,
  on demand or on schedule.
- **Drafting investor comms**, draft replies and updates for the **human RM to review
  and send**; the bot proposes, the human approves.

**What stays with a human (by policy):**

- Investment advice or any view on buy/sell/hold.
- Moving money, changing bank details, or changing access/permissions.
- Negotiating fees, side letters, or allocations.
- Anything legally binding or that materially changes the relationship, the bot
  prepares, a human signs off.

---

## 2. Architecture and tech stack

```
iOS app (SwiftUI) ──┐
                    ├─▶ API gateway (auth, rate limit) ─▶ Agent orchestrator (TS, Node)
 Web RM console ────┘                                          │
                                                ┌──────────────┼───────────────┐
                                          Tool/services   Retrieval (RAG)   Model layer
                                          (deterministic)  (docs, comms)    (LLM + voice)
                                                │
              Portfolio ledger · Fund admin · CRM · KYC/AML · e-sign · Comms · Valuation data
                                                │
                       Event bus + audit log (every tool call & message, immutable)
```

- **Client:** native **SwiftUI** for iOS (push, biometrics, voice). A lightweight
  **React** web console for RMs to review/approve bot drafts and see the audit trail.
- **Backend:** **TypeScript on Node** (continuity with the prototype's tool layer),
  containerised, behind an API gateway doing auth, rate-limiting and tenant isolation.
- **Orchestration:** a typed agent loop (the prototype's pattern, productionised) with
  a registry of **deterministic tools**; the financial truth stays in code, as now.
- **Data layer:** Postgres for app state; the **portfolio ledger remains the system of
  record** (the bot reads it, never writes financial facts). Redis for sessions/cache.
- **Retrieval:** a vector store (pgvector or a managed option) for *unstructured*
  context only, documents, past comms, FAQ, never for numbers.
- **Models & hosting:** a frontier hosted LLM (e.g. GPT-5.x / Claude) for reasoning and
  drafting; a realtime speech model for voice; start fully managed via API, revisit
  private hosting only if compliance demands it.
- **Evaluation & observability:** an offline eval harness gating every release; tracing
  (OpenTelemetry), structured logs, per-answer cost/latency, and an **immutable audit
  log** of every tool call and message.
- **Security:** SSO/biometric auth, per-investor data isolation enforced in code (as in
  the prototype), encryption in transit/at rest, secrets in a managed vault, least-
  privilege service accounts.

---

## 3. Data and integrations

| System | Role | Direction |
|---|---|---|
| **Portfolio ledger** | system of record for allocations, valuations, cashflows | read |
| **Fund administration** | capital calls, distributions, payments | read; trigger via human-approved actions |
| **CRM** | investor profile, RM ownership, interaction history | read/write (log interactions) |
| **KYC/AML provider** | identity/verification status, refresh requests | read/write |
| **E-signature** | document execution (subscription docs, tax forms) | trigger + status |
| **Comms** | push, email, in-app messaging | send (with approval gates) |
| **Valuation / market data** | marks, FX | read |

Data flows over the **event bus**: ledger/fund-admin events (new call, new mark,
distribution) trigger proactive nudges; bot actions (doc requested, draft created)
emit events the RM console consumes. Everything lands in the audit log.

---

## 4. AI approach and safety

- **Grounding:** structured facts come **only** from deterministic tools over the
  ledger (the prototype's principle, scaled). RAG is used solely for unstructured text
  (documents, comms, policy), never for figures.
- **Tool use:** the model orchestrates; tools execute server-side, scoped to the
  authenticated investor. New side-effecting tools (request KYC, draft comms, schedule
  reminder) are **proposal-only**, they create an action a human approves.
- **Deterministic where it counts:** all money, fees, FX, MOIC, dates and eligibility
  are code, not model output. The model never computes or moves anything.
- **Evaluation:** a versioned eval suite (numerical-accuracy graders against the
  deterministic layer + behavioural checks for refusals, privacy, tone) runs in CI;
  no prompt or model change ships without passing.
- **Guardrails & compliance:** hard "no investment advice" guardrail; PII minimisation;
  data-protection (GDPR/DPA) by design with per-investor isolation; complete,
  immutable **audit trail** for every figure shown and message sent; human approval on
  all irreversible or outbound actions; clear "this is not financial advice" framing.

---

## 5. Team and hiring

Small, senior, AI-native. Headcount ramps to ~7-8.

| Role | Count | Lands |
|---|---|---|
| Tech lead / AI engineer (me) | 1 | Month 0 |
| Senior backend/integrations engineer | 1 | Month 0-1 |
| iOS engineer (SwiftUI) | 1 | Month 1 |
| Full-stack (RM console + web) | 1 | Month 2 |
| AI/ML engineer (eval, retrieval, agents) | 1 | Month 2 |
| Product designer (part-time → full) | 1 | Month 1 |
| Compliance/legal partner (fractional) | 0.5 | Month 0 (advisory throughout) |
| QA / eval engineer | 1 | Month 3 |

Product and RM-domain input comes from an existing EquiTie RM acting as embedded SME.

---

## 6. Timeline (phased)

- **Phase 1, Months 1-2: Grounded Q&A in-app (GA-quality).** Productionise the
  prototype's tool layer against the real ledger; ship read-only Q&A + statements in
  the iOS app behind auth; eval harness live; audit logging from day one.
  *Ships: investors can ask and get cited answers in the app.*
- **Phase 2, Months 2-4: Proactive + voice.** Event-driven nudges (calls, fees,
  marks, distributions); reminders; the Realtime voice surface (same tools). RM console
  v1 for oversight.
  *Ships: the bot reaches out, and can be spoken to.*
- **Phase 3, Months 4-5: Workflows with human-in-the-loop.** KYC/document requests,
  e-sign routing, onboarding flow, and **draft-comms-for-RM-approval**.
  *Ships: the bot does RM legwork; humans approve.*
- **Phase 4, Months 5-6: Reporting, hardening, scale.** Automated quarterly reports +
  commentary, load/security testing, full compliance review, phased rollout to all
  investors.
  *Ships: a production RM bot.*

---

## 7. Risks, build-vs-buy, and cost

**Main risks & mitigations**

- **Wrong numbers / false confidence** → deterministic core + eval gate + citations
  (the whole thesis of the prototype).
- **Compliance (advice, data protection)** → hard guardrails, human approval gates,
  audit trail, compliance partner from day 0.
- **Integration fragility** (ledger/fund-admin/KYC APIs) → adapters + contract tests;
  treat the ledger as read-only source of truth.
- **Over-automation eroding trust** → proactive-but-not-spammy defaults; human-in-the-
  loop for anything outbound or irreversible; investors can dial nudges down.
- **Model/vendor risk** → keep the provider swappable (tools are model-agnostic);
  pin + eval every model change.

**Build vs buy**

- **Build:** the deterministic tool layer, agent orchestration, eval harness, and the
  iOS experience, this is the differentiated core and must be owned.
- **Buy:** KYC/AML, e-signature, comms/push, vector store, observability, and the LLM
  itself, commodity capabilities with strong vendors; don't reinvent.

**Rough cost shape (6 months)**

- **People** dominate: ~7-8 senior staff ≈ the large majority of spend.
- **AI/inference**: low-to-moderate at this scale, answers are a few tool round-trips;
  voice is the main variable cost. Budget conservatively and watch per-answer cost via
  observability.
- **Third-party SaaS** (KYC, e-sign, comms, infra/vector/observability): a modest fixed
  monthly line.
- **Infra/hosting**: small relative to people.

The investment is overwhelmingly in **engineering and compliance judgment**, not in
compute, which is exactly where the leverage for the investment team is created.
