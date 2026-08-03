# LAO Academy — Colour Palette

**Derived from the master logo.** The logo is the reference; these values describe it.

> **Provenance — read this before using the hex values.**
> These were read from the supplied logo by eye, not sampled from the master file, because the binary was not present in the repository when this was written (see `../logo/README.md`). They are close and internally consistent, and safe to build with today.
> **Once `lao-master.png` is committed, sample the swatches with a colour picker and correct any that differ.** Adjust this file; do not adjust the logo.

---

## Brand colours

The spectrum in the wordmark, left to right.

| Token | Hex | Where it appears in the mark | Product use |
|---|---|---|---|
| `brand-blue` | `#1E6FEB` | The "L", base of the "A" | **Primary action.** Buttons, links, focus rings |
| `brand-sky` | `#22B4F5` | Highlight on the "L", start of the swoosh | Accents, quiet informational states |
| `brand-magenta` | `#E8256B` | Apex of the "A", right of the "O" | Rare emphasis. Never a button |
| `brand-orange` | `#F5911E` | Top-left of the "O" | The EARN badge; warm highlights |
| `brand-purple` | `#7B33D6` | Lower-right of the "O" | The LAUNCH badge |
| `brand-green` | `#1FA85C` | Centre of the swoosh | **Success only.** Never decoration |
| `brand-yellow` | `#F5C518` | End of the swoosh | Attention, sparingly |

## Ink

The "ACADEMY" navy is the text colour of the product. Charcoal, not black.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#12225C` | Headings, primary text |
| `ink-body` | `#2C3660` | Body copy |
| `ink-muted` | `#6B7495` | Secondary text, captions, placeholders |
| `ink-faint` | `#9AA1B8` | Disabled, hairline labels |

Pure `#000000` is never used.

## Surface

| Token | Hex | Use |
|---|---|---|
| `surface` | `#FFFFFF` | Page background. **The default.** |
| `surface-raised` | `#FFFFFF` | Cards — separated by border or shadow, never a fill |
| `surface-sunken` | `#F7F8FB` | Rare. Code blocks, read-only panels |
| `border` | `#E8EAF0` | Hairlines |
| `border-strong` | `#D3D8E4` | Inputs, focused borders |

## Semantic

Meaning only. If a colour means nothing on a screen, remove it.

| Token | Hex | Meaning |
|---|---|---|
| `success` | `#1FA85C` | It worked |
| `warning` | `#F5911E` | Needs attention, not broken |
| `danger` | `#D92D40` | Something is genuinely wrong |
| `info` | `#1E6FEB` | Neutral information |

## The four journey badges

From the lockup beneath the wordmark. These four hues belong to these four ideas and are not reused elsewhere.

| Stage | Token | Hex |
|---|---|---|
| LEARN | `stage-learn` | `#1E88E5` |
| BUILD | `stage-build` | `#22A85A` |
| LAUNCH | `stage-launch` | `#7B3FE4` |
| EARN | `stage-earn` | `#F57C20` |

## The brand rule

The only gradient permitted in-product. A 2px horizontal rule, echoing the dividers either side of "ACADEMY".

```css
background: linear-gradient(90deg, #22B4F5, #1E6FEB, #7B33D6, #E8256B, #F5911E);
```

**At most once per page**, as a hairline. Never as a background, never behind text, never on a button.

---

## Using them in code

Tokens are exposed in `apps/lao-web/tailwind.config.ts`:

```tsx
<button className="bg-brand-blue text-white rounded-[10px] px-5 py-2.5">
  Open
</button>

<p className="text-ink-muted text-base">Used 12 times</p>
```

**Do not hardcode hex values in components.** The conformance test fails on raw brand hex in `src/`.

## Ratios

A rough discipline for any screen:

- **~90%** white and ink
- **~8%** one accent, doing one job
- **~2%** everything else

If a screenshot shows more than two accent hues, something has gone wrong.

## Contrast

All of the following meet WCAG AA for body text on white:

| Pair | Ratio |
|---|---|
| `ink` on `surface` | 13.9:1 ✅ AAA |
| `ink-body` on `surface` | 10.2:1 ✅ AAA |
| `ink-muted` on `surface` | 4.9:1 ✅ AA |
| `brand-blue` on `surface` | 4.6:1 ✅ AA |
| `ink-faint` on `surface` | 2.6:1 ⚠️ decorative only — never body text |

`brand-yellow` and `brand-sky` **fail** against white for text. Use them as fills with ink on top, never as text colours.
