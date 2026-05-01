'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const archiver = require('archiver');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many requests, please try again later.' } });
app.use('/generate-site', limiter);

// ─── Utilities ────────────────────────────────────────────────────────────────
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function sanitize(str) {
  return sanitizeHtml(String(str || ''), { allowedTags: [], allowedAttributes: {} }).trim();
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomCTA(businessName, phone, service, city) {
  const ctas = [
    `<div class="cta-box"><h2>Ready to Get Started?</h2><p>Contact ${businessName} today for your free ${service} consultation in ${city}. We're standing by to help!</p><a href="tel:${phone}" class="cta-btn">📞 Call ${phone}</a></div>`,
    `<div class="cta-box"><h2>Get Your Free Quote Today</h2><p>Don't wait — ${businessName} is the trusted name for ${service} in ${city}. Call now or fill out our contact form.</p><a href="tel:${phone}" class="cta-btn">Call Now: ${phone}</a></div>`,
    `<div class="cta-box"><h2>Why Wait? Contact Us Now</h2><p>Hundreds of ${city} homeowners trust ${businessName} for professional ${service} services. Join them today.</p><a href="/contact.html" class="cta-btn">Get a Free Estimate</a></div>`,
    `<div class="cta-box"><h2>Same-Day Service Available</h2><p>${businessName} proudly serves ${city} and surrounding areas. Call <strong>${phone}</strong> for fast, reliable ${service} service.</p><a href="tel:${phone}" class="cta-btn">📞 ${phone}</a></div>`,
  ];
  return randomItem(ctas);
}

// ─── Prompt Engine ────────────────────────────────────────────────────────────
function buildPrompt(type, data) {
  const { businessName, mainService, mainCity, state, country, services, phone, email, usp, yearsExp, tone, allLocations } = data;
  const toneMap = { Professional: 'professional and authoritative', Friendly: 'warm, friendly and approachable', Premium: 'luxurious, premium and exclusive' };
  const toneDesc = toneMap[tone] || 'professional';
  const locationList = allLocations.slice(0, 5).join(', ');

  const base = `You are writing SEO-optimized web copy for "${businessName}", a ${mainService} company based in ${mainCity}${state ? ', ' + state : ''}, ${country}.
Business details: Phone: ${phone} | Email: ${email} | Experience: ${yearsExp} years | Tone: ${toneDesc}
Key selling points: ${usp}
Services offered: ${services.join(', ')}
Also serves: ${locationList}`;

  const schema = `
Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "seoTitle": "string (50-60 chars)",
  "metaDescription": "string (140-160 chars)",
  "slug": "string (url-safe)",
  "h1": "string",
  "content": "string (500-1000 words of HTML paragraphs, h2s, h3s — NO outer html/body tags)",
  "faqSection": "string (HTML with 3-5 Q&A pairs using <dt>/<dd> tags)",
  "schemaType": "LocalBusiness"
}`;

  if (type === 'homepage') {
    return `${base}

Write the HOMEPAGE for this website. Focus on:
- Primary keyword: "${mainService} in ${mainCity}"
- Highlight all services with brief descriptions
- Emphasize trust signals (${yearsExp} years experience, local, reliable)
- Use ${toneDesc} tone
- Include benefit-focused intro, services overview, why choose us section
- FAQ about the business generally
${schema}`;
  }

  if (type === 'about') {
    return `${base}

Write the ABOUT US page. Focus on:
- Company history and ${yearsExp} years of experience
- Mission, values, team culture
- Why they chose this trade/service
- Local community involvement in ${mainCity}
- Build trust and emotional connection
- Tone: ${toneDesc}
${schema}`;
  }

  if (type === 'contact') {
    return `${base}

Write the CONTACT page. Focus on:
- Clear call-to-action to call ${phone} or email ${email}
- Service area: ${mainCity} and ${locationList}
- What to expect when contacting
- Response time expectations
- Tone: ${toneDesc}
${schema}`;
  }

  if (type === 'faq') {
    return `${base}

Write a comprehensive FAQ page with 10-15 questions covering:
- Service process and what to expect
- Pricing (general guidance, not specific numbers)
- Service areas (mention ${mainCity} and nearby areas)
- Credentials and experience
- Scheduling and availability
- Common problems solved
Tone: ${toneDesc}
${schema}`;
  }

  if (type === 'privacy') {
    return `Write a standard Privacy Policy page for "${businessName}" (${mainService} company, ${mainCity}, ${country}).
Email: ${email} | Phone: ${phone}
Cover: data collection, cookies, third-party sharing, user rights, contact info.
Return ONLY valid JSON:
{
  "seoTitle": "Privacy Policy | ${businessName}",
  "metaDescription": "string",
  "slug": "privacy-policy",
  "h1": "Privacy Policy",
  "content": "string (complete HTML privacy policy)",
  "faqSection": "",
  "schemaType": "WebPage"
}`;
  }

  if (type === 'terms') {
    return `Write standard Terms & Conditions for "${businessName}" (${mainService} company, ${mainCity}, ${country}).
Email: ${email}
Cover: use of services, liability, warranties, governing law, contact.
Return ONLY valid JSON:
{
  "seoTitle": "Terms & Conditions | ${businessName}",
  "metaDescription": "string",
  "slug": "terms-conditions",
  "h1": "Terms & Conditions",
  "content": "string (complete HTML T&C)",
  "faqSection": "",
  "schemaType": "WebPage"
}`;
  }

  if (type === 'service') {
    const { service } = data;
    return `${base}

Write a SERVICE PAGE for: "${service}"
- Primary keyword: "${service} in ${mainCity}"
- Secondary keywords: "${service} near me", "${service} ${state || country}"
- 600-900 word in-depth page explaining:
  * What ${service} involves
  * When customers need it
  * The process ${businessName} follows
  * Benefits of choosing ${businessName} for ${service}
  * Specific to ${mainCity} context (weather, local building codes if relevant, etc.)
- Include H2s and H3s
- Tone: ${toneDesc}
- FAQ: 3-5 questions specific to ${service}
${schema}`;
  }

  if (type === 'location') {
    const { location } = data;
    return `${base}

Write a LOCATION PAGE targeting: "${location}"
- Primary keyword: "${mainService} in ${location}"
- This page targets customers in ${location} looking for ${mainService} services
- Mention proximity to ${mainCity} if relevant
- Discuss serving the ${location} community specifically
- Mention 2-3 specific services available in ${location}
- Local trust signals
- 500-700 words
- Tone: ${toneDesc}
- FAQ: 3 questions about service in ${location}
${schema}`;
  }

  return `${base}\nWrite content for a page of type: ${type}.\n${schema}`;
}

// ─── AI Call with Retry ───────────────────────────────────────────────────────
async function callAI(prompt, apiKey, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'openai/gpt-4o-mini',
          max_tokens: 2000,
          temperature: 0.8,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://local-site-generator.app',
            'X-Title': 'Local Site Generator',
          },
          timeout: 60000,
        }
      );
      const raw = response.data.choices[0].message.content.trim();
      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

