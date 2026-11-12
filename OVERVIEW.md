# Overview

Short version of [README.md](README.md). The full formulas, the worked numbers, the preset table, and the screenshots are there. [Tiếng Việt](README.vi.md).

## What it is

A browser tool that sizes the transverse steel in a pile cap and looks for a cheaper cap that still passes. The model is a three-dimensional strut-and-tie idealisation: the column load travels down inclined concrete struts into the piles. A strut that bulges in the middle (a bottle-shaped strut) splits the cap unless bars tie across it. Those bars are the anti-bursting reinforcement.

The engineer of record still checks the numbers against the project specification.

## The trade-off

Three things fail, often together: the strut is too flat, the concrete at the pile head crushes, or the cage is short of steel, too widely spaced, or too tight for a poker vibrator.

- A deeper cap steepens the struts and cuts steel, and it buys more concrete, formwork, and excavation.
- A higher concrete grade fixes crushing without digging deeper, at a higher price per cubic metre.
- A lighter cage is the right change when the concrete size is already frozen.

The app prices all four effects: concrete, anti-bursting steel, the main soffit mat, and formwork plus excavation.

## The calculation, in one pass

Geometry is in millimetres, forces in kN, moments in kN·m, stresses in MPa. `calculate` is a pure function; the screen recomputes on every edit.

1. **Lever arm and pile reactions.** `d = h − c` and `z = 0.85d`. Each pile reaction is the axial share plus the two moment terms, `MEd,x` along Y and `MEd,y` along X. A pile with `R ≤ 0` is in tension and forms no strut. Self-weight, if requested, is added only to the pile-check reaction. The strut keeps using the column force.
2. **Strut geometry.** The strut leaves the column at a quarter of the column size, on the side toward the pile. Horizontal run `a`, length `Ls`, angle `θ`. Below 25° the strut is too flat. If `a > 2d` the cap is a beam, and strut-and-tie is the wrong model.
3. **Crushing.** Allowable stress is `0.6·ν′·fcd`, with `ν′ = 1 − fck/250`. The stress on the pile head is `R / (Ap · sin²θ)`, so a steeper strut helps twice. Transverse steel does not raise this limit.
4. **Tension across the bottle.** EC2 and TCVN use the bottle-strut expressions (a restrained spread when the bearing is wide relative to the strut, otherwise the geometric spread). ACI 318-19 uses `T⊥ = 0.25·Fc`. Choosing ACI changes only this force. The crushing limit stays the same.
5. **One design force per direction.** The horizontal tie is split into X and Y. Bars on one side of the column do not help the other side, so each half is summed and the worse half is kept.
6. **The cage.** Steel is spread over the middle 80% of the lever arm. Provided area is layers × legs × one bar. The check is required area over provided area.

On-screen pass limits are `θ ≥ 25°`, utilisation `≤ 1`, and layer spacing 100–300 mm. Auto-Fix is tighter: `θ ≥ 26.5°`, utilisation `≤ 0.98`, spacing 110–280 mm, a 100 mm clear gap, and `φ ≥ 14` mm when the cap is 2 m or deeper.

The benchmark in the tests is a 4-pile cap, 8 000 kN, 1 500 mm deep. The cage nearly passes and the layers are too far apart, but the strut crushes at about 1.67. More bursting steel does not fix that.

## Auto-Fix

A catalogue search, not an iterative solver: depths on a 100 mm grid, the concrete grades, eight bar diameters, 2–10 layers, and leg counts of 2, 4, 6, or 8. It keeps the lightest legal cage, then the cheapest feasible pair.

Three cards:

1. **Rebar only.** Depth and grade stay.
2. **Raise the grade, keep the depth.** From the current grade up to B50. The card for a formation level that cannot go down.
3. **Lowest total cost.** Depth from 800 mm shallower to 2 000 mm deeper, grades B30–B45 only.

Hover a feasible card to preview it on the model. The old utilisation stays as a dim bar behind the new one. Apply writes it in and reports the change in cost and in kilograms of bursting steel.

A chart under the cards plots concrete-plus-formwork-plus-excavation (rises with depth), steel (falls as the struts steepen), and the total. Hatched bands are depths that still crush.

## What the screen contains

- Six Vietnamese high-rise presets, from a 22-storey PHC building to a 45-storey mega-column whose starting cage fails on purpose, plus 2, 3, 4, and 6-pile layouts at three diameters spacing.
- Grades B25–B50 and CB300-V, CB400-V, CB500-V, for EC2, TCVN 5574:2018, and ACI 318-19.
- A 3D model (shell, bottle struts coloured by crushing, splitting arrows, cage) and a dimensioned 2D section.
- An info button on each result that substitutes this design’s numbers into the formula.
- A vibrator gauge for a Ø50 mm and a Ø70 mm poker.
- An A4 note with the six steps, every pile, and the section.
- Dark and light theme, Vietnamese and English, a first-run tour, and CAD-style keys (`1`–`4` cameras, `X` `B` `R` layers, `[` `]` diameter, `-` `=` layers, Shift+arrows for depth, `A` for Auto-Fix).
- Optional cloud save: an email link, one row per design, and row-level security so each user sees only their own rows. Without the two environment variables the rest of the app still runs.

Screenshots of the dark workspace, the light workspace, the six-pile cap, the 2D section, and the calculation note are at the top of [README.md](README.md).

## Stack

TypeScript, React 19, and Vite. Tailwind for layout and the two themes. three.js, React Three Fiber, and drei for the viewer, loaded only when the 3D tab opens. Supabase for the email link and Postgres. Vitest for the engine, the formula text, and the cost model.

The arithmetic lives in `src/core` and does not import React. The interface lives in `src/components`.

```bash
npm install
npm run dev
npm test
```

## Out of scope

Piles, soil, punching shear, crack width as its own limit state, and a bar-by-bar schedule for the soffit mat. Auto-Fix does not move piles or change the plan size of the cap. The unit prices rank options; they are not a quotation.
