# Kotodama Match - Project History

This document summarizes the milestones and key developments of the Kotodama Match project.

## Project Overview
Kotodama Match (言霊たまごっち) is an interactive game where users evolve a character by speaking positive "Kotodama" words. The game uses speech recognition to track word counts and branch evolution paths.

## Key Milestones

### 1. Initial Implementation
- Core game loop established.
- Basic Speech Recognition for Japanese words.
- 3 evolution stages (Egg -> Child -> Adult).
- Word grouping (A: Love/Acceptance, B: Joy/Vitality, C: Gratitude/Luck).

### 2. Final Evolution Stage (Deities and Buddhas)
- Introduced a 4th evolution stage (Deity) at 10,000 words.
- Added 18 new final forms based on Buddhist and Shinto figures (e.g., Amaterasu, Benzaiten, Fudo Myoo).
- Detailed branching logic for the final stage based on specific word dominance.
- Expanded the developer preview gallery to showcase all 28 character forms.
- *Reference docs: `docs/final_evolutions_plan.md`, `docs/final_evolutions_walkthrough.md`, `docs/evolution_tree.md`*

### 3. Character Polishing and Renaming
- Refined character names to align with Japanese mythology and Buddhist traditions.
- Updated the evolution gallery and JS logic for consistent character identity.
- *Reference docs: `docs/renaming_plan.md`, `docs/renaming_walkthrough.md`*

### 4. Project Consolidation (Current)
- Consolidated all project files into the `kotodama-match` folder.
- Organized historical artifacts into the `docs` directory for cross-device sharing.

## Folder Structure
- `index.html`: The main game application.
- `HISTORY.md`: This file.
- `docs/`: Historical documentation and design artifacts.
- `docs/evolution_tree.md`: Complete visualization of evolution paths.