// ─── Template Engine ──────────────────────────────────────────────────────────
function loadTemplate(name) {
  const tplPath = path.join(__dirname, 'templates', `${name}.html`);
  return fs.readFileSync(tplPath, 'utf8');
}

function renderTemplate(tplName, vars) {
  let html = loadTemplate(tplName);
  Object.entries(vars).forEach(([key, val]) => {
    html = html.split(`{{${key}}}`).join(val || '');
  });
  return html;
}

// ─── Schema Markup ────────────────────────────────────────────────────────────
function localBusinessSchema(data) {
  const { businessName, mainService, mainCity, state, country, phone, email } = data;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: businessName,
    description: `Professional ${mainService} services in ${mainCity}`,
    telephone: phone,
    email: email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: mainCity,
      addressRegion: state || '',
      addressCountry: country,
    },
    url: '/',
  }, null, 2);
}

function faqSchema(faqHtml) {
  const items = [];
  const regex = /<dt>(.*?)<\/dt>\s*<dd>(.*?)<\/dd>/gs;
  let match;
  while ((match = regex.exec(faqHtml)) !== null) {
    items.push({
      '@type': 'Question',
      name: match[1].replace(/<[^>]+>/g, '').trim(),
      acceptedAnswer: { '@type': 'Answer', text: match[2].replace(/<[^>]+>/g, '').trim() },
    });
  }
  if (!items.length) return '';
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items }, null, 2);
}

