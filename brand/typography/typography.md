# LAO Academy — Typography

**Readable before stylish.** Typography should feel effortless: large headings, comfortable spacing, dark charcoal text.

---

## Typeface

**Inter**, one family, already configured in `tailwind.config.ts`.

```ts
fontFamily: { sans: ['Inter', ...defaultTheme.fontFamily.sans] }
```

No second display face. No monospace except for solution content, where the learner is reading instructions they wrote and character alignment matters.

> **Not yet loaded.** `tailwind.config.ts` names Inter but nothing imports the webfont, so the product currently renders in the system stack. Add `next/font/google` in `layout.tsx` — it self-hosts, avoids a third-party request, and removes the layout shift. Small job, listed in `../AUDIT.md`.

---

## Scale

| Role | Size | Weight | Leading | Colour |
|---|---|---|---|---|
| Display | 40px | 600 | 1.1 | `ink` |
| Page title | 32px | 600 | 1.15 | `ink` |
| Section | 24px | 600 | 1.25 | `ink` |
| Subsection | 20px | 600 | 1.3 | `ink` |
| **Body** | **16px** | **400** | **1.6** | `ink-body` |
| Body strong | 16px | 500 | 1.6 | `ink` |
| Secondary | 14px | 400 | 1.5 | `ink-muted` |
| Caption | 13px | 400 | 1.4 | `ink-muted` |

**Body is 16px.** Anything a learner must read to use the product is 16px. 14px is for genuinely secondary material — timestamps, counts, helper text. 12px is not in the scale.

Tailwind equivalents: `text-4xl` / `text-3xl` / `text-2xl` / `text-xl` / `text-base` / `text-sm` / `text-[13px]`.

---

## Weight

Three weights only: **400** regular, **500** medium, **600** semibold.

**Avoid heavy bold text everywhere.** Bold is emphasis, and emphasis only works when it is rare.

- `font-bold` (700) is not in the system. Use 600 for headings.
- Do not bold an entire line to make it a heading. Change its size.
- Never bold body copy for tone. Rewrite the sentence instead.

> The product currently uses 166 bold/semibold utilities including 66 `font-bold`. That is emphasis inflation and should come down as screens are touched.

---

## Spacing

Whitespace is a brand asset.

| Between | Space |
|---|---|
| Heading and its body | 12px |
| Paragraphs | 16px |
| Content blocks | 24px |
| Sections | 48px |
| Page top padding | 48px desktop / 32px mobile |

Measure: **65–75 characters** per line. Cap prose at `max-w-[68ch]`. A full-width paragraph on a wide monitor is unreadable regardless of the font.

---

## Voice

Typography and wording are one system.

- **Sentence case** for headings. Not Title Case. Not ALL CAPS. (The logo lockup uses caps; the interface does not.)
- No exclamation marks in UI copy. Confidence is quiet.
- Say the thing. *"Used 12 times"*, not *"You've used this an incredible 12 times!"*
- Second person for the learner's own work: *"Your toolbox"*. Never *"LAO helps you…"*.

---

## Practical examples

```tsx
// Page title
<h1 className="text-[32px] leading-tight font-semibold text-ink">
  What are we solving today?
</h1>

// Section
<h2 className="text-2xl font-semibold text-ink mb-3">Your toolbox</h2>

// Body — 16px, the default
<p className="text-base leading-relaxed text-ink-body max-w-[68ch]">
  Summarise each thread and flag the ones needing a reply.
</p>

// Secondary
<p className="text-sm text-ink-muted">Last used yesterday</p>
```
