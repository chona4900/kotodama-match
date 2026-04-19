# Walkthrough: Character Renaming in Kotodama Tamagotchi

I have successfully updated the names of four final evolution characters in the app.

## Changes Made

### kotodama-app

#### [index.html](file:///c:/Users/washi/Dropbox/作業用/kotodama-app/index.html)

The following characters have been renamed across the entire file, including the **Evolution Gallery**, **Step-by-step logic notifications**, and the **Internal name mapping**:

1.  **菊理媛っち** (Kukurihime-tchi) $\rightarrow$ **玄武っち** (Genbu-tchi)
2.  **木花咲耶姫っち** (Konohanasakuya-tchi) $\rightarrow$ **白虎っち** (Byakko-tchi)
3.  **吉祥天っち** (Kisshouten-tchi) $\rightarrow$ **孔雀明王っち** (KujakuMyoo-tchi)
4.  **建御雷神っち** (Takemikazuchi-tchi) $\rightarrow$ **阿弥陀如来っち** (AmidaNyorai-tchi)

## Verification Results

### Manual Verification
- **Evolution Gallery**: Confirmed that the "プレビュー用" section correctly displays the new names below the respective character canvases.
- **Evolution Logic**: Confirmed that the `evolve(3)` function correctly maps the character keys (e.g., `childA_1_2`) to the new names (e.g., `玄武っち`) and displays them in the status message.
- **Internal Comments**: Updated labels for `PIXEL_ARTS` definitions to maintain consistency.

The app is now fully updated with the new character names! (^^)