// ─── Nav & Footer Builder ─────────────────────────────────────────────────────
function buildNav(services, locations, mainCity) {
  const serviceLinks = services.slice(0, 6).map(s => `<li><a href="/services/${slugify(s)}.html">${s}</a></li>`).join('');
  const locationLinks = locations.slice(0, 6).map(l => `<li><a href="/locations/${slugify(l)}.html">${l}</a></li>`).join('');
  return `<nav class="main-nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">HOME</a>
    <div class="nav-links">
      <div class="nav-group">
        <span class="nav-label">Services ▾</span>
        <ul class="nav-dropdown">${serviceLinks}</ul>
      </div>
      <div class="nav-group">
        <span class="nav-label">Locations ▾</span>
        <ul class="nav-dropdown">${locationLinks}<li><a href="/locations/${slugify(mainCity)}.html">${mainCity}</a></li></ul>
      </div>
      <a href="/about.html">About</a>
      <a href="/faq.html">FAQ</a>
      <a href="/contact.html">Contact</a>
    </div>
  </div>
</nav>`;
}

function buildFooter(data, services, locations) {
  const { businessName, phone, email, mainCity, state, country } = data;
  const sLinks = services.slice(0, 8).map(s => `<li><a href="/services/${slugify(s)}.html">${s}</a></li>`).join('');
  const lLinks = locations.slice(0, 8).map(l => `<li><a href="/locations/${slugify(l)}.html">${l}</a></li>`).join('');
  return `<footer class="site-footer">
  <div class="footer-grid">
    <div class="footer-col">
      <h3>${businessName}</h3>
      <p>${mainCity}${state ? ', ' + state : ''}, ${country}</p>
      <p><a href="tel:${phone}">${phone}</a></p>
      <p><a href="mailto:${email}">${email}</a></p>
    </div>
    <div class="footer-col">
      <h3>Our Services</h3>
      <ul>${sLinks}</ul>
    </div>
    <div class="footer-col">
      <h3>Areas We Serve</h3>
      <ul>${lLinks}</ul>
    </div>
    <div class="footer-col">
      <h3>Quick Links</h3>
      <ul>
        <li><a href="/about.html">About Us</a></li>
        <li><a href="/faq.html">FAQ</a></li>
        <li><a href="/contact.html">Contact</a></li>
        <li><a href="/privacy-policy.html">Privacy Policy</a></li>
        <li><a href="/terms-conditions.html">Terms & Conditions</a></li>
        <li><a href="/sitemap.xml">Sitemap</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <p>© ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
  </div>
</footer>`;
}

function buildBreadcrumb(crumbs) {
  const items = crumbs.map((c, i) =>
    i < crumbs.length - 1
      ? `<li><a href="${c.url}">${c.label}</a></li>`
      : `<li class="active">${c.label}</li>`
  ).join('<li class="sep">›</li>');
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${items}</ol></nav>`;
}

// ─── Sitemap & Robots ─────────────────────────────────────────────────────────
function buildSitemap(pages, baseUrl = 'https://yourwebsite.com') {
  const urls = pages.map(p => `  <url>
    <loc>${baseUrl}/${p.slug}.html</loc>
    <changefreq>monthly</changefreq>
    <priority>${p.priority || '0.7'}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function buildRobots(baseUrl = 'https://yourwebsite.com') {
  return `User-agent: *\nAllow: /\nDisallow: /assets/\nSitemap: ${baseUrl}/sitemap.xml\n`;
}

// ─── Page File Writer ─────────────────────────────────────────────────────────
async function writePage(outDir, relativePath, aiData, tplName, extraVars) {
  const faqHtml = aiData.faqSection
    ? `<section class="faq-section"><h2>Frequently Asked Questions</h2><dl>${aiData.faqSection}</dl></section>`
    : '';
  const faqSchemaTag = aiData.faqSection
    ? `<script type="application/ld+json">${faqSchema(aiData.faqSection)}</script>`
    : '';

  const html = renderTemplate(tplName, {
    seoTitle: aiData.seoTitle,
    metaDescription: aiData.metaDescription,
    h1: aiData.h1,
    content: aiData.content,
    faqSection: faqHtml,
    faqSchema: faqSchemaTag,
    ...extraVars,
  });

  const filePath = path.join(outDir, relativePath);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, html, 'utf8');
}

