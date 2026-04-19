# Renaming Characters in Kotodama Tamagotchi

Renaming four specific final evolution characters in the `index.html` file to align with the user's latest request.

## Proposed Changes

### kotodama-app

#### [MODIFY] [index.html](file:///c:/Users/washi/Dropbox/作業用/kotodama-app/index.html)

- Rename **菊理媛っち** to **玄武っち**
- Rename **木花咲耶姫っち** to **白虎っち**
- Rename **吉祥天っち** to **孔雀明王っち**
- Rename **建御雷神っち** to **阿弥陀如来っち**

These names will be updated in:
1. The **Evolution Gallery (プレビュー用)** section.
2. The **Evolution Logic (`evolve` function)** branch status messages.
3. The **`names` mapping object** in the script.

## Verification Plan

### Manual Verification
1. Open `index.html` in a browser.
2. Scroll down to the **Evolution Gallery (プレビュー用)** and verify the names are updated.
3. Use the **Developer Test Buttons** to reach the final evolution stages for each route:
   - Route A (A-1, A-2) for 玄武っち and 白虎っち.
   - Route B (B-1) for 阿弥陀如来っち.
   - Route C (C-2) for 孔雀明王っち.
4. Confirm the status message "最終形態：[New Name]！" correctly displays the new name upon evolution.
