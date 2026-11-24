# PAW Dark Mode — IBM Planning Analytics Workspace Dark Theme

An eye-friendly **Manifest V3** Chrome / Microsoft Edge dark theme extension for **IBM Planning Analytics Workspace (PAW)** across IBM Cloud, SaaS (`*.planning-analytics.cloud.ibm.com`, `*.planninganalytics.cloud.ibm.com`, `*.planninganalytics.saas.ibm.com`, `*.planning-analytics.saas.ibm.com`, `*.saas.ibm.com`), and custom on-premises / enterprise environments.

---

## Features

- **Zero White Flash (Anti-FOUC):** Applies the dark background immediately on initial load (`document_start`) across the main page and nested `iframe` views.
- **IBM Carbon G100 Palette:** Built on soft Carbon dark surfaces (`#161616` background, `#1c1c1c`–`#262626` layers, `#e8e8e8` primary text) aligned with IBM Planning Analytics Workspace's design language.
- **Smart Dark Theme + Native Carbon G100 & HTML5 `<canvas>` Engine:**
  - Activates PAW's native `.carbon-theme-g100` design tokens (`--cds-*` / `--bx-*`).
  - Natively re-renders Cube Viewer and Dimension Editor HTML5 `<canvas>` grids with distinct contrast for consolidated (C-level), writable (N-level), read-only, and conditional cells.
  - Themes CodeMirror 6 (TI Process & Cube Rules editors, including `Ctrl+F` search/replace panels), Monaco/Ace fallbacks, Home tiles, Administration pages, and dynamic stylesheets while preserving the original layout geometry.
- **Eye Comfort Settings:** Instant fine-tuning sliders for **Brightness** (`70%–110%`), **Contrast** (`80%–120%`), and **Blue Light Filter (Warmth)** (`0%–40%`).
- **Custom Domain Support:** Click **"Apply to Current Tab"** in the extension popup to activate and persist the dark theme on custom internal or on-premises PAW hostnames.

---

## Installation (Google Chrome & Microsoft Edge)

1. Open the browser extensions page:
   - **Google Chrome:** Navigate to `chrome://extensions`
   - **Microsoft Edge:** Navigate to `edge://extensions`
2. Enable **Developer mode** (top-right in Chrome, bottom-left in Edge).
3. Click **Load unpacked**.
4. Select this folder (`PAW Dark Mode`).
5. Open or reload your **IBM Planning Analytics Workspace** tab (`https://<your-tenant>.planning-analytics.cloud.ibm.com/`) — the dark theme activates automatically.

---

## Usage Tips

- Click the **PAW Dark Mode** toolbar icon to toggle the theme or adjust Brightness, Contrast, and Blue Light Filter sliders live without reloading the page.
- For long modeling sessions, setting **Blue Light Filter (Warmth)** to `15%–25%` further reduces eye strain.
- If your workspace runs on a custom hostname that is not auto-matched, open the extension popup on that tab and click **Apply to Current Tab**.

---

## Optional: Built-in PAW Administrator Shell Theme

If you have **Administrator** permissions in Planning Analytics Workspace, you can optionally upload `paw-admin-theme/paw-dark-theme.zip` to apply dark shell colors server-side as well:

1. Go to **Administration > Customization > Themes** (or **Excel and Customizations > Themes**) in PAW.
2. Upload `paw-admin-theme/paw-dark-theme.zip` and set it as the active theme.
