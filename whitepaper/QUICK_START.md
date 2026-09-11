# Quick Start Guide – White Paper Development

## Project Overview

**Name:** Identity Before Automation™: The Trust Architecture for Authorised Agentic Artificial Intelligence

**Goal:** Create a 50–60 page, publication-quality academic white paper suitable for Coventry University, Innovate UK, UKRI, government, defence, and enterprise stakeholders.

**Status:** Phase 1 Complete ✅ | Ready for Phase 2 Content Writing

---

## What's Ready (Phase 1 Complete)

### Documentation
- ✅ **PROJECT_PLAN.md** – 13-week phased development roadmap
- ✅ **SECTION_OUTLINES.md** – Complete outline for all 28 sections (50,000+ words of structure)
- ✅ **DIAGRAMS_INDEX.md** – Strategy for 20 professional diagrams
- ✅ **STATUS.md** – Comprehensive project tracking
- ✅ **4 Core Technical Diagrams** – Designed (Mermaid, ready for vectorization)

### Structure
- 28 sections fully outlined with key points, examples, and cross-references
- 11 threats analyzed (prompt injection, memory poisoning, supply-chain compromise, etc.)
- 9 domain use cases detailed (automotive, healthcare, finance, defence, infrastructure, etc.)
- Regulatory alignment mapped (NIST, ISO, Zero Trust, domain-specific standards)

---

## How to Use the Outlines

### For Writing Each Section

1. **Open the outline** from `SECTION_OUTLINES.md`
2. **Follow the structure:** Each section has a clear hierarchy
3. **Maintain tone:** Academic British English; IEEE/ACM quality
4. **Reference widely:** Cite existing literature or mark as "proposed"
5. **Use examples:** Concrete examples provided in outlines
6. **Cross-reference:** Link to related sections and diagrams

### Example Section Structure (from Outlines)

```
## Section 7: Identity Before Automation™ (4–5 pages)

### Purpose
Articulate the core philosophical and technical principle underlying IrisKey.

### Structure
#### The Principle
- Core Insight: Authority must precede autonomy
- Reason: AI must be continuously verified as trustworthy before each action
- Distinction: Safety (probabilistic) vs. Trust Architecture (deterministic)

#### Identity as Foundation
- What is Identity? (Cryptographic proof of agent origin)
- Why Identity Matters? (Enables accountability and traceability)
- Static vs. Dynamic Identity

#### Three Operational Principles
1. Verify Before Permitting
2. Continuous Accountability
3. Deterministic Revocation

[... continues with detailed guidance]
```

---

## Immediate Next Steps (Phase 2)

### Week 1: Write First 5 Sections
Priority order (recommended):

1. **Section 2: Introduction** (3–4 pages)
   - Establishes scope and key terminology
   - Other sections build on this
   - Time: 4–6 hours

2. **Section 3: Evolution of Agentic AI** (3–4 pages)
   - Historical context (helpful for readers)
   - References: ReAct, AutoGPT, industry frameworks
   - Time: 4–6 hours

3. **Section 4: Current Threat Landscape** (4–5 pages)
   - Establishes urgency and motivation
   - Use threat examples from outlines
   - Time: 6–8 hours

4. **Section 5: Literature Review** (5–7 pages)
   - Academic grounding
   - Start here for research on AI governance, security, IAM
   - Time: 8–10 hours

5. **Section 1: Executive Summary** (2–3 pages)
   - Write LAST (after other sections completed)
   - Summarizes entire paper in 2–3 pages
   - Time: 4–6 hours

### What You'll Need

#### References (150+ total required)
Start building bibliography:
- NIST AI RMF (2023)
- NIST SP 800-207 (Zero Trust)
- ISO/IEC 27001, 42001
- Academic papers on: AI safety, secure multi-agent systems, identity, IAM, cryptography
- Industry frameworks: CloudFlare Zero Trust, Google BeyondCorp

#### Writing Resources
- Maintain list of key claims → citations
- Track terminology and definitions (for glossary later)
- Note any figures/diagrams needed

