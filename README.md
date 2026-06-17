# Router Monitoring Dashboard

A Google Apps Script (GAS) web application for real-time monitoring of CSR and BBU router status across network sites. Built on top of Google Sheets as a data backend, it provides a live dashboard with status summaries, alarm tracking, remark logging, and an embedded network topology diagram — deployable with zero infrastructure beyond a Google account.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Prerequisites](#prerequisites)
- [Setup & Deployment](#setup--deployment)
- [Configuration Placeholders](#configuration-placeholders)
- [Spreadsheet Schema](#spreadsheet-schema)
- [Usage Guide](#usage-guide)
- [Known Limitations](#known-limitations)
- [Changelog](#changelog)

---

## Project Overview

The Router Monitoring Dashboard is designed for NOC (Network Operations Center) staff to monitor the up/down status of CSR (Cell Site Router) and BBU (Baseband Unit) nodes across multiple sites — without requiring a dedicated server, database, or external hosting.

**Key capabilities:**

- Displays a rolling **1-hour status window** anchored to the latest data timestamp in the sheet
- Toggles between **CSR mode** and **BBU mode** to independently monitor both device types
- Shows a **donut chart** with interactive Up/Down breakdown, click-to-inspect
- Lists all **currently down sites** with timestamps, IPs, and editable NOC remarks
- Ranks the **Top 10 most frequently down sites** based on full historical data in the sheet
- Presents **alarm level and alarm type charts** from a dedicated alarms sheet
- Provides a **filterable alarm detail table** with per-column dropdown filters
- Embeds a **live draw.io network topology diagram** with a reload and open-in-browser button
- Supports **dark and light themes**, switchable without a page reload

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Google Apps Script Project              │
│                                                      │
│  code.gs         Backend logic                       │
│  ├─ doGet()      Serves index.html as a web app      │
│  ├─ dashboard()  Reads Data_Raw, returns status data │
│  ├─ getAlarms()  Reads Data_Alarms, returns alarm data│
│  ├─ getRemarksTable()   Reads Remarks sheet          │
│  └─ saveRemarksTable()  Writes back to Remarks sheet │
│                                                      │
│  index.html      Frontend (single-page)              │
│  ├─ Google Charts (donut + column charts)            │
│  ├─ Vanilla JS — no external JS frameworks           │
│  └─ CSS custom properties for dark/light theming     │
└─────────────────┬───────────────────────────────────┘
                  │  SpreadsheetApp API
                  ▼
┌─────────────────────────────────────────────────────┐
│              Google Sheets (Data Backend)            │
│                                                      │
│  Data_Raw     CSR / BBU status entries (manual)      │
│  Data_Alarms  Alarm event entries (manual)           │
│  Remarks      NOC remarks — auto-created if absent   │
└─────────────────────────────────────────────────────┘
                  │  iframe embed
                  ▼
┌─────────────────────────────────────────────────────┐
│         draw.io (app.diagrams.net)                  │
│         Network topology diagram (public URL)        │
└─────────────────────────────────────────────────────┘
```

**Data flow summary:**

1. NOC staff manually updates `Data_Raw` and `Data_Alarms` sheets with new entries.
2. The dashboard frontend calls `dashboard()` and `getAlarms()` via `google.script.run` on page load and on manual refresh.
3. The backend reads the latest 1-hour window of data and returns it as JSON to the frontend.
4. Charts, tables, and cards are rendered client-side in the browser.
5. When a NOC operator updates a remark, `saveRemarksTable()` writes the change back to the `Remarks` sheet.

---

## File Structure

```
project-root/
├── code.gs        Google Apps Script backend
├── index.html     Frontend web app (served by doGet())
└── README.md      This file
```

> In the Apps Script editor, `code.gs` and `index.html` are sibling files within the same script project. The `include()` helper in `code.gs` allows additional HTML partials to be injected if needed in future.

---

## Prerequisites

- A **Google account** with access to Google Sheets and Google Apps Script
- A **Google Sheets spreadsheet** with the three required sheets (see [Spreadsheet Schema](#spreadsheet-schema))
- A **draw.io diagram** published as a public embeddable URL via `app.diagrams.net`
- Logo and hero banner images hosted at publicly accessible URLs (Google Drive public links, CDN, or similar)

---

## Setup & Deployment

### Step 1 — Create the Google Sheets spreadsheet

Create a new Google Sheets file. Add the following sheets with exact names (case-sensitive):

| Sheet name    | Purpose                        |
|---------------|--------------------------------|
| `Data_Raw`    | CSR / BBU status entries       |
| `Data_Alarms` | Alarm event entries            |
| `Remarks`     | NOC remarks (auto-created if absent, but you can pre-create it) |

Populate the column headers exactly as defined in [Spreadsheet Schema](#spreadsheet-schema).

Copy the **Spreadsheet ID** from the URL:
```
https://docs.google.com/spreadsheets/d/  <SPREADSHEET_ID>  /edit
```

---

### Step 2 — Create the Apps Script project

1. In the spreadsheet, go to **Extensions → Apps Script**.
2. Delete any default content in `Code.gs`.
3. Paste the contents of `code.gs` into the editor and rename the file to `code.gs` if needed.
4. Click **＋ Add file → HTML**, name it `Index` (capital I — must match the `createTemplateFromFile('Index')` call in `doGet()`).
5. Paste the contents of `index.html` into the new HTML file.

---

### Step 3 — Fill in the configuration placeholders

In `code.gs`, update the `CONFIG` block at the top:

```js
const CONFIG = {
  SPREADSHEET_ID: 'INSERT YOUR SPREADSHEET ID HERE',  // ← paste your ID here
  RAW_SHEET:      'Data_Raw',
  REMARKS_SHEET:  'Remarks',
  ALARMS_SHEET:   'Data_Alarms',
  SESSION_HOURS:  1
};
```

In `index.html`, replace the following placeholders (search the file for `INSERT`):

| Placeholder                        | What to put there                                      |
|------------------------------------|--------------------------------------------------------|
| `INSERT_COMPANY_LOGO_HERE`         | Public URL of your company logo image (appears twice)  |
| `INSERT_HERO_BANNER_HERE`          | Public URL of the hero banner image                    |
| `INSERT YOUR DRAW IO IFRAMES HERE` | Full `src="..."` attribute for your draw.io embed URL  |
| `INSERT YOU DRAW IO URL HERE`      | Direct draw.io link for the "Open in draw.io" button   |

**Getting the draw.io embed URL:**
In `app.diagrams.net`, go to **Extras → Edit Diagram** or use **File → Publish → Link**. Copy the embed/share URL and place it as the `src` attribute of the `<iframe>` tag.

---

### Step 4 — Deploy as a web app

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Select type: **Web app**.
3. Set **Execute as**: `Me` (uses your Google account to read the sheet).
4. Set **Who has access**: choose appropriately for your team (e.g., `Anyone within [your org]` or `Anyone`).
5. Click **Deploy** and copy the web app URL.
6. Share the URL with NOC staff.

> **Note:** Access control for the dashboard is entirely managed through the GAS deployment settings above. There is no application-level login built into the dashboard itself.

---

### Step 5 — Verify sheet connectivity (optional)

In the Apps Script editor, run the `debugSheets()` function manually. It returns a list of all sheet names found in the spreadsheet. If `Data_Raw` or `Data_Alarms` are missing, the dashboard will throw an error on load.

---

## Configuration Placeholders

Quick reference of everything that needs to be replaced before deployment:

| File        | Location                         | Description                                  |
|-------------|----------------------------------|----------------------------------------------|
| `code.gs`   | `CONFIG.SPREADSHEET_ID`          | Google Sheets file ID                        |
| `index.html`| `src` of first `<img class="logo">`  | Company logo URL                         |
| `index.html`| `src` of `<img class="hero">`    | Hero banner URL                              |
| `index.html`| `src` of second `<img class="logo">` | Company logo URL (repeated in top bar)   |
| `index.html`| `<iframe>` inside `.diagram-embed`   | draw.io embed iframe `src` attribute     |
| `index.html`| `href` of "Open in draw.io" `<a>`    | draw.io direct URL                       |

---

## Spreadsheet Schema

All column headers are **case-insensitive** in the backend (normalized via `.toLowerCase()`), but the sheet names themselves are **case-sensitive**.

### `Data_Raw` sheet

Drives the CSR/BBU status cards, donut chart, Down Detail table, and Top 10 table.

| Column       | Type      | Description                                           |
|--------------|-----------|-------------------------------------------------------|
| `Timestamp`  | DateTime  | Date and time of the status reading                   |
| `Site_ID`    | String    | Unique identifier for the site                        |
| `City`       | String    | City or location name                                 |
| `CSR`        | String    | IP address of the CSR device                          |
| `BBU`        | String    | IP address of the BBU device                          |
| `Status CSR` | String    | Status of the CSR — must be `Up` or `Down` (any case) |
| `Status BBU` | String    | Status of the BBU — must be `Up` or `Down` (any case) |

> The 1-hour window is determined by finding the **latest timestamp in the entire sheet**, then taking all rows from `latest - 1 hour` to `latest`. This means the window does not move in real time — it only advances when new rows are added.

---

### `Data_Alarms` sheet

Drives the Alarm Level chart, Alarm Type chart, and the filterable Alarm Detail table.

| Column      | Type      | Description                                                   |
|-------------|-----------|---------------------------------------------------------------|
| `Timestamp` | DateTime  | When the alarm was recorded (used for the 1-hour window)      |
| `Hostname`  | String    | Router/device hostname                                        |
| `Host`      | String    | Host IP or identifier                                         |
| `ID`        | String    | Alarm ID                                                      |
| `Code`      | String    | Alarm code                                                    |
| `Level`     | String    | Severity — expected values: `alerts`, `warnings`, `emergencies`, `critical` |
| `Time`      | DateTime  | Alarm event time (displayed in table; separate from Timestamp) |
| `Module`    | String    | Module or subsystem that raised the alarm                     |
| `Detail`    | String    | Full alarm description text                                   |

> The `Level` field drives the color-coded Alarm Level chart. Values are matched in lowercase. Only the four levels listed above have assigned colors; any other value will still appear in the chart but with a fallback color.

---

### `Remarks` sheet

Stores NOC operator remarks linked to down events. **This sheet is auto-created** by the backend if it does not exist, with the correct headers.

| Column      | Type     | Description                                         |
|-------------|----------|-----------------------------------------------------|
| `Timestamp` | String   | Timestamp of the down event (from `Data_Raw`)       |
| `Site_ID`   | String   | Site identifier                                     |
| `City`      | String   | City name                                           |
| `IP`        | String   | IP address of the affected device                   |
| `Status`    | String   | Status value at time of remark (typically `Down`)   |
| `Remark`    | String   | Free-text remark entered by the NOC operator        |

> Remarks are keyed internally by a composite of `Timestamp || Site_ID || Status`. If the same site appears as Down in multiple consecutive windows, the remark from a previous save will be matched and displayed automatically.

---

## Usage Guide

### For NOC Operators

**Refreshing data**
Click the **Refresh Data** button in the toolbar to pull the latest entries from the spreadsheet. The dashboard does not auto-refresh — it must be triggered manually.

**Switching between CSR and BBU**
Click **Switch to BBU** (or **Switch to CSR**) to change the monitoring mode. This switches the donut chart, Down Detail table, and Top 10 table to reflect the selected device type. The alarm section is independent of this toggle.

**Reading the status cards**
- **Up** — number of sites reporting `Up` status in the current 1-hour window
- **Down** — number of sites reporting `Down` status in the current 1-hour window
- **Mode** — currently active mode (`CSR` or `BBU`)
- **Window** — fixed at 1 Hour (the time span of data shown)

**Reading the donut chart**
Click on the **Up** or **Down** slice to see a count and percentage breakdown in the panel below the chart.

**Updating remarks on down sites**
1. In the **Down Detail** panel, click **Update Remark**.
2. The Remark column becomes editable — type your note for each affected site.
3. Click **Save Remarks** to write all changes back to the spreadsheet.
4. Click **Cancel Remark Edit** to discard changes without saving.

**Filtering alarms**
In the **Alarm Detail** table, each column header contains a dropdown filter. Select a value to narrow the table to matching rows. Filters across multiple columns are applied simultaneously.

**Network topology**
The diagram is embedded from draw.io. Click **↻ Refresh Diagram** to force-reload the iframe (useful if the diagram was recently updated). Click **Open in draw.io** to open the full interactive diagram in a new tab.

**Switching themes**
Click the **☾ / ☀** button in the top-right of the toolbar to toggle between dark and light mode. Charts are redrawn automatically to match the active theme.

---

### For Developers / Maintainers

**Modifying the 1-hour window size**
The window duration is hardcoded in `code.gs` inside both `dashboard()` and `getAlarms()`:
```js
const start = new Date(end.getTime() - 3600 * 1000);  // 3600s = 1 hour
```
Change `3600` to your desired duration in seconds.

**Adding a new data column to Data_Raw**
Update the `headers.indexOf(...)` lookup block inside `dashboard()` in `code.gs`, then update `render()` and `renderDetail()` in `index.html` to display the new field.

**Debugging sheet name mismatches**
Run `debugSheets()` from the Apps Script editor. It returns an array of all sheet names as they exist in the spreadsheet. Compare against the `CONFIG` values.

**Re-deploying after code changes**
Go to **Deploy → Manage deployments → Edit (pencil icon) → Version: New version → Deploy**. The web app URL stays the same — users do not need a new link.

---

## Known Limitations

- **No auto-refresh.** The dashboard does not poll for new data automatically. NOC staff must click Refresh Data manually to see updates.

- **1-hour window is data-anchored, not clock-anchored.** The window is calculated from the latest timestamp found in the sheet, not from the current wall-clock time. If no new rows have been added recently, the window reflects older data without any warning.

- **No built-in authentication.** Access is controlled entirely through the GAS web app deployment settings (`Who has access`). Anyone with the deployment URL and the correct Google account access can view the dashboard.

- **Manual data entry.** Both `Data_Raw` and `Data_Alarms` are populated manually by NOC staff. There is no automated data pipeline or scheduled import built into this project. Data freshness depends entirely on how frequently staff updates the sheets.

- **Remarks are overwritten on each save.** `saveRemarksTable()` clears the entire `Remarks` sheet and rewrites it from the current Down Detail table. Remarks for sites that are no longer in the current 1-hour Down list will be lost on the next save.

- **draw.io diagram requires a public URL.** The embedded topology is fetched from `app.diagrams.net`. The diagram file must be publicly accessible; private or login-gated diagrams will not render.

- **Google Charts requires internet access.** The frontend loads Google Charts from `gstatic.com`. The dashboard will not render charts in offline or restricted-network environments.

- **No mobile optimization for tables.** The layout is responsive for viewport width, but large alarm tables and the topology diagram may be difficult to navigate on small screens.

---

## Changelog

### v1.0 — 2026-06
- Initial release
- CSR / BBU mode toggle with independent status tracking
- 1-hour rolling window based on latest sheet timestamp
- Status summary cards (Up, Down, Mode, Window)
- Interactive donut chart with click-to-inspect slice detail
- Down Detail table with inline NOC remark editing and save
- Top 10 Most Down Sites table
- Alarm Level column chart (alerts / warnings / emergencies / critical)
- Alarm Type column chart (by module, dynamic from sheet data)
- Filterable Alarm Detail table with per-column dropdowns
- Embedded draw.io network topology with refresh and open-in-browser buttons
- Dark / light theme toggle with chart re-render
- `Remarks` sheet auto-created if not present
- `debugSheets()` utility function for deployment troubleshooting

---

*Flavio Lemuel © 2026*
