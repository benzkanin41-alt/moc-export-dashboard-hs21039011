# Thailand Export Dashboard: Chili Sauce HS 21039011

Static dashboard for Thailand export statistics of `HS 21039011 : ซอสพริก`, built from Thailand Trade Report data from the Ministry of Commerce (MOC).

## Online Dashboard

After GitHub Pages is enabled, the dashboard opens from the repository root:

```text
https://benzkanin41-alt.github.io/moc-export-dashboard-hs21039011/
```

## Data Scope

- Product: `ซอสพริก`
- HS code: `21039011`
- HS version: `2022`
- Source: Thailand's Trade Statistic, Ministry of Commerce
- Report URL: `https://tradereport.moc.go.th/th/stat/reporthscodeexport01`
- API endpoint: `https://tradereport.moc.go.th/stat/reporthscodeexport01/result`
- Coverage: `2021-01` to `2026-05`
- Latest source month: `พ.ค. 2569`
- Currency: THB
- Quantity unit: KGM according to MOC source

## Validation

The dataset was reconciled month by month between the world summary row and the sum of all country rows.

- Months fetched: `65`
- Country-month rows: `7,373`
- Max absolute value diff: `0`
- Max absolute quantity diff: `0`
- Missing continent mappings: none

Validation details are in `data/validation_reconciliation.csv`.

## Dashboard Features

- KPI cards for latest month, MoM, YoY, YTD value, and YTD quantity
- Monthly, quarterly, and yearly views
- Total, country, and continent filters
- Value and quantity metrics
- MoM, QoQ, and YoY growth views where applicable
- Clickable chart points with detail panels
- Sortable and exportable table
- Desktop and mobile responsive layout

## Files

- `index.html`, `styles.css`, `app.js`, `data.js`: static dashboard
- `data/dataset.json`: full processed dataset
- `data/monthly_country_hs21039011.csv`: monthly country-level data
- `data/monthly_continent_hs21039011.csv`: monthly continent-level data
- `data/monthly_total_hs21039011.csv`: monthly world total data
- `data/validation_reconciliation.csv`: reconciliation output
- `data/raw/*.json`: raw MOC API responses by month
- `tools/fetch_moc_hs21039011.py`: reproducible data fetcher
- `tools/qa_dashboard_cdp.js`: Edge CDP smoke test script
- `dashboard-hs21039011-desktop-smoke.png`: desktop QA screenshot
- `dashboard-hs21039011-mobile-smoke.png`: mobile QA screenshot

## Local Run

```powershell
python -m http.server 8777 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8777/
```

## QA Performed

- `node --check app.js`
- `curl http://127.0.0.1:8777/`
- Edge headless desktop smoke test at `1440x1200`
- Edge headless mobile smoke test at `390x1600`
- DOM checks for KPI cards, SVG charts, clickable chart points, table rows, source section, and mobile overflow
