# LAO Competitive Engineering Intelligence

**Version:** 1.0
**Status:** Living document — revise before each significant capability is built
**Last Updated:** 2026-08-09
**Owner:** LAO Engineering

---

## Purpose

This document exists to stop LAO building things badly that other people have already learned how to build well, and to stop LAO copying things that only *look* like they work.

It is not a feature list and not a competitor brochure. For each category it records what the strongest products actually do, where they measurably fail, what that implies for LAO's architecture, and what LAO should write itself.

**Standing rule:** research does not authorise implementation. Nothing in this document is a commitment to build. Each capability must still pass the value test (§B) and the build-vs-borrow classification (§C) before any code is written.

### How to read this with the rest of the docs

This document sits *above* the existing LAO specifications and does not supersede them:

| Existing doc | Relationship |
|---|---|
| `ARCHITECTURE.md` | Constrains everything here. The adapter/registry/no-hardcoded-providers rules are assumed, not re-litigated. |
| `PROVIDER_REGISTRY.md` | This document supplies the **licence and risk posture** for entries in that registry. |
| `ADAPTER_SPECIFICATION.md` | Every "ADAPT" verdict below must land behind an adapter defined by that spec. |
| `AGENT_SYSTEM.md` | Category verdicts map to NATO agents (noted per category). |
| `AUTHORIZATION_AND_AUDIT.md` | Approval gates and audit obligations identified here feed that spec. |

---

## A. Executive findings

Seven findings from this research change how LAO should be built. They are ordered by how much they should change behaviour.

**A1. The AI tutoring premise most products are sold on is false, and the true version is more useful.**
Bloom's "2 sigma" claim — the one nearly every AI-tutor pitch deck cites — has never replicated at that magnitude. A 2020 meta-analysis of 96 tutoring studies found an average effect of roughly **0.37σ**, not 2σ, and the original studies were short, novel-topic experiments tested immediately on the taught material. Critically, the evidence suggests the potency came from **tutoring combined with mastery learning**, not tutoring alone. *Implication: LAO's differentiator is not "we have an AI tutor." It is mastery gating — not letting a learner advance on evidence they have not produced. That is the half everyone drops because it is the half that annoys users.*

**A2. An AI assistant without pedagogical guardrails makes learners measurably worse.**
The PNAS study on high-school mathematics is the single most important input to LAO's AI design. Students with a plain ChatGPT-style interface improved 48% *while they had access* — then scored **17% worse than students who never had access at all** once it was removed. A version prompted to give teacher-designed hints instead of answers both improved in-session performance more (127%) and largely eliminated the damage. *Implication: an answer-dispensing chatbot is not a neutral feature that we can add now and refine later. It is actively negative for LAO's stated goal. The hint-ladder contract in §D1 is a correctness requirement, not a nicety.*

**A3. Course length predicts completion more strongly than course quality.**
MOOC completion sits at 5–15% (median ~12.6% across 221 courses; ~6% average across 61 Coursera courses). But sub-2-hour micro-learning completes at 80–90%, while 40+ hour courses complete at 5–10%. 50% of dropouts occur in the first two weeks; the top causes are lack of time (38%) and lost motivation (25%). *Implication: LAO should refuse to ship a 40-hour course format at all. The unit of learning should be small enough to finish in one sitting, and the first two weeks deserve disproportionate engineering.*

**A4. Commitment beats motivation mechanics.**
Paying even $29 for a certificate increased completion probability roughly **6x** versus auditing the same course free. That is a larger effect than any streak or badge system reports. *Implication: LAO's retention design should favour genuine commitment devices (a real project with a deadline, a public portfolio artifact, a client expecting delivery) over engagement mechanics. This aligns with the LEARN→BUILD→LAUNCH→EARN thesis rather than fighting it.*

**A5. Remotion's licence directly taxes LAO's stated video pipeline.**
Remotion is **not** OSI open source. It is free for individuals, non-profits, and for-profits with **up to 3 employees**. For-profit companies with 4+ employees need a paid Company Licence, and LAO's exact intended use — an automated lesson-video pipeline — falls under the "Automators" tier at **$0.01/render with a $100/month minimum spend**. *Implication: this is a real, recurring cost with an employee-count cliff. It does not block use, but it must be a deliberate, adapter-isolated decision with a known exit — see §7 and §D6.*

**A6. n8n cannot be LAO's embedded automation engine.**
n8n is source-available under the Sustainable Use License, not open source. Use is limited to **internal business purposes** or personal/non-commercial use. Running n8n as the automation engine that LAO's paying learners use is not internal use. *Implication: study n8n's UX (it is excellent), do not embed its code. Kestra (Apache-2.0) and Temporal (MIT) are the licence-safe engines.*

**A7. The best learning-platform code is nearly all network copyleft.**
Moodle is GPL-3.0; Open edX, Canvas LMS, SuiteCRM, and Cal.com core are AGPL-3.0; Mautic is GPL-3.0. AGPL's network clause triggers source-disclosure obligations when the software is *accessed over a network* — which is exactly how LAO would serve it. *Implication: this category is "study, don't adopt." The lessons are free; the code is not, at LAO's intended posture.*

**A8. Piper — a provider already named in LAO's registry — relicensed, and the safe version is now unmaintained.**
`PROVIDER_REGISTRY.md` lists Piper as a local TTS provider. The MIT-licensed repository (`rhasspy/piper`) was **archived on 6 October 2025** and is read-only. Development moved to `OHF-Voice/piper1-gpl`, which is **GPL-3.0**. This forces a real choice: use the MIT version and accept unmaintained software with no security updates, or use the maintained version and accept GPL-3.0 obligations. *Implication: this is not hypothetical licence trivia — it is a live decision on a component LAO has already specified. It also demonstrates why the register below records licence posture as a thing that must be re-verified at adoption rather than assumed from memory: this licence changed within the last year.*

### What this means in one sentence

The competitive opportunity is not more features. It is that **almost every incumbent optimises for course consumption, while the evidence says outcomes come from mastery gating, short units, real commitment, and an AI that withholds answers** — and nobody is doing all four at once, because each one individually depresses the engagement metrics these products are measured on.

---

## B. The value test (applied, not asserted)

Per the standing principle, no capability is built without answering the four questions. Applied to the major candidates in this document:

| Capability | Problem solved | Who suffers today | LEARN | BUILD | LAUNCH | EARN | Verdict |
|---|---|---|---|---|---|---|---|---|
| Mastery ledger + gating | Learners advance without competence, then stall on real work | Beginners who "finished a course" and still cannot build | ✅ | ✅ | — | — | **Build** |
| Hint-ladder AI coach | Answer-giving AI creates dependency and worse outcomes (A2) | Every learner using a generic chatbot | ✅ | ✅ | — | — | **Build** |
| Evidence graph → portfolio | Completion certificates are not credible proof of capability | Learners with no employment/client signal | — | ✅ | ✅ | ✅ | **Build** |
| Progression engine (L→B→L→E) | The learn-to-earn gap is unstructured and most people fall in it | Learners who finish learning and stop | ✅ | ✅ | ✅ | ✅ | **Build** |
| Lesson video generation | Text-only lessons exclude several learning modes; manual video is slow | Neurodivergent and low-literacy learners; LAO content ops | ✅ | — | — | — | **Build (thin)** |
| Automation workflows | Repeated manual steps in launching/running a small venture | Learners at LAUNCH/EARN | — | ✅ | ✅ | ✅ | **Adapt** |
| Lightweight project tracking | Beginners drown in enterprise PM tools | Learners at BUILD | — | ✅ | ✅ | — | **Build (minimal)** |
| CRM / pipeline | Tracking clients and follow-ups once earning starts | Learners at EARN only | ❌ | ❌ | ⚠️ | ✅ | **Defer — narrow slice only** |
| Booking / calendar | Scheduling calls with clients | Learners at EARN only | ❌ | ❌ | ❌ | ⚠️ | **Do not build — link out** |
| Community platform | Isolation is a top dropout cause | All learners | ✅ | ✅ | — | — | **Defer — integrate, don't build** |

