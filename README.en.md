# 🛠 Chat Support Trainer 2.0 — “TechnoDim”

**A local chat-support operator trainer for a fictional online store.** Built in Ukrainian, fully offline: one `index.html` plus a few JS files — no server, no dependencies, no build step.

[🇺🇦 Українська версія](README.md)

![Home screen](docs/screenshots/home.png)

## What it is

A learning simulation of a support operator's shift: a customer writes in chat, you answer, and the app scores the reply with the same pipeline a mentor would — facts from the reference answer, politeness, clarity, security, checklist keywords. 160 scenarios in 12 categories, from “where is my parcel” to double charges and lost orders.

This is a **portfolio project**: the full specification ([ROADMAP.md](ROADMAP.md), Ukrainian) and a step-by-step development journal with tests and two audits ([PLAN.md](PLAN.md), Ukrainian) are published alongside the code — you can trace how a requirement became an implementation and how it was verified.

## Features

### 💬 Training
- 160 scenarios, 12 categories (delivery, payments, returns, discounts, warranty, defects, colloquial Ukrainian, complaints, hard cases, English-speaking customers…), unlocked by level.
- The customer replies according to the scenario (follow-ups), timer, drafts, reply templates.
- After closing a ticket: a strong-operator reference answer, a checklist, keyword auto-check, XP.
- Parts `scenarios_01..12.js` load dynamically — drop in a new file and the base grows without touching the code.

### 🧪 Job Assessment
- 10 random tickets, 40 minutes, no hints or reference answers; the admin panel and knowledge base stay available.
- Levels: Junior / Intermediate / Advanced / English.
- At the end: average QA Score / 100 and a per-ticket breakdown. **No XP is awarded in this mode** — learning and testing stay separated.

### 🕹 Live Shift
- A 15/30/45-minute shift: customers arrive on schedule, up to 2–3 parallel chats, overflow goes to a queue.
- Customer patience: 90 s without a reply — “Hello?”, ~3 min — the customer leaves (abandoned).
- Operator status Ready / Not ready, hold, escalations, ticket closing.
- Metrics: FRT (first response), AHT, Resolution Rate, average QA; an XP bonus only when average QA ≥ 70.
- The shift survives a page reload.

![Live Shift](docs/screenshots/live-shift.png)

### 🧭 Escalation system
- 24 mandatory + 7 “handle yourself” situations: correct department, priority, internal note, customer notification.
- A missed mandatory escalation hurts both score and XP; escalating to the wrong department caps the maximum score.

### 🇬🇧 English Mode
- 18 English-language scenarios + a detector for ~67 typical grammar mistakes (“I am agree”, “will be arrive”, “refund will back”…) with hints; Ukrainian answers are never flagged, and the 18 reference answers trigger zero false positives.

![Assessment](docs/screenshots/assessment.png)

### 📊 Statistics and profile
- XP, levels, streaks, badges, quests; per-category stats, 14-day QA trend, top recurring mistakes, separate histories for tests and shifts.

![Statistics](docs/screenshots/statistics.png)

### 🔒 Data and safety
- Progress lives in your browser's `localStorage`; stepwise schema migration with a backup key.
- A corrupted JSON is never overwritten: the raw string is kept in a separate key, the app shows a banner and runs in a temporary session.
- One-file export/import of progress (including Assessment and Shift state).
- Forbidden topics (CVV/PIN, guarantees, rudeness) are caught by a dedicated FORBIDDEN list and destroy the answer's trust score.

## Tech

- **Vanilla JavaScript** — no dependencies, no framework, no build step.
- **localStorage** — state, schema migrations, export/import.
- **Inline SVG** for charts; plain CSS.
- Works straight from `file://` (there is not a single `fetch`/XHR call) and from any static host.

## Run it

**Option 1 — just open the file.** Double-click `index.html`; the app works from `file://`.

**Option 2 — a local server** (gives the app its own origin for testing):

```bash
python -m http.server 8080
# open http://localhost:8080
```

**Option 3 — GitHub Pages.** Enable Pages in the repository settings (branch `main`, root) — that's all: every path is relative.

## How answers are scored (transparency)

Scoring is a deterministic pipeline with no neural network: basic checks (greeting, caps, empathy) → extracting the reference answer's facts via stems with negation detection → contradictions → FORBIDDEN → grammar → checklist → 6 quality criteria → QA Score / 100 and XP. This is a training simulation, not a perfect judge: **lexical synonyms that are not in a scenario's stem dictionary count as a missed fact**. We deliberately do not pretend to “understand meaning” — instead the scoring rules are honestly documented and identical across training, assessment and shifts.

## Limitations

- Stem-based scoring: synonyms absent from a scenario's dictionary are not recognized.
- Scenarios have fixed follow-ups — it is a simulation, not a live conversation.
- All companies, products, order numbers and customers are fictional.
- This is a learning project: the metrics (FRT/AHT/Resolution) are trainer numbers, not real contact-center benchmarks.

## Repository layout

```
chat-support-trainer/
├── index.html          # the app: UI, scoring pipeline, migrations, statistics
├── scenarios.js        # core scenarios
├── scenarios_01..06.js # extra parts (25–30 scenarios each)
├── assessment.js       # Job Assessment Mode
├── shift.js            # Live Shift Mode
├── escalation.js       # escalation system
├── eng-mistakes.js     # typical English-mistake detector
├── ROADMAP.md          # the original specification (Ukrainian)
├── PLAN.md             # development journal: stages, tests, audits (Ukrainian)
└── docs/screenshots/   # screenshots
```

## Extending the scenario base

Create `scenarios_07.js` following the existing parts — each scenario is an object with a category, difficulty, first customer message, follow-ups, a reference answer, key facts and escalation rules. The loader picks the file up automatically (up to 12 parts), even when the app is opened straight from disk.
