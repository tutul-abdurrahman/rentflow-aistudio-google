# Bill House — Construction

Execution notes for Figma / Illustrator. Coordinates are on the **64-unit master grid**.

These SVGs are direction. Redraw as real geometry, then flatten.

## 1. Grid

- Master: 64 × 64
- App tile: 64 × 64, corner radius **16** (matches design-system card radius)
- Do not eyeball. Keep the numbers.

## 2. House — app icon

| Point               | X           | Y         |
| ------------------- | ----------- | --------- |
| Apex                | 32          | 11        |
| Left eave           | 11          | 28.5      |
| Right eave          | 53          | 28.5      |
| Left wall           | 17          | 28.5 → 53 |
| Right wall          | 47          | 28.5 → 53 |
| Floor               | —           | 53        |
| Inner floor corners | radius ~1.4 |           |

- Roof overhang: **6** past each wall
- Optical lift: apex at y=11 so the roof does not feel heavy in the tile. Do not compress it.

## 3. Ledger bars — app icon (cutouts)

| Bar    | Y    | Height | X               |
| ------ | ---- | ------ | --------------- |
| Top    | 34   | 3      | 24.5 → 39.5     |
| Middle | 40.5 | 3      | 24.5 → 39.5     |
| Bottom | 47   | 3      | 24.5 → **34.7** |

Bottom bar = **68%** of a full bar: `(34.7 − 24.5) / 15 = 0.68`.

That short last line is the receipt. Keep it. Never turn the three bars into a door.

Bar corners: radius **1.5** on the app tile (reads as printed, not punched).

## 4. Standalone mark

Same idea, slightly larger in the 64 frame (padding 6):

- Apex (32, 6)
- Eaves (5, 27.5) / (59, 27.5)
- Walls x=12 / 52, floor y=57
- Bars y=32.5 / 41 / 49.5, height 3.5, x=22.5 → 41.5, last bar to 35.5

## 5. Even-odd cutouts

One filled shape. House outline + three bar subpaths. `fill-rule="evenodd"`.

In Figma: boolean **Subtract** the bars from the house, then **Flatten**. Do not ship masks — flattened holes survive every pipeline.

The bars are holes. They take whatever sits behind. Never a third color.

## 6. Small app icon (16–24px)

Same house. **Two** thicker bars only:

- Bar 1: y=35.5, height 4, x=23.5 → 40.5
- Bar 2: y=44, height 4, x=23.5 → 36.5 (still the short receipt line)

Do not use this above 24px.

## 7. Print stroke

Same silhouette, **no fill**.

- Stroke **2.75 / 64**
- Round caps and joins
- Ink `#1B2432` on paper; paper stroke on dark stock
- Minimum **8mm**
- At 8mm mark height, stroke ≈ 0.34mm — holds on a 600dpi receipt grid

Do not outline the filled mark to fake this. Use the stroke files.

## 8. Optical checklist before export

- Roof sits slightly high in the tile (air above the eaves)
- Last bar clearly shorter
- Overhang visible left and right
- No letters
- Tile radius stays 16
- Small size uses 2 bars, not a scaled 3-bar

## 9. Export

| File                     | Notes                                      |
| ------------------------ | ------------------------------------------ |
| `icon-app.svg`           | Primary. Also raster 1024 / 512 for stores |
| `icon-app-dark.svg`      | Identical geometry, ink tile               |
| `icon-app-small.svg`     | 16–24px only                               |
| `icon-mark.svg`          | Saffron cutout                             |
| `icon-mark-ink.svg`      | Ink cutout                                 |
| `icon-mark-paper.svg`    | Paper cutout                               |
| `icon-print.svg`         | Receipts                                   |
| `icon-print-reverse.svg` | Dark stock                                 |

Always export SVG from flattened paths. 64-unit source stays the master.
