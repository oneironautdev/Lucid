/**
 * config-runtime.js
 * Reads SITE_CONFIG (from site-config.js) and applies it to the page.
 * This file should not need editing.
 */
(function () {
  'use strict';
  const C = window.SITE_CONFIG;
  if (!C) { console.warn('SITE_CONFIG not found — did site-config.js load?'); return; }

  /* ── tiny helpers ─────────────────────────────────────── */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const set = (el, html) => { if (el) el.innerHTML = html; };
  const setText = (el, txt) => { if (el) el.textContent = txt; };
  const setAttr = (el, attr, val) => { if (el) el.setAttribute(attr, val); };
  const svgIcons = {
    download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    github:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
    email:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    coffee:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  };
  const faqPlusSvg = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/></svg>`;
  const trustSvgs = {
    shield: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    github: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>`,
  };

  /* ── meta ─────────────────────────────────────────────── */
  document.title = C.meta.title;
  const themeMeta = $('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = C.meta.themeColor;

  /* ── images (all occurrences of the icon) ─────────────── */
  $$('img.nav-logo-icon').forEach(img => { img.src = C.images.appIcon; });
  const heroIconImg = $('.hero-icon-wrap img');
  if (heroIconImg) heroIconImg.src = C.images.appIcon;

  const screenshotKeys = ['screenshotHome','screenshotJournal','screenshotAnalytics','screenshotReality','screenshotWidget'];
  $$('.phone-img').forEach((img, i) => {
    if (screenshotKeys[i]) img.src = C.images[screenshotKeys[i]];
  });

  /* ── nav ──────────────────────────────────────────────── */
  const navLogoText = $('.nav-logo');
  if (navLogoText) {
    // Replace the text node after the img
    const img = navLogoText.querySelector('img');
    navLogoText.innerHTML = '';
    if (img) navLogoText.appendChild(img);
    navLogoText.appendChild(document.createTextNode(' ' + C.nav.appName));
  }

  const navLinksList = $('.nav-links');
  if (navLinksList && C.nav.links.length) {
    navLinksList.innerHTML = C.nav.links
      .map(l => `<li><a href="${l.anchor}">${l.label}</a></li>`)
      .join('');
  }

  const navActions = $('.nav-actions');
  if (navActions) {
    const [supportBtn, downloadBtn] = $$('a', navActions);
    if (supportBtn) {
      supportBtn.href = C.links.buyMeCoffee;
      const supportSpan = supportBtn.querySelector('svg') ? supportBtn : null;
      // keep svg, update text node
      const svgEl = supportBtn.querySelector('svg');
      supportBtn.innerHTML = '';
      if (svgEl) supportBtn.appendChild(svgEl);
      supportBtn.appendChild(document.createTextNode(C.nav.ctaSupport));
    }
    if (downloadBtn) {
      downloadBtn.href = C.links.downloadApk;
      const svgEl = downloadBtn.querySelector('svg');
      downloadBtn.innerHTML = '';
      if (svgEl) downloadBtn.appendChild(svgEl);
      downloadBtn.appendChild(document.createTextNode(C.nav.ctaDownload));
    }
  }

  /* ── hero ─────────────────────────────────────────────── */
  const heroBadge = $('.hero-badge');
  if (heroBadge) {
    const dot = heroBadge.querySelector('.hero-badge-dot');
    heroBadge.innerHTML = '';
    if (dot) heroBadge.appendChild(dot);
    heroBadge.appendChild(document.createTextNode(' ' + C.hero.badge));
  }

  const heroAppName = $('.hero-app-name');
  if (heroAppName) heroAppName.textContent = C.hero.appName;

  const heroTagline = $('.hero-tagline');
  if (heroTagline) {
    const lines = C.hero.tagline.split('\n');
    heroTagline.innerHTML = lines.map((line, i) => {
      const accentMatch = line.match(/^\[(.+)\]$/);
      if (accentMatch) return `<span class="accent">${accentMatch[1]}</span>`;
      return line + (i < lines.length - 1 ? '<br>' : '');
    }).join('\n');
  }

  const heroSub = $('.hero-sub');
  if (heroSub) heroSub.textContent = C.hero.subtext;

  const heroActions = $('.hero-actions');
  if (heroActions) {
    const [primaryA, coffeeA, ghostA] = $$('a', heroActions);
    if (primaryA) { primaryA.href = C.links.downloadApk; const s=primaryA.querySelector('svg'); primaryA.innerHTML=''; if(s) primaryA.appendChild(s); primaryA.appendChild(document.createTextNode(' '+C.hero.ctaPrimary)); }
    if (coffeeA)  { coffeeA.href  = C.links.buyMeCoffee; const s=coffeeA.querySelector('svg');  coffeeA.innerHTML='';  if(s) coffeeA.appendChild(s);  coffeeA.appendChild(document.createTextNode(' '+C.hero.ctaSupport));   }
    if (ghostA)   { ghostA.textContent = C.hero.ctaSecondary; }
  }

  const heroTrust = $('.hero-trust');
  if (heroTrust && C.hero.trustItems.length) {
    const icons = [trustSvgs.shield, trustSvgs.shield, trustSvgs.github];
    heroTrust.innerHTML = C.hero.trustItems.map((item, i) =>
      (i > 0 ? '<div class="hero-trust-sep"></div>' : '') +
      `<div class="hero-trust-item">${icons[i] || icons[0]} ${item}</div>`
    ).join('');
  }

  /* ── about ────────────────────────────────────────────── */
  const aboutLabel = $('.about-section .section-label');
  if (aboutLabel) { const dot=aboutLabel.querySelector('.label-dot'); aboutLabel.innerHTML=''; if(dot) aboutLabel.appendChild(dot); aboutLabel.appendChild(document.createTextNode(' '+C.about.sectionLabel)); }

  const aboutHeading = $('.about-heading');
  if (aboutHeading) aboutHeading.innerHTML = C.about.heading.split('\n').join('<br>');

  const aboutBody = $('.about-body');
  if (aboutBody) aboutBody.textContent = C.about.body;

  const aboutChips = $('.about-chips');
  if (aboutChips) aboutChips.innerHTML = C.about.chips.map(c => `<span class="chip">${c}</span>`).join('');

  /* ── showcase ─────────────────────────────────────────── */
  // Both the desktop and mobile intro headings
  $$('.app-scroll-heading').forEach(el => { el.textContent = C.showcase.heading; });
  $$('.app-scroll-sub').forEach(el => { el.textContent = C.showcase.subtext; });
  $$('.app-section .section-label').forEach(el => {
    const dot = el.querySelector('.label-dot');
    el.innerHTML = '';
    if (dot) el.appendChild(dot);
    el.appendChild(document.createTextNode(' ' + C.showcase.sectionLabel));
  });

  const panels = $$('.slide-panel');
  panels.forEach((panel, i) => {
    const p = C.showcase.panels[i];
    if (!p) return;
    const tag   = panel.querySelector('.slide-tag');
    const title = panel.querySelector('.slide-title');
    const body  = panel.querySelector('.slide-body');
    if (tag)   tag.textContent   = p.tag;
    if (title) title.textContent = p.title;
    if (body)  body.textContent  = p.body;
  });

  /* ── roadmap ──────────────────────────────────────────── */
  const nextLabel = $('.next-section .section-label');
  if (nextLabel) { const dot=nextLabel.querySelector('.label-dot'); nextLabel.innerHTML=''; if(dot) nextLabel.appendChild(dot); nextLabel.appendChild(document.createTextNode(' '+C.roadmap.sectionLabel)); }

  const nextHeading = $('.next-heading');
  if (nextHeading) nextHeading.textContent = C.roadmap.heading;

  const nextSub = $('.next-sub');
  if (nextSub) nextSub.textContent = C.roadmap.subtext;

  // Patch text inside existing real cards (carousel has already cloned them — don't replace)
  $$('.next-card[data-real]').forEach((card, i) => {
    const p = C.roadmap.cards[i];
    if (!p) return;
    const num   = card.querySelector('.next-card-num');
    const title = card.querySelector('.next-card-title');
    const body  = card.querySelector('.next-card-body');
    if (num)   num.textContent   = p.num;
    if (title) title.textContent = p.title;
    if (body)  body.textContent  = p.body;
  });

  // Sync the same text into cloned cards (carousel clones don't have data-real)
  const realCards = $$('.next-card[data-real]');
  $$('.next-card:not([data-real])').forEach(clone => {
    // Match clone to its source card by position within the repeating set
    const cloneTitle = clone.querySelector('.next-card-title');
    if (!cloneTitle) return;
    // Find which real card this clone corresponds to by matching original title text
    // (clones are made before runtime runs, so they still have the old HTML title)
    // Instead match by index within the repeated pattern
    const allClones = $$('.next-card:not([data-real])');
    const cloneIndex = allClones.indexOf(clone) % realCards.length;
    const p = C.roadmap.cards[cloneIndex];
    if (!p) return;
    const num  = clone.querySelector('.next-card-num');
    const body = clone.querySelector('.next-card-body');
    if (num)       num.textContent       = p.num;
    if (cloneTitle) cloneTitle.textContent = p.title;
    if (body)      body.textContent      = p.body;
  });

  /* ── roadmap: further out ─────────────────────────────── */
  if (C.roadmap.maybeNeverCards) {
    const maybeLabel = $('.maybe-section-label');
    if (maybeLabel) { const dot = maybeLabel.querySelector('.maybe-section-label-dot'); maybeLabel.innerHTML = ''; if (dot) maybeLabel.appendChild(dot); maybeLabel.appendChild(document.createTextNode(' ' + C.roadmap.maybeNeverLabel)); }
    const maybeHeading = $('.maybe-section-heading');
    if (maybeHeading) maybeHeading.textContent = C.roadmap.maybeNeverHeading;
    const maybeSub = $('.maybe-section-sub');
    if (maybeSub) maybeSub.textContent = C.roadmap.maybeNeverSubtext;
    const maybeGrid = document.getElementById('maybeGrid');
    if (maybeGrid) {
      maybeGrid.innerHTML = C.roadmap.maybeNeverCards.map(card => `
        <div class="maybe-card">
          <div class="maybe-card-title">${card.title}</div>
          <div class="maybe-card-body">${card.body}</div>
        </div>
      `).join('');
    }
  }

  /* ── faq ──────────────────────────────────────────────── */
  const faqLabel = $('.faq-section .section-label');
  if (faqLabel) { const dot=faqLabel.querySelector('.label-dot'); faqLabel.innerHTML=''; if(dot) faqLabel.appendChild(dot); faqLabel.appendChild(document.createTextNode(' '+C.faq.sectionLabel)); }

  const faqHeading = $('.faq-heading');
  if (faqHeading) faqHeading.textContent = C.faq.heading;

  const faqList = $('.faq-list');
  if (faqList) {
    // Rebuild FAQ items from config
    faqList.innerHTML = C.faq.items.map(item => `
      <div class="faq-item">
        <div class="faq-q">
          ${item.q}
          <span class="faq-icon">${faqPlusSvg}</span>
        </div>
        <div class="faq-a-wrap"><div class="faq-a-inner"><p class="faq-a">${item.a}</p></div></div>
      </div>
    `).join('');
  }

  /* ── footer ───────────────────────────────────────────── */
  const footerLogo = $('.footer-logo');
  if (footerLogo) {
    const img = footerLogo.querySelector('img');
    if (img) img.src = C.images.appIcon;
    const textNode = [...footerLogo.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (textNode) textNode.textContent = '\n        ' + C.footer.appName + '\n      ';
    else footerLogo.appendChild(document.createTextNode('\n        ' + C.footer.appName + '\n      '));
  }

  const footerLinks = $('.footer-links');
  if (footerLinks) {
    footerLinks.innerHTML = C.footer.links.map(link => {
      const href = link.key === 'contactEmail' ? C.links[link.key] : C.links[link.key];
      const target = link.key === 'contactEmail' ? '' : ' target="_blank"';
      const extraClass = link.icon === 'coffee' ? ' coffee' : '';
      return `<a href="${href}" class="footer-link${extraClass}"${target}>${svgIcons[link.icon] || ''} ${link.label}</a>`;
    }).join('\n');
  }

  const footerCopy = $('.footer-copy');
  if (footerCopy) footerCopy.textContent = C.footer.copyright;

})();