# AI Local Site Generator

Generate a complete 30–50 page SEO-optimized local service website in minutes using AI.

## Quick Start

### 1. Prerequisites
- Node.js v18+ installed
- An OpenRouter API key (get one free at https://openrouter.ai)

### 2. Install
```bash
cd local-site-generator
npm install
```

### 3. Run
```bash
npm start
```

Then open: **http://localhost:3000**

---

## What Gets Generated

### Core Pages (6)
- Homepage (index.html)
- About Us
- Contact (with form)
- FAQ (10-15 questions)
- Privacy Policy
- Terms & Conditions

### Service Pages (up to 15)
One page per service you enter, e.g.:
- /services/roof-repair.html
- /services/gutter-installation.html

### Location Pages (up to 30)
One page per city you enter, e.g.:
- /locations/denver.html
- /locations/aurora.html
- /locations/lakewood.html

### SEO Files
- sitemap.xml
- robots.txt

---

## File Structure of Generated Site

```
/site
  index.html
  about.html
  contact.html
  faq.html
  privacy-policy.html
  terms-conditions.html
  sitemap.xml
  robots.txt
  /services/
    roof-repair.html
    roof-replacement.html
    ...
  /locations/
    denver.html
    aurora.html
    ...
  /assets/
    style.css
```

---

## SEO Features

- Schema.org LocalBusiness markup on every page
- FAQ schema on FAQ pages
- Optimized meta titles (50-60 chars)
- Meta descriptions (140-160 chars)
- Canonical URLs
- Internal linking between service/location pages
- Breadcrumb navigation
- Proper H1→H2→H3 heading hierarchy
- Sitemap.xml with priorities
- robots.txt

---

## Cost Estimate

Uses `openai/gpt-4o-mini` via OpenRouter.

- Small site (5 services, 5 locations) → ~$0.03–0.06
- Medium site (10 services, 15 locations) → ~$0.08–0.15
- Large site (15 services, 25 locations) → ~$0.15–0.25

---

## Deployment

1. Download the ZIP from the browser
2. Extract it
3. Upload all files to your web host (cPanel, FTP, Netlify, etc.)
4. No server required — pure HTML

---

## Customization

- Edit `/templates/assets/style.css` to change colors/fonts
- Edit templates in `/templates/` to change page structure
- The accent color is `#c0392b` (red) — change it globally in style.css

---

## Troubleshooting

**"Invalid API key"** → Check your OpenRouter key starts with `sk-or-v1-`

**Timeout errors** → Try with fewer locations/services first

**JSON parse errors** → Usually a flaky AI response — retry usually fixes it

---

## Tech Stack

- **Backend**: Node.js + Express
- **AI**: OpenRouter (GPT-4o-mini)
- **ZIP**: archiver
- **Progress**: Server-Sent Events (SSE)
- **Frontend**: Vanilla HTML/CSS/JS