// ─── Main Generator ───────────────────────────────────────────────────────────
async function generateSite(inputData, apiKey, progressCb) {
  const jobId = uuidv4();
  const outDir = path.join(__dirname, 'temp', jobId, 'site');
  await fs.ensureDir(path.join(outDir, 'services'));
  await fs.ensureDir(path.join(outDir, 'locations'));
  await fs.ensureDir(path.join(outDir, 'assets'));

  // Copy assets
  const assetsDir = path.join(__dirname, 'templates', 'assets');
  if (await fs.pathExists(assetsDir)) {
    await fs.copy(assetsDir, path.join(outDir, 'assets'));
  }

  // Prepare data
  const services = inputData.services.filter(Boolean).slice(0, 15);
  const extraLocations = inputData.additionalLocations.filter(Boolean);
  const allLocations = [inputData.mainCity, ...extraLocations].filter((v, i, a) => a.indexOf(v) === i).slice(0, 30);

  const data = {
    ...inputData,
    services,
    allLocations,
  };

  const nav = buildNav(services, allLocations, data.mainCity);
  const footer = buildFooter(data, services, allLocations);
  const lbSchema = `<script type="application/ld+json">${localBusinessSchema(data)}</script>`;

  const commonVars = {
    nav,
    footer,
    businessName: data.businessName,
    phone: data.phone,
    email: data.email,
    mainCity: data.mainCity,
    mainService: data.mainService,
    lbSchema,
  };

  const sitemapPages = [];
  let total = 6 + services.length + allLocations.length;
  let done = 0;
  const tick = (label) => { done++; progressCb({ done, total, label }); };

  // ── Core Pages ──
  const corePages = ['homepage', 'about', 'contact', 'faq', 'privacy', 'terms'];
  const coreFileMap = {
    homepage: 'index.html',
    about: 'about.html',
    contact: 'contact.html',
    faq: 'faq.html',
    privacy: 'privacy-policy.html',
    terms: 'terms-conditions.html',
  };
  const coreTplMap = {
    homepage: 'homepage',
    about: 'standard',
    contact: 'contact',
    faq: 'standard',
    privacy: 'standard',
    terms: 'standard',
  };
  const corePriority = { homepage: '1.0', about: '0.8', contact: '0.9', faq: '0.7', privacy: '0.4', terms: '0.4' };

  for (const pageType of corePages) {
    const aiData = await callAI(buildPrompt(pageType, data), apiKey);
    const breadcrumb = pageType === 'homepage' ? '' : buildBreadcrumb([{ label: 'Home', url: '/' }, { label: aiData.h1 }]);
    const cta = pageType !== 'privacy' && pageType !== 'terms'
      ? randomCTA(data.businessName, data.phone, data.mainService, data.mainCity)
      : '';

    await writePage(outDir, coreFileMap[pageType], aiData, coreTplMap[pageType], {
      ...commonVars,
      breadcrumb,
      cta,
      city: data.mainCity,
      service: data.mainService,
    });

    sitemapPages.push({ slug: coreFileMap[pageType].replace('.html', '').replace('index', ''), priority: corePriority[pageType] });
    tick(`Generated: ${pageType}`);
  }

  // ── Service Pages ──
  for (const service of services) {
    const aiData = await callAI(buildPrompt('service', { ...data, service }), apiKey);
    const slug = `services/${slugify(service)}`;
    const breadcrumb = buildBreadcrumb([{ label: 'Home', url: '/' }, { label: 'Services', url: '#' }, { label: service }]);
    const cta = randomCTA(data.businessName, data.phone, service, data.mainCity);

    // Internal links to other services
    const relatedLinks = services
      .filter(s => s !== service)
      .slice(0, 5)
      .map(s => `<li><a href="/services/${slugify(s)}.html">${s} in ${data.mainCity}</a></li>`)
      .join('');
    const internalLinks = `<section class="internal-links"><h3>Related Services</h3><ul>${relatedLinks}</ul></section>`;

    await writePage(outDir, `${slug}.html`, aiData, 'service', {
      ...commonVars,
      breadcrumb,
      cta,
      internalLinks,
      city: data.mainCity,
      service,
    });

    sitemapPages.push({ slug, priority: '0.8' });
    tick(`Generated service: ${service}`);
  }

  // ── Location Pages ──
  for (const location of allLocations) {
    const aiData = await callAI(buildPrompt('location', { ...data, location }), apiKey);
    const slug = `locations/${slugify(location)}`;
    const breadcrumb = buildBreadcrumb([{ label: 'Home', url: '/' }, { label: 'Locations', url: '#' }, { label: location }]);
    const cta = randomCTA(data.businessName, data.phone, data.mainService, location);

    // Links back to main city + services
    const cityLink = location !== data.mainCity
      ? `<p>Serving <a href="/locations/${slugify(data.mainCity)}.html">${data.mainCity}</a> and surrounding areas.</p>`
      : '';
    const serviceLinks2 = services.slice(0, 5).map(s =>
      `<li><a href="/services/${slugify(s)}.html">${s} in ${location}</a></li>`
    ).join('');
    const internalLinks = `<section class="internal-links">${cityLink}<h3>Our Services in ${location}</h3><ul>${serviceLinks2}</ul></section>`;

    await writePage(outDir, `${slug}.html`, aiData, 'location', {
      ...commonVars,
      breadcrumb,
      cta,
      internalLinks,
      city: location,
      service: data.mainService,
    });

    sitemapPages.push({ slug, priority: '0.7' });
    tick(`Generated location: ${location}`);
  }

  // ── Sitemap & Robots ──
  await fs.writeFile(path.join(outDir, 'sitemap.xml'), buildSitemap(sitemapPages), 'utf8');
  await fs.writeFile(path.join(outDir, 'robots.txt'), buildRobots(), 'utf8');

  // ── ZIP ──
  const zipPath = path.join(__dirname, 'temp', jobId, `${slugify(data.businessName)}-website.zip`);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(outDir, false);
    archive.finalize();
  });

  return { zipPath, jobId };
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateInput(body) {
  const required = ['businessName', 'mainService', 'mainCity', 'country', 'phone', 'email', 'apiKey'];
  for (const field of required) {
    if (!body[field] || !String(body[field]).trim()) {
      return `Missing required field: ${field}`;
    }
  }
  if (!/\S+@\S+\.\S+/.test(body.email)) return 'Invalid email address';
  return null;
}