The two ❌-heavy rows are the honest output of this test: **LAO should not build a CRM or a booking system.** Both are commodity, both are solved, and neither helps a learner learn or build. Section 7 and 3 explain what the narrow exceptions are.

---

## C. Build-vs-borrow register

Classification per the standing rule: **A — USE** (commodity, no advantage), **B — ADAPT** (permissive, sits behind an LAO interface), **C — STUDY THEN BUILD** (solved, but LAO can do materially better), **D — LAO ORIGINAL** (strategic IP).

| Capability | Class | Rationale |
|---|---|---|
| Learner intelligence / learner state model | **D** | Core IP. Everything else reads from it. No external component models a learner *and* their venture. |
| Mastery & progression model | **D** | The evidence in A1 says this is the actual mechanism. Must be ours. |
| AI coaching architecture (hint ladder) | **D** | A2 makes this a correctness-critical contract, not a prompt. |
| Evidence graph / portfolio intelligence | **D** | Trust mechanism. Directly serves EARN. Nothing comparable exists. |
| LEARN→BUILD→LAUNCH→EARN progression | **D** | The product thesis. Cannot be borrowed. |
| Lesson authoring & delivery | **C** | LMS category is mature but bloated and copyleft (A7). Build small. |
| Assessment & spaced practice scheduling | **C** | Algorithms are public and well-understood; implementations are heavy. |
| Workflow / automation engine | **B** | Temporal (MIT) or Kestra (Apache-2.0) behind an LAO workflow interface. |
| Agent framework | **B** | Already correct in `AGENT_SYSTEM.md` — LAO abstraction, swappable framework. |
| Video rendering / composition | **B** | Remotion + FFmpeg behind a render adapter. Licence-loaded (A5) — exit path required. |
| Speech synthesis / captions | **B** | Already covered by the voice adapter category. |
| Auth, storage, queues, email delivery | **A** | Commodity. Zero advantage in owning. |
| Booking / calendar | **A** | Link out to an existing tool. Do not build, do not host. |
| CRM / pipeline | **A→C** | Commodity as CRM; the narrow "opportunity tracking" slice is C. |
| Community | **A** | Integrate an existing platform. Do not build a forum. |

---

## D. Category intelligence

Each category records: leading products, leading open source, what genuinely works, where they fail, architecture/UX/accessibility lessons, licence posture, and LAO's verdict.

---

### D1. Learning platforms

**Leading products:** Khan Academy, Duolingo, Coursera, Udemy, Brilliant, Codecademy, freeCodeCamp
**Leading open source:** Moodle (GPL-3.0), Open edX (AGPL-3.0), Canvas LMS (AGPL-3.0), freeCodeCamp (BSD-3-Clause code; curriculum separately licensed)

#### What genuinely works

| Product | The idea worth stealing | Why it works |
|---|---|---|
| Khan Academy | Mastery-based progression with prerequisite graph | Aligns with the only mechanism A1 actually supports |
| Duolingo | Sessions short enough to complete on a phone queue | Directly attacks the "no time" 38% dropout cause |
| Duolingo English Test | IRT-based computer-adaptive testing — harder items to stronger learners | Measures ability in far fewer items than a fixed test |
| Brilliant | Learn *by* solving, not by watching then solving | Removes the passive-consumption gap where dropout happens |
| freeCodeCamp | Certification requires building 5 real projects | Evidence of capability, not evidence of attendance |
| Codecademy | Zero-setup in-browser environment | Environment setup is a brutal, invisible beginner filter |
| Brilliant/Duolingo | Immediate, specific feedback on the attempt | Delayed feedback is near-worthless for correction |

#### Where they measurably fail

- **Consumption is the measured unit.** Completion of *videos* and *streaks* are the tracked metrics, not capability. This is why 5–15% completion coexists with high "engagement."
- **The 40-hour course is a known-bad format that persists** because it justifies price, not because it works (A3).
- **Certificates are not evidence.** A completion certificate asserts attendance. Employers and clients discount them accordingly — freeCodeCamp is the notable exception precisely because it requires artifacts.
- **The learn-to-apply cliff.** Every platform ends at "course complete." The learner is then alone. This is LAO's entire opening.
- **Streaks punish life.** Duolingo's streak is a powerful commitment device that inverts into a quit trigger the day it breaks. Loss-framed mechanics manufacture churn events.
- **LMS bloat.** Moodle/Open edX/Canvas are institution-shaped: cohorts, gradebooks, terms, registrar integrations. Nearly none of it serves an individual learner.

#### Architecture lessons

1. **Separate the content graph from the progress ledger.** Every mature LMS conflates them and pays for it forever. LAO's lesson content should be immutable, versioned, addressable data; learner progress should be an append-only event log referencing content versions. This means content can be edited without corrupting history — and history stays auditable, which LAO already requires (`AUTHORIZATION_AND_AUDIT.md`).
2. **Model prerequisites as a DAG, not a linear course.** A sequence is a special case of a graph. Starting linear forecloses adaptivity; starting with a graph costs little.
3. **Assessment items need stable identity and difficulty metadata** from day one. Retrofitting IRT-style calibration onto items that lack identity is expensive.
4. **Progress events belong on LAO's existing event-driven backbone**, not in a separate subsystem.

#### UX lessons

- Default lesson unit target: **completable in one sitting on a phone** (A3).
- Always show *what is unlocked next* and *what evidence unlocks it* — mastery gating is only tolerable when the gate is legible.
- Resume must be exact. Losing position is a silent churn cause.
- Never let a learner get stuck with no path forward; the hint ladder (§D2) is the escape hatch.

#### Accessibility lessons

- Moodle and Open edX have genuinely invested in accessibility and are worth studying as reference implementations, particularly for keyboard navigation and screen-reader semantics in complex interactive widgets.
- Interactive assessment widgets are where most platforms fail WCAG. Drag-and-drop without a keyboard equivalent is the classic defect.
- Video without accurate captions and transcript excludes deaf/HoH learners *and* everyone in a noisy room — this is the highest-leverage accessibility investment in the product.

#### Licence posture

| Project | Licence | Consequence for LAO |
|---|---|---|
| Moodle | GPL-3.0 | Distribution/derivative obligations. Study only. |
| Open edX | AGPL-3.0 | **Network-use copyleft.** Serving it to LAO users triggers source disclosure. Study only. |
| Canvas LMS | AGPL-3.0 (community edition) | Same as above. Instructure's commercial licence removes it — at cost. Study only. |
| freeCodeCamp | BSD-3-Clause (code) | Permissive, but curriculum is licensed separately — do not assume the content carries the code licence. |

> ⚠️ **A7 in practice:** none of the strong open-source LMS platforms can be folded into LAO at its intended posture without either source-disclosure obligations or a commercial licence. This is a *design gift*, not a setback — it forces LAO to build something small and learner-shaped instead of inheriting an institution-shaped monolith.

#### LAO verdict

- **Use:** nothing directly.
- **Avoid:** adopting any full LMS; the 40-hour course format; loss-framed streaks; certificates as the terminal output.
- **Improve:** mastery gating that is actually enforced; one-sitting units; evidence as the output instead of certificates.
- **Class:** **C — STUDY THEN BUILD.**

---

### D2. AI learning

**Leading products:** Khanmigo, Duolingo Max, Synthesis, various LLM tutors
**Concepts studied:** Socratic tutoring, adaptive engines, intelligent tutoring systems, multimodal learning

#### The decisive evidence

This category has more marketing than evidence, but two rigorous studies bracket the truth:

