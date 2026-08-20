# RentFlow — Brand Guidelines

> Working name. "RentFlow" may change. The **mark** is locked; the name is not.

## 1. Introduction

RentFlow is a property rent and utility ledger app for Bangladesh — a dependable place to keep records straight. The identity sits on **Paper & Ink**: the quiet trust of a handwritten ledger, carried onto a modern screen.

**Bill House** is that idea as one mark: a house with the bill cut into it. This document is the usage source of truth. Coordinates live in [CONSTRUCTION.md](CONSTRUCTION.md).

## 2. Primary logo

The mark is **Bill House**. It is icon-only.

A house silhouette with three ledger bars cut out of the body. The last bar is shorter (~68%), like a receipt whose final line ran out of space. No letters, no RF, no ৳.

**Primary app icon** — [icon-app.svg](icon-app.svg)  
Saffron rounded tile, paper house, three cutout bars. Default for stores, product, and marketing at **32px and above**.

**Print is always 1-color.** Use the stroke version [icon-print.svg](icon-print.svg) on money receipts.

If a name is added later, set it **outside** the mark — never inside the house.

## 3. Clear space & minimum size

**Clear space** (nothing may enter it):

- **App tile:** height of one ledger bar — **3 units on the 64 grid** — on all sides.
- **Standalone mark:** **1/8 of the mark height** on all sides.

**Minimum sizes**

| Surface         | Minimum | Notes                                                   |
| --------------- | ------- | ------------------------------------------------------- |
| App tile        | 24px    | Use [icon-app-small.svg](icon-app-small.svg) below 32px |
| Standalone mark | 24px    | —                                                       |
| Favicon         | 16px    | Always the small version                                |
| Print (stroke)  | 8mm     | Below this, do not use                                  |

## 4. Variations matrix

| Kind             | File                                             | Field        | Mark                  | Use                      |
| ---------------- | ------------------------------------------------ | ------------ | --------------------- | ------------------------ |
| Primary app icon | [icon-app.svg](icon-app.svg)                     | Saffron tile | Paper, 3 bars         | 32px+, stores, marketing |
| App icon, dark   | [icon-app-dark.svg](icon-app-dark.svg)           | Ink tile     | Paper, 3 bars         | Dark / formal            |
| App icon, small  | [icon-app-small.svg](icon-app-small.svg)         | Saffron tile | Paper, 2 thicker bars | **16–24px only**         |
| Mark             | [icon-mark.svg](icon-mark.svg)                   | Transparent  | Saffron cutout        | On paper / white         |
| Mark, ink        | [icon-mark-ink.svg](icon-mark-ink.svg)           | Transparent  | Ink cutout            | Mono on light            |
| Mark, paper      | [icon-mark-paper.svg](icon-mark-paper.svg)       | Transparent  | Paper cutout          | On ink / saffron / photo |
| Print stroke     | [icon-print.svg](icon-print.svg)                 | Transparent  | Ink stroke            | A4 receipts, 1-color     |
| Print reverse    | [icon-print-reverse.svg](icon-print-reverse.svg) | Transparent  | Paper stroke          | On dark stock            |

## 5. Color

Paper & Ink with one warm accent. HEX is authoritative.

| Name         | HEX       | RGB         | Role                      |
| ------------ | --------- | ----------- | ------------------------- |
| Paper        | `#FAF6F0` | 250 246 240 | Page, house fill on tiles |
| Paper-soft   | `#F3ECE1` | 243 236 225 | Soft panels               |
| White        | `#FFFFFF` | 255 255 255 | Cards / raised UI         |
| Ink          | `#1B2432` | 27 36 50    | Text, 1-color ink         |
| Ink-muted    | `#5A6472` | 90 100 114  | Secondary text            |
| Saffron      | `#DF9C35` | 223 156 53  | Brand — tile and mark     |
| Saffron-deep | `#C88626` | 200 134 38  | Hover / pressed           |
| Line         | `#E7DFD2` | 231 223 210 | Hairlines                 |

Saffron is the accent. Ink does the work. Never place a saffron mark on a saffron field. For 1-color print, use Ink (or Paper on dark stock).

## 6. Type note

- Icon-only. No wordmark is locked.
- If a name is added later, set it **outside** the mark.
- Product UI already uses **Noto Sans Bengali**.
- Future English lockup — a **note, not a lock:** **Source Sans 3**. Humanist, open, sits next to Noto Sans Bengali without looking like a default UI stack. Weights 400 / 600 / 700. Revisit when the final name is set.

## 7. Incorrect usage

- No letters, RF, or ৳ inside the house
- Do not stretch or rotate
- Do not put saffron on saffron
- No gradients, shadows, or 3D
- Do not redraw the bars as a door
- Do not fill the bars a third color — they are holes
- Do not use the color tile on A4 money receipts — use the print stroke
- Do not outline the filled mark

## 8. Application

**App icon.** Saffron tile at 32px+. Below 32px, switch to the small (2-bar) tile. Favicon 16px always uses small. Dark surfaces: ink tile.

**Header / avatar.** Standalone mark. Ink on light, paper on dark or saffron. Hold clear space. Name, if any, sits beside — never inside.

**A4 money receipt.** Always [icon-print.svg](icon-print.svg), single ink, minimum 8mm. Never the color tile.

## 9. Handoff

Masters in this folder are SVG direction for Figma / Illustrator — not production `.ai` / `.fig`.

Redraw from [CONSTRUCTION.md](CONSTRUCTION.md). Flatten boolean cutouts before export. Keep the 64-unit source as the single master.

Name and English lockup remain open.
