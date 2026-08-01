# LAO Academy — Brand Guidelines

**Status:** Platform standard. Not guidance.
**Authority:** The master logo in `/brand/logo/` is the single source of truth for every design decision.
**Rule:** Before creating any page, component, illustration, landing page, marketing asset, email template or dashboard, read this document. **Where a design conflicts with the brand system, the brand system wins.**

---

## 1. The logo

The supplied LAO Academy logo is the master reference.

- **Never** redesign it.
- **Never** recreate it.
- **Never** reinterpret it.
- **Never** generate a replacement with AI.
- Always build *around* this identity.

Everything else in this document — the palette, the type scale, the spacing — is derived from that mark. If the two ever disagree, the mark is right.

### What the mark tells us

Read the logo carefully and it states the brand for us:

| What it does | What that means for the product |
|---|---|
| Sits on pure white | Our interfaces are white, not grey, and not dark |
| Uses colour only in the wordmark | Colour is the *subject*, never the wallpaper |
| Spans blue → magenta → orange → green | We are optimistic and broad, not a single-hue tech brand |
| Sets "ACADEMY" in calm navy | Body text is dark and quiet; the colour does the singing |
| Uses four distinct icon badges | One icon family, one badge shape, four accent hues |
| Leaves generous air around everything | Whitespace is a brand asset, not wasted space |

---

## 2. Personality

LAO should feel:

**Professional · Calm · Optimistic · Premium · Human · Modern · Approachable**

LAO must never feel:

**Dark cyberpunk · Hacker themed · Neon AI · Sci-fi · Gaming · Corporate LMS · Generic AI startup**

> If a screen looks like an AI demo, redesign it.

### The test

Show a screen to someone who has never seen LAO and ask what kind of company made it. If the answer contains "AI", "tech" or "startup", the screen has failed. The answer we want is closer to *"something well-made"*.

---

## 3. Core philosophy

LAO exists to help ordinary people become capable.

**The learner is the hero. LAO is the guide.**

The interface should quietly communicate confidence. It should not perform. Practically:

- Never celebrate ourselves. Celebrate what the learner did — briefly, then move on.
- Never say "AI-powered", "intelligent", "smart" or "magic".
- Never name a model or vendor. (Enforced by test — see `COLLABORATOR.md`.)
- Language is plain and human. If a sentence would sound odd said aloud to a colleague, rewrite it.

---

## 4. Visual language

The interface is **predominantly white**, with colour used sparingly to guide attention.

| Element | Standard |
|---|---|
| Page background | Pure white `#FFFFFF`. Not grey, not a gradient. |
| Surfaces / cards | White, separated by a hairline border or a soft shadow — not both |
| Borders | `#E8EAF0` hairline |
| Corner radius | `12px` for cards and inputs, `10px` for buttons, `999px` for pills |
| Shadow | One soft elevation only: `0 1px 2px rgba(18,34,92,.04), 0 4px 16px rgba(18,34,92,.06)` |
| Colour | Accent only. One accent per screen region. |
| Density | Generous. When unsure, add space rather than content. |

### Rules on colour

1. **Do not create rainbow interfaces.** The logo holds the full spectrum so the product doesn't have to.
2. **One primary action per view**, in Brand Blue. Everything else is quieter.
3. **Colour carries meaning, never decoration.** Green means a thing succeeded. Amber means attention. Red means a real problem. If a colour means nothing, remove it.
4. **No colour gradients on backgrounds.** Gradients belong to the logo. The only permitted gradient in-product is the thin brand rule (see `colors/palette.md`), used at most once per page.
5. **Never a dark theme** for the product surface. Dark is not part of this identity.

---

## 5. Typography

Typography should feel effortless. **Readable before stylish.**

- Large headings, comfortable spacing, dark charcoal text.
- **Avoid heavy bold text everywhere.** Bold is emphasis; if everything is bold, nothing is.
- One typeface. Inter, already configured in `tailwind.config.ts`.

Full scale in `typography/typography.md`. The short version:

| Use | Size / weight |
|---|---|
| Page title | 32–40px, weight 600, tight leading |
| Section heading | 20–24px, weight 600 |
| Body | 16px, weight 400, generous line height |
| Secondary | 14px, weight 400, `--ink-muted` |
| Never | 12px for anything a learner must read |

**Body text is 16px.** Our current interface leans on 14px and 12px; that is a legacy of building fast, not a decision, and it should be corrected as screens are touched.

---

## 6. Icons

**One family. Rounded line icons. No exceptions.**

- Library: **Lucide** (`lucide-react`), already a dependency of `@lao/ui`.
- Stroke `1.5px`, size `20px` inline / `24px` standalone.
- No filled icons mixed with line icons. No emoji as UI. No cartoon illustrations.

> Today the product uses raw unicode glyphs (`✓`, `→`, `×`) as icons in several places. These are not part of the system and should be replaced with Lucide equivalents as screens are touched.

---

## 7. Photography & illustration

Prefer real people, real work, clean vector illustration, modern photography.

**Avoid artwork that immediately looks AI-generated** — plastic lighting, impossible hands, glowing blue circuitry, robot mascots, floating holograms.

If we cannot source something real, use nothing. Whitespace is always better than a stock image of a robot.

---

## 8. UX principle

Every screen answers exactly one question:

> **"What is the next useful thing I can do?"**

Not *"what features exist?"*

Practically:
- One primary action per screen, visually obvious.
- Empty states propose the next step; they never merely report emptiness.
- Never show a number without saying what it means for the learner.
- Remove anything that does not help someone move forward.

---

## 9. Engineering rule

**Before building any UI, read this file.**

Use the design tokens in `colors/palette.md`, exposed in `tailwind.config.ts` as `brand.*` and `ink.*`. Do not hardcode hex values in components.

A conformance test (`apps/lao-web/src/lib/__tests__/brand-conformance.test.ts`) enforces the mechanical parts: no dark page surfaces, no decorative background gradients, no emoji as UI, no raw brand hex codes in components. It fails the build, not a linter warning.

The test cannot judge taste. It only catches drift. **Taste is still your job.**

---

## 10. Why this matters

Six months from now every screen should feel like it belongs to the same company. A learner should recognise LAO without seeing the logo.

**Brand consistency is part of engineering quality**, in the same way that a passing test suite is. A beautiful screen next to a careless one makes the whole product feel careless.

---

## Current conformance

Audited 2026-08-01 against the live codebase. See `AUDIT.md` in this directory for the full list and remediation order. Summary:

| Standard | State |
|---|---|
| White page backgrounds | ❌ 33 screens use a grey gradient |
| One icon family | ❌ Lucide imported 0 times; unicode glyphs used instead |
| Body text at 16px | ❌ `text-sm` (14px) used 190×, `text-4xl` only 8× |
| Restrained bold | ❌ 166 bold/semibold utilities |
| Rounded corners | ✅ `rounded-lg` throughout |
| No rainbow interfaces | ✅ Largely corrected in earlier sprints |
| Colour as meaning | ✅ Blue for action, green for success |

This is remediation work, not new design. It should be done as screens are touched, ahead of the beta invitations where it is cheap.
