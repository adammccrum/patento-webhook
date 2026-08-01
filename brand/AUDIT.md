# Brand Conformance Audit

**Date:** 2026-08-01
**Against:** `brand-guidelines.md`
**Method:** counted across every `.tsx` under `apps/lao-web/src/app`.

The product was built before this standard existed. Nothing below is a mistake anyone made — it is the gap between "built fast" and "built to a brand". Remediation is mechanical.

---

## Findings

| # | Standard | Current state | Severity |
|---|---|---|---|
| A1 | Page background is pure white | ~~33 screens used a grey gradient~~ → **fixed**, all now `bg-surface` | ✅ Fixed |
| A2 | One icon family (Lucide, rounded line) | **Partly fixed** — all 17 emoji replaced with Lucide (landing page, discover, build, reflection, solution). Text arrows `→ ←` and `✓` remain in ~10 places | Medium |
| A3 | Body text is 16px | `text-sm` used **190×**, `text-xs` **45×**; `text-base` barely present | High |
| A4 | Restrained weight; 400/500/600 only | **66 `font-bold`**, 100 `font-semibold`, 83 `font-medium` | Medium |
| A5 | Inter is the typeface | ~~Never loaded~~ → **fixed**, self-hosted via `next/font/google` | ✅ Fixed |
| A6 | Brand tokens, no ad-hoc palette | Tokens now exist (`brand.*`, `ink.*`, `surface.*`, `stage.*`). Components still use `slate-*`/`blue-500` and should migrate as touched | Medium |
| A7 | Colour carries meaning | ~~Decorative green gradient page~~ → **fixed** | ✅ Fixed |
| A8 | Sentence case headings | Mostly correct; a few Title Case headings | Low |
| A9 | Rounded corners | `rounded-lg` used 167× — consistent | ✅ Pass |
| A10 | No rainbow interfaces | Corrected in earlier sprints; only 3 accent gradients remain | ✅ Pass |
| A11 | One primary action per screen | Blue is consistently the action colour | ✅ Pass |

---

## What A1 actually means

Every page opens with a grey gradient wash. It is subtle, and it is the single biggest reason the product reads as "a competent web app" rather than "beautifully designed". The logo sits on pure white; the product should too.

The fix is a find-and-replace across 33 files:

```
bg-gradient-to-br from-slate-50 to-slate-100   →   bg-surface
```

Roughly an hour, and it changes the feel of everything.

## What A3 actually means

The interface is small-text-heavy: 190 uses of 14px against 8 uses of 36px. It reads as dense and administrative — closer to "Corporate LMS", which the brand explicitly rejects — rather than calm and generous.

This one is not a find-and-replace. It needs a pass per screen, promoting real content to 16px and leaving only genuinely secondary material at 14px.

---

## Remediation order

Do these as screens are touched, not as one large refactor.

**Done in this sprint** (A1, A5, A7, and the emoji half of A2 — the items that
change first impressions and were cheap):

| Work | Result |
|---|---|
| A1 — white backgrounds | 33 screens now `bg-surface` |
| A5 — load Inter | self-hosted, no layout shift |
| A2 — emoji removed | 17 emoji → Lucide icons, incl. 6 on the landing page |
| A7 — decorative gradient | removed |
| Copy | 3 exclamation marks removed; footer year corrected to 2026 |

**Remaining:**

| Order | Work | Effort |
|---|---|---|
| 1 | A3 — promote body copy to 16px | 3h |
| 2 | A4 — `font-bold` → `font-semibold` | 1h |
| 3 | A6 — migrate `slate-*`/`blue-500` to brand tokens | 2h |
| 4 | A2 — remaining text arrows `→ ←` and `✓` to Lucide | 1h |
| 5 | A8 — heading case | 20m |
| 6 | A12 — dark-mode toggle (below) | 30m |

**Remaining ≈ 7.5 hours.** None of it is new design; it is applying a standard
that now exists.

---

## A12 — the dark mode toggle does nothing

`globals.css` defines a `.dark` block, but the `dark` class is **never applied
anywhere**. Meanwhile `settings/page.tsx` renders a dark-mode switch a learner
can turn on. It persists to `Settings.darkMode` and changes nothing on screen.

Two problems: a control that silently does nothing is worse than no control, and
the brand is explicit that **dark is not part of this identity**.

**Recommendation:** remove the toggle from settings and delete the `.dark` block.
Left in place here because it maps to a persisted column and removing it is a
product decision with an API contract attached — not something to change
unilaterally inside a brand sprint.

---

## Relationship to the beta blockers

The Private Beta Readiness Review lists six blockers. **Those come first** — a beautiful screen that 404s at the first click is still a broken product.

The cheap, high-impact items were done here — white surfaces, the real
typeface, and removing every emoji — because together they took about ninety
minutes and are the difference between a learner thinking *"this feels well
made"* and *"this looks like an AI demo"*, which is exactly the judgement the
brand directive is aimed at. The landing page in particular led with a 🤖.

The rest should follow as normal work, enforced by the conformance test so it
cannot regress.
