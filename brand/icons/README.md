# Icons

**One family. Rounded line icons. No exceptions.**

## The family

**Lucide** — `lucide-react`, already a dependency of `@lao/ui`.

Chosen because it is a rounded line set with a consistent stroke, it is the icon
family shadcn/ui assumes (which `@lao/ui` is built on), and it is open source
with no attribution requirement.

```tsx
import { Wrench, Sparkles, Clock, Share2 } from 'lucide-react';

<Wrench size={20} strokeWidth={1.5} className="text-ink-muted" />
```

## Rules

| Property | Value |
|---|---|
| Stroke | `1.5` |
| Inline size | `20px` |
| Standalone size | `24px` |
| Colour | `currentColor` — inherit from text |

- **No filled icons** mixed with line icons.
- **No emoji as UI.** Emoji render differently on every platform and read as informal.
- **No cartoon illustrations** or mascots.
- **No second icon library.** If Lucide lacks a glyph, compose from what exists or do without.

## Current state

Lucide is a dependency but is **imported zero times** in the app. Icons are
currently raw unicode glyphs — `✓`, `→`, `←`, `×`, and a `🎉` on one screen.

These are not part of the system. Replace them with Lucide equivalents as
screens are touched:

| Current | Replacement |
|---|---|
| `✓` | `Check` |
| `→` | `ArrowRight` |
| `←` | `ArrowLeft` |
| `×` | `X` |
| `🎉` | remove — celebration is carried by words, not confetti |

## Do not store icon files here

This directory documents the decision. Icons come from the package, so there is
nothing to commit. It exists only if we ever need a custom glyph Lucide does not
provide — and that should be rare enough to require a conversation first.