// ─── SSE Progress Tracker ─────────────────────────────────────────────────────
const progressMap = new Map();

app.get('/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  progressMap.set(jobId, send);
  req.on('close', () => progressMap.delete(jobId));
});

// ─── Generate Endpoint ────────────────────────────────────────────────────────
app.post('/generate-site', async (req, res) => {
  const err = validateInput(req.body);
  if (err) return res.status(400).json({ error: err });

  const {
    businessName, mainService, mainCity, state = '', country,
    additionalLocations = '', services: servicesRaw = '',
    phone, email, usp = '', yearsExp = '5', tone = 'Professional',
    apiKey,
  } = req.body;

  const inputData = {
    businessName: sanitize(businessName),
    mainService: sanitize(mainService),
    mainCity: sanitize(mainCity),
    state: sanitize(state),
    country: sanitize(country),
    additionalLocations: additionalLocations.split(',').map(s => sanitize(s)).filter(Boolean),
    services: servicesRaw.split(',').map(s => sanitize(s)).filter(Boolean),
    phone: sanitize(phone),
    email: sanitize(email),
    usp: sanitize(usp),
    yearsExp: sanitize(yearsExp),
    tone: ['Professional', 'Friendly', 'Premium'].includes(tone) ? tone : 'Professional',
  };

  const jobId = uuidv4();
  res.json({ jobId });

  // Run in background
  setImmediate(async () => {
    const sendProgress = progressMap.get(jobId);
    try {
      const progressCb = ({ done, total, label }) => {
        const sender = progressMap.get(jobId);
        if (sender) sender({ done, total, label, status: 'generating' });
      };

      const { zipPath } = await generateSite(inputData, apiKey, progressCb);

      const sender = progressMap.get(jobId);
      if (sender) sender({ status: 'done', downloadUrl: `/download/${jobId}` });

      // Store zip path for download
      progressMap.set(`zip_${jobId}`, zipPath);

      // Auto-cleanup after 30 minutes
      setTimeout(async () => {
        await fs.remove(path.join(__dirname, 'temp', jobId));
        progressMap.delete(`zip_${jobId}`);
      }, 30 * 60 * 1000);

    } catch (genErr) {
      console.error('Generation error:', genErr);
      const sender = progressMap.get(jobId);
      if (sender) sender({ status: 'error', error: genErr.message || 'Generation failed' });
    }
  });
});

// ─── Download Endpoint ────────────────────────────────────────────────────────
app.get('/download/:jobId', (req, res) => {
  const zipPath = progressMap.get(`zip_${req.params.jobId}`);
  if (!zipPath || !fs.existsSync(zipPath)) {
    return res.status(404).json({ error: 'File not found or expired' });
  }
  res.download(zipPath);
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Local Site Generator running at http://localhost:${PORT}\n`);
  fs.ensureDir(path.join(__dirname, 'temp'));
});
