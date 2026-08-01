# Master logo

**These files are the single source of truth for the LAO Academy identity.**

## ⚠️ The master assets are not yet committed

The logo was supplied in conversation, not as a file in the repository, so the binary was never available on disk to commit.

**It has deliberately not been recreated.** The brand directive is explicit: never redesign, never recreate, never reinterpret, never generate a replacement with AI. Producing an approximation and naming it `lao-master.png` would violate that instruction and — worse — would quietly become the reference that every future screen is built against. An honest gap is safer than a convincing fake.

Everything else in `/brand` is complete and usable today. Only these binaries are outstanding.

## What to add

Drop the original files here with exactly these names:

| File | Format | Notes |
|---|---|---|
| `lao-master.png` | PNG, transparent | The supplied artwork at its original resolution. Do not resample. |
| `lao-master.svg` | SVG | Vector master. If no vector exists, commit the PNG and record that here. |
| `favicon.svg` | SVG | The "O" mark alone, no wordmark — legible at 16px. |

A conformance test fails until `lao-master.png` is present, so this cannot be quietly forgotten.

## After adding them

1. **Verify the palette.** Sample each swatch in `../colors/palette.md` with a colour picker and correct any value that differs. The hex codes there were read by eye and are marked as provisional.
2. **Wire the favicon** into `apps/lao-web/src/app/layout.tsx`.
3. **Delete this warning section**, keeping the usage rules below.

---

## Usage rules

**Clear space.** Keep free space equal to the height of the "L" on every side. Nothing enters that space.

**Minimum size.** 120px wide for the full lockup. Below that, use the "O" mark alone.

**Background.** White, always. The mark is built for white and its gradients muddy on colour. Never place it on a photograph, a coloured panel, or a dark surface.

**Never:**
- Recolour it, or any part of it
- Stretch, skew, rotate or crop it
- Add a shadow, glow, outline or bevel
- Rebuild the wordmark in a different typeface
- Separate the swoosh from the letterforms
- Place it on a busy or dark background
- Regenerate it with an image model

**The lockup.** The full asset includes the LEARN · BUILD · LAUNCH · EARN row. Use the complete lockup where there is room; the wordmark alone is acceptable in tight placements such as the product header. Do not rebuild that row by hand — the badge colours belong to the four stages and are recorded in `../colors/palette.md`.