| Study | Finding | What it tells LAO |
|---|---|---|
| PNAS, high-school maths | Plain ChatGPT interface: +48% with access, **−17% versus never having access** once removed. Guardrailed tutor: +127% with access, damage largely eliminated. | The *interface contract* determines whether AI helps or harms. Not the model. |
| Kestin et al., Harvard physics | Students learned more in less time with a well-designed AI tutor than in an active-learning class | The ceiling is genuinely high **when the design is right** |

Read together: the variance between "AI tutor helps enormously" and "AI tutor causes harm" is almost entirely **design**, not model capability. This is unusually actionable — it means LAO's advantage here is achievable with engineering discipline rather than a frontier-model budget.

#### Where current AI tutors fail

- **They answer.** The default LLM behaviour is to be maximally helpful *right now*, which is precisely the behaviour that produces the −17%.
- **They are context-blind.** A chatbot bolted onto a lesson does not know what the learner already mastered, failed last week, or is building. It re-explains what they know and skips what they don't.
- **They are stateless across sessions.** Every conversation restarts the relationship.
- **They cannot verify.** They will confidently assess a wrong answer as right, and no audit trail exists to catch it.
- **Privacy is an afterthought.** Learner struggle data is among the most sensitive data a product can hold; most tutors ship it to a third-party API with no learner-visible control.

#### Architecture lessons

1. **The tutor must be a consumer of learner state, not an owner of it.** If the AI holds context in a conversation buffer, the context dies with the session and cannot be audited or corrected. Learner state must be a first-class store (§E1) that the tutor reads.
2. **Model choice must be swappable.** Already correct in LAO's architecture — the tutor sits behind the LLM adapter category, never referencing a provider.
3. **The pedagogical contract belongs in LAO code, not in a prompt.** A prompt is advisory; the model can and will violate it. Answer-withholding for assessed items must be enforced by LAO's own logic — a response that would resolve an open assessment item is rejected or downgraded before it reaches the learner.
4. **Every tutoring exchange is an auditable event.** LAO already has the audit spine; tutoring should use it. This also produces the dataset needed to measure whether the tutor is helping (§F).
5. **Privacy boundary is architectural.** Learner state sent to an external model must pass through an explicit, minimising projection — the tutor gets what it needs for *this* interaction, not the learner's full history.

#### UX lessons

- Escalate help in graded steps; never jump to the answer.
- Make it visible that help was used — help usage is signal, not shame, and it feeds mastery evidence weighting.
- Let the learner ask "just tell me" — and honour it *only* on non-assessed material, with the item then marked as taught-not-demonstrated.
- Voice input is an accessibility feature and a mobile convenience simultaneously.

#### Accessibility lessons

- Multiple explanation modes for the same concept (text / spoken / visual / worked example / analogy) is the single most valuable adaptive behaviour for neurodivergent learners, and it is far easier than full adaptive sequencing.
- Do not use time-to-answer as a competence signal without an accommodation path — it penalises processing-speed differences, not understanding.
- Plain-language rewriting on demand serves dyslexic learners, ESL learners, and stressed learners at once.

#### Licence posture

Concepts, not code. No licence exposure. Model providers sit behind LAO's existing LLM adapter.

#### LAO verdict

- **Use:** LLM providers via adapter (already specified).
- **Avoid:** a general-purpose chat window; unbounded answer-giving; conversation-buffer-as-memory; shipping raw learner history to third parties.
- **Improve:** enforce the hint ladder in code; ground the tutor in real learner state; make it auditable and measurable.
- **Class:** **D — LAO ORIGINAL** (the coaching architecture), **A — USE** (the underlying models).

---

### D3. Business building (CRM)

**Leading products:** GoHighLevel, HubSpot, Salesforce, Pipedrive, Zoho
**Leading open source:** Odoo (LGPL-3.0 community), SuiteCRM (AGPL-3.0), Mautic (GPL-3.0)

#### What works

- **Pipeline-as-stages** is a genuinely good abstraction — it makes an abstract process concrete and shows what to do next.
- **Pipedrive's discipline:** every deal has a next action with a date. This single constraint is most of the value of a CRM.
- **GoHighLevel's insight** is bundling — the small operator wants one thing that works, not seven integrations. This is directly relevant to LAO's audience.
- **Contact-as-timeline** — one place showing everything that happened with a person.

#### Where they fail LAO's user

- They assume you **already have** a business, customers, and a sales process. LAO's learner has none of these. A CRM presented to someone with zero leads is an empty, discouraging spreadsheet.
- Enterprise complexity: custom fields, territories, forecasting, permissions. All irrelevant.
- They optimise for *managing* volume, not *getting the first one*. The first client is a completely different problem to the hundredth, and no CRM addresses it.

#### Architecture lessons

- Stages should be data, not code — but LAO should ship one opinionated default rather than a stage builder.
- Contacts and opportunities are commodity schemas; do not over-invent them.
- Timeline/activity modelling maps cleanly onto LAO's existing event log — same backbone, different projection.

#### UX lessons

- For someone with 0–5 prospects, a list with a next action beats a kanban board.
- "What should I do today?" is the only view that matters at this scale.

#### Accessibility lessons

- Kanban drag-and-drop is a recurring WCAG failure. If LAO ever builds a board, keyboard move-to-stage is mandatory from the first commit, not a follow-up.

#### Licence posture

| Project | Licence | Consequence |
|---|---|---|
| Odoo (community) | LGPL-3.0 | Weak copyleft — usable across a boundary, but heavyweight and ERP-shaped. |
| SuiteCRM | AGPL-3.0 | Network copyleft. Study only. |
| Mautic | GPL-3.0 | Strong copyleft. Study only. |

#### LAO verdict

**Do not build a CRM.** The value test (§B) returns ❌ for LEARN and BUILD, and the EARN benefit is served by a far smaller object.

Build instead: an **opportunity record** attached to the progression engine — who, what they might need, what LAO capability matches it, next action, date. That is roughly 5 fields, not a CRM. If a learner outgrows it, that is a success signal and they should export to a real CRM.