#### Diagram Support
The 4 core diagrams are ready; can reference them as:
- Figure 1: Overall IrisKey Architecture
- Figure 2: Dual-Brain Architecture
- Figure 5: Five-Gate Workflow
- Figure 7: Token Lifecycle

Additional diagrams will be created as needed in later phases.

---

## Key Principles to Maintain

### 1. Academic Rigor
- **Every claim is either:**
  - Referenced to established literature, OR
  - Explicitly marked as "IrisKey proposes" / "proposed architecture"
- **No marketing language:** Avoid "revolutionary," "groundbreaking," "unprecedented"
- **Precision:** Use exact terminology; define technical terms

### 2. British English
- Organisation (not organization)
- Behaviour (not behavior)
- Favour (not favor)
- Honour (not honor)
- Grey (not gray)
- Colour (not color)

### 3. Distinguish Three Categories
Throughout the paper, be clear:

**ESTABLISHED RESEARCH:**
"Zero Trust Architecture (NIST SP 800-207) establishes the principle..."

**INDUSTRY BEST PRACTICE:**
"Leading financial institutions employ biometric authentication for high-value transactions..."

**IRISKEY PROPOSAL:**
"IrisKey proposes a Five-Gate Authority Engine that extends Zero Trust principles to autonomous agents..."

### 4. Tone Examples

✅ **Good (Academic):**
"This paper addresses a critical gap in autonomous AI governance: the absence of continuous, deterministic authorization frameworks."

❌ **Bad (Marketing):**
"IrisKey revolutionizes AI governance with unprecedented authorization technology."

✅ **Good (Technical):**
"We implement deterministic revocation via a distributed revocation list with <100ms propagation latency..."

❌ **Bad (Vague):**
"Our system is super fast and really secure."

---

## Section Writing Workflow

### Step 1: Review Section Outline
- Read purpose and structure
- Note key concepts and examples
- Identify which diagrams apply

### Step 2: Research & Gather References
- For each major claim, find supporting reference
- Use academic databases (Google Scholar, ResearchGate)
- Track citations in consistent format (IEEE style recommended)

### Step 3: Write First Draft
- Follow the outline structure
- Use examples from outlines as starting points
- Write 1 page per 1–2 hours (varies by technical depth)
- Don't worry about perfection; focus on content

### Step 4: Reference Check
- Verify each claim has reference or is marked "proposed"
- Format references consistently
- Check that cited work actually supports the claim

### Step 5: Review & Revise
- Read for flow and clarity
- Check terminology consistency
- Ensure tone is academic, not marketing
- Revise for concision (academic writing is tight)

### Step 6: Cross-Reference
- Add references to related sections
- Link to relevant diagrams
- Note any forward references ("See Section X")

---

## Formatting Guidelines

### Headings
```markdown
## Section Title (Page Count)

### Subsection (Major Concept)

#### Sub-subsection (Detailed Aspect)
```

### Citations
Recommend: IEEE format or author-date

**IEEE Example:**
"The ReAct framework [1] demonstrates that agents reasoning with explicit actions can solve complex tasks [2]."

**Author-Date Example:**
"The ReAct framework (Yao et al., 2022) demonstrates that agents reasoning with explicit actions can solve complex tasks."

### Figures
```markdown
[In text, before figure]

```mermaid
... diagram code ...
```

**Figure 5: Five-Gate Authorization Workflow.** Sequential verification engine showing...
[End figure]

[Continue text after figure]
```

### Footnotes
Use sparingly; integrate into text where possible
If essential: `[^1]` and define at end of section

### Code/Pseudocode
Use triple backticks with language:
```json
{
  "token_id": "auth_xyz",
  "valid_from": "2025-07-22T10:00:00Z"
}
```

---

## Repository Organization

