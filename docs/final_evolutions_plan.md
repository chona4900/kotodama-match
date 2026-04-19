# Fourth-Stage Evolution Plan (18 Final Forms)

## Goal Description
Expand the Kotodama Tamagotchi to feature a **Fourth Evolution Stage** (the Final Form) at 10,000 total words. Each of the 6 third-stage characters will branch into three possible ultimate forms based on the breakdown of their specific group's words. This involves creating 18 new unique 24x24 pixel-art characters inspired by Japanese deities and Buddhist figures.

## Proposed Changes

### `index.html` Update
#### [MODIFY] `index.html`
- **Fourth Evolution Goal:** Introduce a new constant `STAGE3_GOAL = 10000;`.
- **Pixel Art Assets (`PIXEL_ARTS` dictionary):** Add 18 new 24x24 pixel art arrays:
    - **A-1 (Tenko) Branch:** Amaterasu, Kukirihime, Juichimen Kannon
    - **A-2 (Renge) Branch:** Senju Kannon, Konohanasakuya-hime, Seoritsu-hime
    - **B-1 (Hiryu) Branch:** Seiryu, Fudo Myoo, Takemikazuchi
    - **B-2 (Houou) Branch:** Suzaku, Dainichi Nyorai, Susanoo
    - **C-1 (Manekineko) Branch:** Daikokuten, Benzaiten, Ebisu
    - **C-2 (Takarabune) Branch:** Bishamonten, Hotei, Kisshoten
- **Evolution Logic (JS):** Update the `updateUI()` and `evolve(targetStage)` functions to handle a 4th stage (10000 counts). Calculate the winning word within the *current* subgroup to determine the final 1 of 3 forms. (e.g., if A-1 Tenko, check which of "愛してます", "ありがとう", or the remaining words are highest).
- **Developer Gallery / Test Panel:** Modify the preview gallery to accommodate a 4th tier. This might require significant layout adjustments to the gallery container due to displaying 28 total characters (1+3+6+18).

## Verification Plan
1. Trigger the 10,000-count final evolution using test buttons.
2. Verify all 18 branches work accurately depending on the specific word ratios.
3. Validate that the new 24x24 pixel art characters render correctly in the main screen and the gallery.