- **Class:** **A** as CRM (don't build), **C** for the narrow opportunity-tracking slice.
- **Agent mapping:** Kilo (KK), constrained hard.

---

### D4. Automation

**Leading products:** Zapier, Make
**Leading open source:** Temporal (MIT), Kestra (Apache-2.0), n8n (Sustainable Use License — **not** open source), Mautic workflows (GPL-3.0)

#### What works

- **Trigger → condition → action** is the correct mental model and is now universally understood. Do not invent a new vocabulary.
- **Zapier's templates** — most users do not want to build a workflow, they want to pick one that already exists.
- **n8n's execution view** — showing the actual data at each step is the best debugging UX in the category, and it is why people tolerate self-hosting it.
- **Temporal's durable execution** — workflows survive process death and resume exactly. This is the correct engineering answer for anything long-running.
- **Kestra's declarative YAML** — workflows as version-controllable data rather than code.

#### Where they fail

- Zapier/Make get expensive fast at volume and are opaque about failure.
- n8n is powerful but is a developer tool wearing a no-code costume; beginners hit the complexity wall quickly.
- Temporal is excellent and genuinely hard — it demands real engineering investment and is not something a learner will ever touch directly.
- Almost all of them handle **partial failure** poorly from the user's perspective: the run failed, something half-happened, and the user cannot tell what.

#### Architecture lessons

1. **LAO already has an event-driven architecture — do not replace it.** The standing instruction is correct. The right move is a workflow *interface* over the existing event backbone, with a durable engine behind it only where durability is genuinely required.
2. **Durability is the feature.** Retries, idempotency, and resumability are the entire reason to adopt an engine rather than write a scheduler.
3. **Human approval must be a first-class workflow state**, not an out-of-band hack — LAO's authorization spec already requires approval gates for high-impact actions, and workflows will invoke exactly those actions.
4. **Workflow history is an audit artifact.** Same spine again.

#### UX lessons

- Ship recipes, not a builder. A builder is the *second* product.
- Show the data at each step (learn from n8n).
- On failure, state plainly what completed and what did not.

#### Licence posture

> ⚠️ **n8n — hard constraint (A6).** The Sustainable Use License permits use and modification **only for internal business purposes or personal/non-commercial use**, and prohibits reselling the service. Operating n8n as the automation engine that LAO's learners use is *not* internal use and would require a separate commercial agreement with n8n. n8n has relaxed restrictions on consulting/support services, which does not help this use case.
>
> **Verdict: study n8n's UX. Do not embed n8n's code.**

| Project | Licence | Verdict |
|---|---|---|
| Temporal | MIT | ✅ Safe. Best choice if durable execution is genuinely needed. |
| Kestra | Apache-2.0 | ✅ Safe (OSS core; enterprise edition is separate). Good if declarative YAML fits. |
| n8n | Sustainable Use License | ❌ Cannot embed as customer-facing engine. |
| Mautic | GPL-3.0 | ❌ Strong copyleft. Study only. |

#### LAO verdict

- **Use:** Temporal (MIT) or Kestra (Apache-2.0), behind an LAO workflow adapter.
- **Avoid:** embedding n8n; replacing LAO's event architecture; shipping a node-graph builder as v1.
- **Improve:** failure honesty; approval-as-state; recipes over builders.
- **Class:** **B — ADAPT.**
- **Agent mapping:** India (II).

---

### D5. AI agents

**Studied:** OpenAI Agents SDK concepts, LangGraph (MIT), CrewAI (MIT), AutoGen/AG2 (Apache-2.0), OpenHands, Aider, Continue

#### What works

- **LangGraph's explicit state graph** — agent flow as an inspectable graph with checkpointing, rather than an opaque loop. This is the strongest architectural idea in the category.
- **CrewAI's role/task decomposition** — readable and maps almost directly onto LAO's existing 26-agent NATO model.
- **AutoGen/AG2's conversational multi-agent patterns** — useful for structured critique and review loops.
- **OpenHands' sandboxing** — agents that touch a filesystem or shell must be contained. Non-negotiable.
- **Aider's repo-map + git discipline** — every agent change is a commit, so every change is reviewable and revertible. This is the best audit pattern in the category and LAO should adopt the *principle* directly.
- **Continue's boundary** — the human stays in the loop by default.

#### Where they fail

- **Framework lock-in is severe.** These frameworks want to own your control flow. Migrating between them is a rewrite. This is precisely why the standing instruction says do not make a framework the core of LAO — that instruction is correct and this research reinforces it.
- **Reliability degrades with autonomy.** Long autonomous chains compound error. The failure mode is confident wrongness.
- **Permissions are usually coarse** — an agent typically gets a tool or does not, with no scoping, cost ceiling, or approval gate.
- **Weak audit trails.** Most frameworks log for debugging, not for accountability.
- **Cost is invisible** until the bill arrives.

#### Architecture lessons

1. **LAO's existing design is already right here.** `AGENT_SYSTEM.md` + `ADAPTER_SPECIFICATION.md` define an LAO agent abstraction with framework adapters (CrewAI/AutoGen/LangGraph). This research validates that decision — do not revisit it.
2. **The LAO agent contract should own** identity, permissions, cost ceiling, approval gates, audit emission, and failure recovery. The framework should own only *execution strategy*. If a framework is doing anything from the first list, the boundary has leaked.
3. **Checkpointing/resumability (LangGraph's strength) should be an LAO-level concept**, so it survives a framework swap.
4. **Sandboxing is an LAO responsibility.** Never inherit a framework's sandbox assumptions.
5. **Cost ceilings must be enforced pre-execution**, not observed post-hoc — LAO's cost tracker already exists for this.

#### Licence posture

| Project | Licence | Notes |
|---|---|---|
| LangGraph | MIT | ✅ Permissive |
| CrewAI | MIT | ✅ Permissive |
| AutoGen / AG2 | Apache-2.0 | ✅ Permissive; note the AutoGen→AG2 community fork when pinning |
| OpenHands | MIT | ✅ Permissive |
| Aider | Apache-2.0 | ✅ Permissive; patterns more valuable than the code |
| Continue | Apache-2.0 | ✅ Permissive; patterns more valuable than the code |

Permissive across the board — this is the safest category in the document, and the only one where adoption carries no licence-driven constraint. Attribution and copyright notices must still be preserved.

#### LAO verdict

- **Use:** one framework behind the existing agent adapter; swap freely.
- **Avoid:** framework-owned control flow; unbounded autonomy; agents with unscoped permissions.
- **Improve:** permissions, cost ceilings, approval gates, and audit — the four things every framework under-serves and LAO already has specifications for.
- **Class:** **B — ADAPT** (frameworks) with **D** for the LAO agent contract itself.

---

### D6. Video and content

**Studied:** Remotion, FFmpeg, Canva, CapCut, Descript, Synthesia-style workflows

#### What works

- **Remotion's core idea** — video as React components — makes video *programmable and diffable*. For templated lesson video at volume, this is the strongest approach available.
- **Descript's transcript-as-timeline** — edit the text, the video follows. The best content-editing UX innovation of the last decade and directly applicable to lesson correction.
- **Canva's constrained templates** — non-designers produce acceptable output because the template forbids bad choices.
- **CapCut's captions-by-default** — auto-captions as the default state, not an export option.
- **FFmpeg** — the universal substrate. Everything ends here eventually.

#### Where they fail

- AI-avatar video ("Synthesia-style") produces content that is *technically* a video and pedagogically inert — a talking head reading a script is not better than well-structured text, and often worse because it cannot be skimmed.
- Rendering is slow and expensive at volume; cost per lesson is easy to underestimate.
- Generated video is hard to correct — a one-word error means a re-render, which is why most auto-video pipelines quietly ship stale content.

#### Architecture lessons

1. **Keep the pipeline staged and inspectable.** The target pipeline — lesson data → script → visual plan → narration → subtitles → composition → encode — should have **each stage independently addressable, cacheable, and re-runnable**. A one-word script fix must not re-run narration for the whole lesson.
2. **Script and visual plan are data, not artifacts of rendering.** They should be reviewable and correctable before anything expensive happens.
3. **Subtitles are generated from the narration script, not transcribed from audio.** Source-derived captions are exact; ASR captions have error rates. This is both an accessibility win and cheaper.
4. **Render must be an adapter** (LAO's rule already) — this is what makes A5 survivable.
5. **Local-capable rendering** matters for cost control and matches LAO's local-first principle.

#### UX lessons

- Captions on by default.
- Every video must have a text equivalent — for accessibility, for skimming, and for search.
- Show the script before rendering; correction at the script stage costs nothing.

#### Accessibility lessons

- Captions, transcript, and audio description path are baseline, not enhancements.
- **Never encode information in visuals alone** — narration must carry the meaning, because some learners will only receive the audio.
- Respect reduced-motion preferences; generated video loves gratuitous animation.

#### Licence posture — the two traps

> ⚠️ **Remotion (A5).** Not OSI open source. Free for individuals, non-profits, and for-profits with **≤3 employees**. For-profits with **4+ employees require a paid Company Licence**. LAO's intended use — an automated lesson-video pipeline — is the **"Automators"** tier: **$0.01 per render, $100/month minimum spend** (Enterprise: $500/month minimum). The "Creators" tier ($25/seat/month) explicitly does *not* cover automation.
>
> **Consequence:** LAO's video pipeline has a per-render marginal cost and an employee-count cliff. This is acceptable *if* deliberate. It is unacceptable as an accident discovered at headcount 4. **Mandatory:** Remotion sits behind a render adapter with a documented fallback path (direct FFmpeg composition, or an alternative programmatic renderer) so the decision stays reversible.

> ⚠️ **FFmpeg licence mode.** FFmpeg is **LGPL-2.1-or-later by default**. Passing `--enable-gpl` — which is what enables `libx264` among others — **changes the effective licence to GPL-2.0-or-later**. For LAO this means: build/ship an **LGPL configuration** (no `--enable-gpl`, no `--enable-libx264`) unless a deliberate decision is made to accept GPL obligations. Note also that codec **patent** licensing (e.g. H.264) is a separate question from copyright licensing and is not resolved by choosing LGPL.

| Project | Licence | Verdict |
|---|---|---|
| Remotion | Proprietary / company licence | ⚠️ Usable with paid licence at 4+ employees. Adapter-isolated, exit path required. |
| FFmpeg | LGPL-2.1+ default; GPL-2.0+ with `--enable-gpl` | ⚠️ Build configuration is a licence decision. Document the build flags. |

#### LAO verdict

- **Use:** FFmpeg (LGPL build) as substrate; Remotion behind an adapter, as a deliberate paid decision.
- **Avoid:** avatar-narrator video; monolithic re-render pipelines; ASR-derived captions when the script is available.
- **Improve:** stage-level caching and correction; script-derived exact captions; text equivalent always shipped alongside.
- **Class:** **B — ADAPT**, with the licence caveats above as blocking conditions.
- **Agent mapping:** Foxtrot (FF) with Echo (EE) for narration.

---

### D7. Booking / calendar

**Studied:** Calendly, Cal.com (AGPL-3.0 core + proprietary `/ee`), Google Calendar workflows

The standing instruction asks whether LAO learners actually need this. **Applying the value test honestly: no.**

- LEARN: ❌ — booking does not help anyone learn.
- BUILD: ❌ — no contribution.
- LAUNCH: ❌ — you can launch without it.
- EARN: ⚠️ — marginal, and only for learners who sell via calls, which is a subset.

A learner who needs to book calls can use Calendly's free tier or Cal.com today, at zero cost to LAO. Building or hosting scheduling means owning timezone handling, calendar sync, availability logic, and reschedule/cancel flows — a genuinely deep problem — for a capability that does not advance the core thesis.

**Licence note if this is ever revisited:** Cal.com core is AGPL-3.0 (network copyleft — hosting it for LAO users triggers source-disclosure obligations) and its `/ee` directory is proprietary, requiring a purchased licence key for self-hosting. That combination makes it a poor adoption target and a fine study target.

- **LAO verdict: do not build. Link out.** Revisit only if usage data shows scheduling is a real bottleneck at EARN.
- **Class:** **A — USE** (external, unhosted).

---

### D8. Project management

**Studied:** Linear, Notion, Trello, Asana, GitHub Projects

#### What works

- **Linear's opinionation and speed** — few concepts, fast keyboard-first UI, no configuration. The best model in the category for LAO's purposes.
- **Trello's immediacy** — a beginner understands a board in seconds with zero training.
- **GitHub Projects' proximity to the work** — tracking lives where the artifacts live.

#### Where they fail

- Notion and Asana are construction kits: infinitely configurable, so the user's first job is building their own tool. For a beginner this is a trap that consumes the motivation they should be spending on the actual project.
- Enterprise concepts (sprints, story points, epics, workflows) are noise for a solo learner building one thing.
- All of them require the user to *decide what the tasks are* — which is exactly what a beginner cannot do. This is the real gap.

#### Architecture lessons

- Tasks should be **generated from the project template and the learner's chosen venture**, not authored from a blank page. The scarce resource for a beginner is knowing what to do next, not somewhere to write it down.
- Project state should be a projection of the progression engine (§E4), not a separate system.

#### UX lessons

- One list. One current task. "What's next" as the default and primary view.
- No configuration surface in v1. Zero.
- Completion of a project task should produce evidence (§E3) automatically — the tracker feeds the portfolio.

#### Accessibility lessons

- Keyboard-first (Linear's model) is an accessibility win before it is a power-user feature.
- Any board view needs keyboard move-to-column from day one.

#### Licence posture

All commercial SaaS. Study only. No exposure.

#### LAO verdict

- **Avoid:** boards, sprints, configurability, blank-page task entry.
- **Improve:** generate the plan; one next action; completion produces evidence.
- **Class:** **C — STUDY THEN BUILD**, minimal.

---

### D9. Portfolio / creator tools

**Studied:** LinkedIn, Behance, GitHub profiles, Linktree, Carrd

#### What works

- **GitHub profile** — the strongest capability signal in existence, because it is *derived from real work* rather than self-asserted. Commits cannot be easily faked into a coherent history.
- **Behance** — visual work shown as work, not described in prose.
- **Linktree/Carrd** — near-zero-friction publishing. Someone with no technical skill has a live page in minutes.

#### Where they fail

- **LinkedIn is self-assertion.** Anyone can claim anything; the signal-to-noise is poor and everyone knows it.
- **Portfolios are manual.** They require the learner to stop working, reflect, write, curate, and publish — a separate skill, done at exactly the moment their motivation is lowest.
- **No provenance.** A portfolio piece does not carry evidence that the person actually did it, when, or how.

#### This is LAO's strongest structural opportunity

LAO uniquely observes the entire process: which lessons were mastered, which practice items were passed unaided, what was built, what shipped, what earned. **No other platform holds this chain.** LinkedIn sees claims; GitHub sees commits; LAO sees the causal path from learning to outcome.

That makes an *automatically-generated, provenance-backed* portfolio not just a convenience feature but a credibility instrument — see §E3.

#### Architecture lessons

- Portfolio must be a **projection over the evidence graph**, generated on demand — never a separate hand-maintained document that drifts.
- Every claim needs a link to its supporting evidence, with a timestamp.
- Learner control is mandatory: they decide what is public. Provenance without consent is surveillance.

#### UX lessons

- Generate a draft; let the learner edit and choose. Never publish automatically.
- The output must be a shareable URL — that is the unit clients and employers accept.

#### Accessibility lessons

- Generated portfolio pages must themselves meet WCAG 2.2 AA. Shipping an inaccessible page that represents a learner is a direct harm to that learner's prospects.
- Require alt text on portfolio images at generation time.

#### Licence posture

Commercial SaaS, studied for patterns. No exposure.

#### LAO verdict

- **Avoid:** manual portfolio construction; unverifiable claims; auto-publishing without consent.
- **Improve:** provenance-backed, auto-drafted, learner-controlled.
- **Class:** **D — LAO ORIGINAL.**

---

### D10. Community

**Studied:** Discord, Circle, Slack communities, Reddit, GitHub Discussions, Discourse (GPL-2.0)

#### What works

- **Discourse's trust levels** — earned moderation privileges scale a community without scaling paid moderators. The best structural idea in the category.
- **GitHub Discussions' proximity** — conversation attached to the artifact it concerns.
- **Reddit's threading** and Discourse's search — knowledge that persists and is findable.
- **Small, purposeful groups** consistently outperform large open channels for actual learning support.

#### Where they fail

- **Discord is a knowledge shredder.** Real-time chat means the same question is answered daily and never findable. Excellent for belonging, terrible for learning.
- **Moderation and safety are real, ongoing, expensive obligations** — with a learner population that may include vulnerable adults and minors, this is not a side concern.
- **Engagement mechanics manufacture noise.** Karma and reaction counts optimise for participation volume, not usefulness.
- Empty communities are actively negative — a dead forum signals a dead product.

#### Architecture lessons

- Do not build a forum. This is a solved, deep, permanently-maintained problem.
- If community is integrated, treat it as an external system behind an integration boundary, with LAO identity mapped in.
- Anything of lasting value that emerges in community should be promotable into LAO's knowledge base (Quebec/QQ) rather than left to rot in a chat log.

#### Accessibility lessons

- Real-time chat is hostile to several groups: screen-reader users (constant live-region updates), learners with processing differences, and anyone in a different timezone. Asynchronous, threaded formats are more inclusive by default.

#### Licence posture

Discourse is GPL-2.0 (verify at adoption). Self-hosting for internal use is straightforward; modification-and-distribution triggers obligations. Integration over adoption avoids the question entirely.

#### LAO verdict

- **Avoid:** building a forum; real-time-only community; karma/engagement mechanics; launching community before there is a population to fill it.
- **Improve:** peer support tied to *what the learner is actually stuck on*, and promotion of good answers into durable knowledge.
- **Class:** **A — USE** (integrate an existing platform). Defer until learner volume justifies it.
- **Agent mapping:** Yankee (YY) for comms, Quebec (QQ) for knowledge promotion.

---

### D11. Accessibility

**Benchmark:** WCAG 2.2 (current W3C Recommendation), plus accessible LMS practice.

#### Standards position (verified)

- **WCAG 2.2 is the current standard** — 86 success criteria across levels A/AA/AAA (77 carried from 2.1 with one obsoleted, plus nine new). The nine additions target low vision, cognitive and learning disabilities, and motor/touch accessibility.
- **Level AA is the accepted conformance target** and should be LAO's baseline.
- **WCAG 3.0 is still a Working Draft.** Candidate Recommendation is anticipated around Q4 2027, with final Recommendation no earlier than 2028. Its March 2026 draft moves to ~174 outcome-based requirements with Bronze/Silver/Gold graded scoring rather than binary pass/fail. **WCAG 3.0 will not supersede WCAG 2.2 — they will coexist.**

**Implication for LAO:** target **WCAG 2.2 AA now**. Do not delay or design around WCAG 3.0 — it is years from being required. But note that its outcome-based, graded model rewards products that go beyond checklist compliance, which is the direction LAO's multi-modal design already points.

#### The multi-modal requirement

The standing instruction requires the same lesson to be available as text, voice, video, image, interaction, example, and practice. This is more demanding than WCAG conformance and is a genuine differentiator — but only if it is architectural.

**This is the key architectural consequence in the entire document:** if lessons are *authored* as video or as prose, multi-modality is impossible to retrofit at acceptable cost. Lessons must be authored as **structured, modality-neutral content** from which each representation is *derived*. Get this wrong at the start and every lesson ever written must be re-authored.

#### Architecture lessons

1. **Modality-neutral lesson source is non-negotiable.** Concept, explanation, worked example, practice item, and misconception are semantic units — not paragraphs and not scenes.
2. Every derived representation traces back to the same source unit, so a correction propagates everywhere.
3. Learner modality preference belongs in learner state (§E1) and persists across the product.
4. Accessibility must be testable in CI — automated checks catch a meaningful fraction of defects and prevent regressions.

#### UX lessons

- Keyboard navigation for every interaction, including assessment widgets.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Do not convey meaning by colour alone.
- Text resizing to 200% must not break layout.
- Dyslexia-friendly presentation: generous line height, adjustable measure, no justified text, user-selectable typeface.
- Neurodivergent-friendly: predictable structure, no unexpected motion, no imposed time pressure, clear "what happens next."

#### Licence posture

Standards, not code. No exposure. Automated tooling (e.g. axe-core, MPL-2.0 — verify at adoption) sits in CI, not in the shipped product.

#### LAO verdict

- **Use:** WCAG 2.2 AA as the baseline; automated a11y testing in CI.
- **Avoid:** retrofitting accessibility; authoring lessons in a single modality; time-pressure mechanics without accommodation.
- **Improve:** derive all modalities from one source — most platforms cannot do this at all.
- **Class:** **D — LAO ORIGINAL** (the modality-neutral lesson model).

---

### D12. Mobile

**Principle:** every significant feature is evaluated mobile-first — not designed for desktop and shrunk.

#### What works

- **Duolingo** is the reference: sessions sized for a queue or a commute, thumb-reachable targets, works one-handed.
- Offline-tolerant behaviour — learning happens on transit with poor connectivity.
- Native-feeling input: voice, camera, touch.

#### Where competitors fail

- Coursera, Udemy, and the open-source LMS platforms are all desktop-first products with mobile ports. Video plays acceptably; everything else is cramped.
- **Code-learning platforms are the worst offenders** — Codecademy and freeCodeCamp are genuinely hard to use on a phone, because a code editor is a poor fit for a small touch screen. This matters enormously for LAO's audience, many of whom will be phone-primary.
- Long-form reading on mobile has poor completion.

#### The honest problem for LAO

LAO teaches building with AI, which implies producing artifacts. Artifact production on a phone is genuinely constrained. **The answer is not to pretend otherwise**, but to split the experience by what each device is actually good at:

| Device | Genuinely good for |
|---|---|
| Phone | Learning, practice, review, coaching conversation, progress, capture, approvals |
| Desktop | Building, editing, complex artifact production |

Sessions should be *designed* for the phone; building should be *supported* on desktop with the phone able to review, approve, and continue. State must be continuous across both — a learner starts a session on a phone and continues on a laptop with no loss.

#### Accessibility lessons

- Touch targets ≥ 44px; WCAG 2.2's new criteria explicitly address touch/motor accessibility.
- One-handed reachability is a motor-accessibility feature.
- Never rely on hover — it does not exist on touch.
- Test with mobile screen readers, not just desktop ones.

#### LAO verdict

- **Avoid:** desktop-first design; phone-based code editors; long-form mobile reading; hover-dependent UI.
- **Improve:** device-appropriate task split with continuous state — nobody in the category does this well.
- **Class:** **D — LAO ORIGINAL** (the split-session model); **A** for the underlying platform tech.

---

## E. Proposed LAO original implementations

These are the strategic capabilities that should be written as LAO IP. They are described here as *designs to be evaluated*, not as approved work. Each must still pass §B and §18 discipline.

### E1. Learner State Vector (LSV) — the spine

**Problem:** every capability in this document needs to know the same things about the learner, and no external component models both a learner *and* their venture.

A single, queryable, learner-owned state object holding:

| Facet | Contents |
|---|---|
| Mastery | Per-concept mastery with evidence and decay (E2) |
| Difficulty history | What they struggled with, when, how it resolved |
| Preferences | Modality preference, pace, session length, accommodations |
| Interests | Domain, venture direction |
| Progression | Current LEARN/BUILD/LAUNCH/EARN stage and gates (E4) |
| Artifacts | What they have built and shipped |
| Consent | What may leave the system, to which providers, for what purpose |

**Design constraints:**
- Derived from the append-only event log — never hand-mutated, always reconstructible.
- The tutor, the video pipeline, the progression engine, and the portfolio all *read* it; only the event log writes it.
- Consent facet is enforced at the adapter boundary: an external provider receives a **minimised projection**, never the whole vector.
- Learner-inspectable and exportable. If a learner cannot see their own model, it is surveillance.

**Why original:** no external component models this. It is the thing that makes LAO's AI contextual rather than a chatbot.

### E2. Mastery Ledger

**Problem:** A1 — mastery learning is the mechanism that actually works, and almost nobody enforces it.

- Mastery is **evidence-derived**, never self-asserted and never granted by content consumption.
- Evidence is weighted: unaided correct > correct after hint > correct after answer shown. The hint ladder (E5) makes this measurable.
- Mastery **decays** without retrieval, scheduling spaced review. Retrieval practice and spacing are among the best-supported findings in learning science.
- Concepts form a prerequisite DAG; a concept is reachable only when its prerequisites hold sufficient mastery.
- **Gates are real.** If LAO does not withhold progression, it is not doing mastery learning — it is doing a progress bar.

**Honest risk:** gating increases short-term friction and will depress naive engagement metrics. The evidence in A1 says this is the trade that produces outcomes. LAO must measure outcomes (§F), not engagement, or it will optimise the gate away.

### E3. Evidence Graph → Portfolio Intelligence

**Problem:** D9 — capability claims are unverifiable, and portfolio construction is manual work demanded at the worst moment.

A directed graph linking: `concept mastered → practice evidence → project artifact → shipped outcome → earning event`.

- Every portfolio claim resolves to a path through this graph with timestamps.
- The portfolio is a **generated projection**, not a maintained document.
- Learner-controlled visibility per claim; nothing is public by default.
- Because the chain is causal, LAO can state *how* someone learned something, not just that they claim it.

**Why original:** LAO is structurally positioned to hold this chain end-to-end. LinkedIn, GitHub, and every LMS each see one fragment.

### E4. Progression Engine (LEARN → BUILD → LAUNCH → EARN)

**Problem:** every platform ends at "course complete" and abandons the learner at exactly the transition that matters.

An explicit state machine with defined entry/exit criteria per stage:

| Stage | Exit criteria (illustrative) |
|---|---|
| LEARN | Required concepts at mastery threshold with unaided evidence |
| BUILD | A working artifact exists and meets its acceptance checks |
| LAUNCH | The artifact is publicly reachable and a first outreach action has occurred |
| EARN | A real transaction or engagement is recorded |

- Stages are **not** UI tabs. They are gated states with criteria, driving what LAO shows, what the coach prioritises, and which capabilities activate.
- Regression is permitted and normal — a learner at BUILD who hits a knowledge gap is routed back to targeted LEARN, not restarted.
- Provides the *reason* for every other subsystem to activate: the CRM slice (D3) only exists at EARN; project tracking (D8) only at BUILD.

**Why original:** this is the product thesis. It cannot be borrowed.

### E5. Socratic Escalation Protocol (the hint ladder)

**Problem:** A2 — this is a correctness requirement, not a feature.

An enforced escalation ladder, with the constraint implemented in LAO code rather than in a prompt:

1. Reflect the learner's attempt back and ask what they expected
2. Point to the relevant concept (with a modality matched to their preference)
3. Narrow to the specific step that is wrong
4. Worked example of an *analogous* problem — never the exact one
5. Explicit answer — **permitted only for non-assessed material**, and the item is then marked *taught, not demonstrated*

**Hard constraints:**
- A response that would resolve an open assessed item is blocked before it reaches the learner. Prompting alone is insufficient — models will violate advisory instructions.
- Every rung is recorded as evidence and weighted into the mastery ledger (E2).
- The learner can always see which rung they are on and request escalation — the protocol must not feel like withholding for its own sake.
- Provider-agnostic: the ladder is LAO logic, so it survives any model or framework swap.

**Measurable success criterion, derived directly from A2:** learners must perform *better* on unaided assessment after coached practice than a control cohort without coaching. If LAO cannot demonstrate that, the coach is reproducing the −17% and must be changed.

### E6. Friction Budget

**Problem:** the stated target is "least possible friction" — currently unmeasurable, therefore unmanageable.

An explicit instrument tracking, per learner journey: time-to-first-learning-moment, time-to-first-built-artifact, time-to-first-launch, time-to-first-earning, and the count of blocking steps at each transition. Every proposed feature must state its expected effect on this budget; features that add friction without a compensating outcome gain are rejected.

**Why original:** it operationalises the actual product goal, and it is the guard that stops LAO drifting toward "more features."

---

## F. Test and measure

The standing principle ends in TEST → MEASURE. These are the measurements that would tell LAO whether any of the above worked. Committing to them *before* building is what prevents retrospective justification.

| Capability | Primary metric | Guardrail metric (must not degrade) |
|---|---|---|
| Mastery ledger | Unaided assessment performance at gate | Time-to-gate does not become discouraging |
| Hint ladder (E5) | **Post-coaching unaided performance vs. uncoached control** (the A2 test) | In-session completion |
| Lesson unit sizing | Session completion rate (target: micro-learning's 80–90%, per A3) | Concept retention at spaced review |
| First-two-weeks design | 14-day retention (attacks the 50%-of-dropouts window) | Not achieved via engagement mechanics |
| Progression engine | Stage transition rates, especially BUILD→LAUNCH | Regression rate stays healthy, not zero |
| Evidence graph | Portfolio artifacts generated per learner; external engagement with them | Learner consent rate stays high |
| Multi-modal lessons | Modality usage distribution; outcome parity across modalities | No modality is systematically worse |
| Video pipeline | Cost per lesson-minute; correction turnaround | Caption accuracy |
| Friction budget | Time-to-first-earning | — |
| Accessibility | Automated WCAG 2.2 AA pass rate in CI; assistive-tech task completion | Zero regressions merged |

**The measurement that matters most:** LAO's thesis is that a person can go from not knowing how to use AI to building something valuable and potentially earning from it. The honest headline metric is **time-to-first-earning-event**, with completion rate as a supporting measure — not course completions, not streaks, not DAU.

---

## G. Open-source component register

Per the standing open-source policy. **Every licence below marked ✅ was verified against the project's own repository or documentation during this research** (see Sources) — none are asserted from memory. Two carry active warnings (Remotion, Piper) and one is rejected outright (n8n).

**Version and maintenance activity are deliberately not recorded here** — they change continuously and a stale value in a compliance register is worse than none. Both must be captured, pinned, and security-reviewed at the moment of adoption, and this register updated at that point.

| Project | Licence | Purpose | Distributed? | Modified? | Alternative | Interface boundary |
|---|---|---|---|---|---|---|
| **Temporal** | MIT ✅ | Durable workflow execution | No — server-side | No | Kestra | LAO workflow adapter |
| **Kestra** | Apache-2.0 ✅ | Declarative orchestration | No — server-side | No | Temporal | LAO workflow adapter |
| **n8n** | Sustainable Use License ✅ | ❌ **Rejected** — not usable as customer-facing engine | — | — | Temporal / Kestra | N/A — study UX only |
| **LangGraph** | MIT ✅ | Agent execution strategy | No | No | CrewAI, AG2 | LAO agent adapter |
| **CrewAI** | MIT ✅ | Role-based agent orchestration | No | No | LangGraph, AG2 | LAO agent adapter |
| **AutoGen / AG2** | Apache-2.0 ✅ | Multi-agent conversation patterns | No | No | LangGraph | LAO agent adapter |
| **OpenHands** | MIT ✅ | Sandboxing patterns | No | No | Own sandbox | Study; LAO owns sandboxing |
| **Aider** | Apache-2.0 ✅ | Git-commit-per-change audit pattern | No | No | — | Pattern only |
| **Continue** | Apache-2.0 ✅ | Human-in-loop patterns | No | No | — | Pattern only |
| **Remotion** | ⚠️ Proprietary / Company Licence ✅ | Programmatic video composition | Rendered output only | No | Direct FFmpeg composition | LAO render adapter — **exit path mandatory** |
| **FFmpeg** | ⚠️ LGPL-2.1+ default; GPL-2.0+ with `--enable-gpl` ✅ | Encode / transcode substrate | Yes, if bundled | No | — | LAO media adapter; **build flags are a licence decision** |
| **Whisper** | MIT ✅ (code *and* model weights) | Speech-to-text | No | No | Vosk | LAO voice adapter |
| **Piper** (`rhasspy/piper`) | MIT ✅ — ⚠️ **archived 2025-10-06, read-only** | Local TTS | No | No | See below | LAO voice adapter |
| **Piper** (`OHF-Voice/piper1-gpl`) | ⚠️ **GPL-3.0** ✅ — the maintained successor | Local TTS | No | No | Kokoro, other TTS behind same adapter | LAO voice adapter — **decision required (A8)** |
| **Moodle** | GPL-3.0 ✅ | ❌ Study only | — | — | — | None |
| **Open edX** | AGPL-3.0 ✅ | ❌ Study only — network copyleft | — | — | — | None |
| **Canvas LMS** | AGPL-3.0 ✅ | ❌ Study only — network copyleft | — | — | — | None |
| **SuiteCRM** | AGPL-3.0 ✅ | ❌ Study only | — | — | — | None |
| **Mautic** | GPL-3.0 ✅ | ❌ Study only | — | — | — | None |
| **Odoo (community)** | LGPL-3.0 ✅ | Study only — ERP-shaped | — | — | — | None |
| **Cal.com** | AGPL-3.0 core + proprietary `/ee` ✅ | ❌ Not adopted — link out instead | — | — | Calendly (external) | None |
| **Discourse** | GPL-2.0-or-later ✅ | Community, if ever integrated | No — separate service | No | Circle, Discord | Integration boundary only |
| **freeCodeCamp** | BSD-3-Clause code; curriculum separate ✅ | Study — project-based certification model | — | — | — | None |
| **axe-core** | MPL-2.0 ✅ | CI accessibility testing | No — dev dependency | No | Other a11y tooling | CI only, not shipped |

### Standing licence rules

1. **Never remove third-party copyright notices.**
2. **Never claim third-party code as LAO code.**
3. Prefer permissive licences (MIT, Apache-2.0, BSD) where technically appropriate.
4. **AGPL and source-available licences (n8n's SUL) require explicit sign-off before adoption** — not an engineering-level decision.
5. Every adopted component sits behind an adapter per `ADAPTER_SPECIFICATION.md`, so any licence change is survivable.
6. Pin versions and record maintenance/security status at adoption, and update this register then.

---

## H. What LAO should explicitly not do

Recording rejections is as valuable as recording adoptions, because rejected ideas return.

| Do not | Why |
|---|---|
| Build a CRM | Fails the value test on LEARN and BUILD (§B) |
| Build a booking/calendar system | Fails on all four; deep problem, no thesis contribution (§D7) |
| Build a community forum | Solved, permanently expensive, integrate instead (§D10) |
| Embed n8n as the automation engine | Sustainable Use License prohibits it (A6) |
| Adopt any AGPL LMS into the hosted product | Network copyleft triggers source disclosure (A7) |
| Ship an answer-giving AI assistant | Measurably harms learning outcomes (A2) |
| Ship 40-hour courses | 5–10% completion is a known-bad format (A3) |
| Use loss-framed streaks as the retention mechanism | Manufactures churn; commitment devices are stronger (A4) |
| Make an agent framework the core | Lock-in; LAO's existing abstraction is correct (§D5) |
| Author lessons in a single modality | Forecloses multi-modal delivery permanently (§D11) |
| Design desktop-first | Violates the mobile-first principle (§D12) |
| Cite Bloom's 2σ in any LAO material | It does not replicate; ~0.37σ is the honest figure (A1) |

---

## I. Open questions

Recorded honestly rather than resolved prematurely. Each needs an answer before the related capability is built.

1. **Video's actual value.** A3 says short units win, and text is faster to correct, cheaper, and more accessible than video. Is generated lesson video worth its cost and licence exposure (A5), or is it valuable primarily as a *modality option* for learners who need it? This should be tested against learner outcomes before the pipeline is built out.
2. **Mastery gating tolerance.** Gating is the mechanism (A1) but adds friction. Where is the threshold at which learners abandon rather than push through? This needs measurement, not assumption.
3. **Earning attribution.** How does LAO verify an earning event without becoming a payment processor or demanding invasive proof? The evidence graph's credibility depends on this.
4. **Phone-primary learners who cannot access a desktop.** §D12's split-session model assumes desktop availability for BUILD. For learners without it, what is the genuine path? This may be the most important unanswered accessibility question in the product.
5. **Duolingo's adaptive model.** IRT/computer-adaptive testing in the Duolingo English Test is well documented, but the internals of their consumer-app adaptive system are not publicly verified. LAO should base its own adaptivity on the published IRT/CAT and spacing literature rather than inferred competitor behaviour.
6. **Community timing.** Community helps retention but is negative when empty. What learner volume justifies starting it?
7. **Piper decision (A8).** Unmaintained MIT versus maintained GPL-3.0 versus a different TTS engine entirely. Because Piper sits behind LAO's voice adapter, this is a low-cost decision to defer — but it should be made deliberately, not by whichever version someone installs first.

---

## J. Maintenance

Revise this document when:

- A capability in §D is about to be built — re-verify that category's licences and re-run the value test.
- A licence changes. Remotion's terms and n8n's SUL are the highest-risk watch items; both have changed before.
- A measurement in §F contradicts a finding here. **Measured evidence from LAO's own learners supersedes this research.**
- A significant new product or open-source project appears in a category.

Do not let this document become a static artifact. An unmaintained competitive intelligence document is worse than none, because it is trusted.

---

## Sources

Primary and authoritative sources consulted for the verified claims in this document.

**Licensing**
- [Remotion licence terms](https://www.remotion.dev/docs/license/terms) · [Remotion licence FAQ](https://www.remotion.dev/docs/license/faq) · [Remotion company licensing](https://www.remotion.pro/license)
- [n8n Sustainable Use License (docs)](https://docs.n8n.io/sustainable-use-license/) · [n8n announcement](https://blog.n8n.io/announcing-new-sustainable-use-license/) · [n8n LICENSE.md](https://github.com/n8n-io/n8n/blob/master/LICENSE.md)
- [FFmpeg License and Legal Considerations](https://www.ffmpeg.org/legal.html) · [FFmpeg LICENSE](https://ffmpeg.org/doxygen/4.4/md_LICENSE.html)
- [Cal.com — changing to AGPLv3 and introducing the Enterprise Edition](https://cal.com/blog/changing-to-agplv3-and-introducing-enterprise-edition) · [Cal.com /ee LICENSE](https://github.com/calcom/cal.com/blob/main/packages/features/ee/LICENSE)
- [Open-source LMS licence comparison](https://selleo.com/blog/open-source-lms-comparison)
- [Temporal repository](https://github.com/temporalio/temporal) · [Kestra repository](https://github.com/kestra-io/kestra)
- [CrewAI](https://en.wikipedia.org/wiki/CrewAI)
- [OpenHands (MIT)](https://github.com/All-Hands-AI/OpenHands) · [Aider (Apache-2.0)](https://github.com/Aider-AI/aider) · [Continue (Apache-2.0)](https://github.com/continuedev/continue)
- [Whisper (MIT, code and weights)](https://github.com/openai/whisper)
- [Piper — archived MIT repository](https://github.com/rhasspy/piper) · [Piper — maintained GPL-3.0 successor](https://github.com/OHF-Voice/piper1-gpl)
- [Discourse (GPL-2.0-or-later)](https://github.com/discourse/discourse) · [axe-core (MPL-2.0)](https://github.com/dequelabs/axe-core)

**Learning science and outcomes**
- [Generative AI without guardrails can harm learning — PNAS](https://www.pnas.org/doi/10.1073/pnas.2422633122) · [preprint PDF](https://hamsabastani.github.io/education_llm.pdf)
- [An AI tutor helped Harvard students learn more physics in less time — Hechinger Report](https://hechingerreport.org/proof-points-ai-tutor-harvard-physics/)
- [Two-Sigma Tutoring: Separating Science Fiction from Science Fact — Education Next](https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/) · [Bloom's 2 sigma problem — Wikipedia](https://en.wikipedia.org/wiki/Bloom's_2_sigma_problem) · [Nintil systematic review](https://nintil.com/bloom-sigma/)
- [Online course completion statistics](https://www.skillademia.com/statistics/online-course-completion-statistics/) · [Uncovering MOOC Completion — Open Praxis](https://openpraxis.org/articles/10.55982/openpraxis.16.3.606)
- [AutoIRT: Calibrating Item Response Theory Models with AutoML (Duolingo English Test)](https://arxiv.org/abs/2409.08823) · [BanditCAT and AutoIRT](https://arxiv.org/pdf/2410.21033)

**Accessibility**
- [WCAG 2.2 checklist and success criteria](https://www.levelaccess.com/blog/wcag-2-2-aa-summary-and-checklist-for-website-owners/) · [WCAG 2.2 success criteria explained](https://216digital.com/wcag-2-2-success-criteria-explained-the-2026-compliance-guide/)
- [WCAG 3.0 status and timeline](https://www.webability.io/blog/wcag-3-0-explained)