```
whitepaper/
├── PROJECT_PLAN.md              ← Development roadmap
├── SECTION_OUTLINES.md          ← Guidelines for all 28 sections
├── DIAGRAMS_INDEX.md            ← Diagram strategy
├── STATUS.md                    ← Project tracking
├── QUICK_START.md               ← This file
│
├── sections/                    ← Written section content
│   ├── 01-executive-summary.md
│   ├── 02-introduction.md
│   ├── 03-evolution-agentic-ai.md
│   └── ... (remaining sections as written)
│
├── diagrams/                    ← Technical diagrams
│   ├── DIAGRAMS_INDEX.md        ← Diagram inventory
│   ├── 01-overall-architecture.md
│   ├── 02-dual-brain-architecture.md
│   ├── 05-five-gate-workflow.md
│   ├── 07-authority-token-lifecycle.md
│   └── ... (additional diagrams as created)
│
├── references/                  ← Bibliography and sources
│   ├── bibliography.bib         ← Master reference file
│   └── sources/                 ← Reference materials
│
├── appendices/                  ← Supplementary material
│   ├── glossary.md
│   ├── threat-model-matrix.md
│   ├── standards-mapping.md
│   ├── use-case-scenarios.md
│   ├── reference-implementation.md
│   └── compliance-checklist.md
│
└── working-notes/               ← Research & notes (not in final paper)
    ├── research-notes.md
    ├── threat-model-draft.md
    └── architecture-sketches.md
```

---

## How to Commit Work

After writing a section or creating diagrams:

```bash
# Stage changes
git add whitepaper/

# Commit with clear message
git commit -m "Write Section X: <Title> + Create Figure Y

- Completed Section X: <Title> (4 pages)
- Added 150 words on core concept
- Integrated 8 academic references
- Created Figure Y diagram (vectorized)

Key points:
- Established connection to Zero Trust framework
- Distinguished established vs. proposed concepts
- Maintained academic tone throughout"

# Push to branch
git push -u origin claude/iriskey-flagship-whitepaper-czp8ez
```

---

## Tips for Productive Writing

### Batch Similar Tasks
- Write multiple sections in same domain before switching
- (e.g., automotive + defence in one session)
- (Then healthcare + finance in next session)

### Reference Management
- Use Zotero or Mendeley; export to BibTeX
- Add references as you write (easier than finding later)
- Verify each reference before finalizing

### Diagram Integration
- Create diagram early (guides section writing)
- Reference figure numbers consistently
- Captions should be self-contained (readable without text)

### Terminology Consistency
- Create glossary as you write (add terms as you define them)
- Use same term consistently (don't swap: "agent" vs. "autonomous system")
- Mark first definition in bold or with [1st use]

### Quality Checkpoints
At end of each section:
1. Read aloud (catches awkward phrasing)
2. Check all references verified
3. Verify academic tone (no marketing language)
4. Cross-check terminology with glossary
5. Review section for completeness vs. outline

---

## Estimated Timeline (Phase 2)

| Week | Sections | Hours | Diagrams |
|------|----------|-------|----------|
| 3 | 2–4 | 20–25 | - |
| 4 | 5–6 | 20–25 | Figures 3–4 |
| 5 | 1, 7–8 | 20–25 | Figures 6, 8–10 |

---

## Success Criteria (Phase 2 Complete)

- [ ] First 5 sections drafted (Intro through Literature Review)
- [ ] 50+ academic references integrated
- [ ] 2–3 additional diagrams created (professional quality)
- [ ] Consistent academic tone throughout
- [ ] All IrisKey proposals clearly labeled
- [ ] No marketing language present
- [ ] Cross-references working
- [ ] Ready to begin Phase 3 (Threat Analysis)

---

## Questions?

Refer back to:
- **SECTION_OUTLINES.md** for specific section guidance
- **PROJECT_PLAN.md** for overall strategy
- **STATUS.md** for project health and metrics
- **DIAGRAMS_INDEX.md** for diagram placement and descriptions

---

**Current Status:** Phase 1 Complete ✅  
**Next Milestone:** Phase 2 Sections (Weeks 3–5)  
**Branch:** `claude/iriskey-flagship-whitepaper-czp8ez`
