/* NETFORGE — Website Intelligence Dashboard */
(function(){
  const WI_HIST_KEY = 'nf-wi-history-v1';
  const WI_WATCH_KEY = 'nf-wi-watchlist-v1';
  let wiState = { data: null, tab: 'overview', compare: [] };

  function isPrivateHost(host){
    if(!host) return true;
    const h = host.toLowerCase();
    if(h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')) return true;
    if(/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
    const m = h.match(/^172\.(\d+)\./);
    if(m && +m[1] >= 16 && +m[1] <= 31) return true;
    return false;
  }

  function badge(type){
    const map = {
      measured: ['Mért adat', 'ok'],
      public: ['Nyilvános adat', 'ok'],
      estimated: ['Becslés', 'warn'],
      unavailable: ['Nem elérhető', 'err']
    };
    const [label, cls] = map[type] || map.unavailable;
    return `<span class="nf-res-badge ${cls}" style="font-size:9px;padding:2px 6px">${label}</span>`;
  }

  function kv(label, val, quality='measured'){
    return `<div><span>${esc(label)} ${badge(quality)}</span><strong>${esc(val ?? '—')}</strong></div>`;
  }

  async function fetchHtml(url){
    const t0 = performance.now();
    try{
      const r = await fetch(url, { mode: 'cors', cache: 'no-store', signal: AbortSignal.timeout(7000) });
      const ms = Math.round(performance.now() - t0);
      const html = await r.text();
      return { html, status: r.status, ms, headers: Object.fromEntries(r.headers.entries()), via: 'direct' };
    }catch{}
    for(const [name, proxy] of [
      ['allorigins', `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`],
      ['codetabs', `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`]
    ]){
      try{
        const r = await fetch(proxy, { cache: 'no-store', signal: AbortSignal.timeout(9000) });
        const ms = Math.round(performance.now() - t0);
        if(r.ok){
          const html = await r.text();
          return { html, status: r.status, ms, headers: {}, via: name };
        }
      }catch{}
    }
    try{
      await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(7000) });
      return { html: '', status: 'Reachable (CORS)', ms: Math.round(performance.now() - t0), headers: {}, via: 'no-cors (HTML blocked)' };
    }catch{
      return { html: '', status: 'Unreachable', ms: Math.round(performance.now() - t0), headers: {}, via: 'failed' };
    }
  }

  function detectTech(html, headers){
    const found = [];
    const add = (name, conf, cat) => found.push({ name, confidence: conf, category: cat });
    const h = html.toLowerCase();
    const srv = (headers['server'] || '').toLowerCase();
    if(h.includes('wp-content') || h.includes('wp-includes')) add('WordPress', '95%', 'CMS');
    if(h.includes('cdn.shopify.com') || h.includes('shopify.theme')) add('Shopify', '95%', 'E-commerce');
    if(h.includes('wixstatic.com')) add('Wix', '90%', 'CMS');
    if(h.includes('webflow.js') || h.includes('data-wf-site')) add('Webflow', '90%', 'CMS');
    if(h.includes('__next_data__') || h.includes('/_next/')) add('Next.js', '95%', 'Framework');
    else if(h.includes('data-reactroot') || h.includes('react')) add('React', '75%', 'Framework');
    if(h.includes('__nuxt') || h.includes('data-v-')) add('Vue / Nuxt', '80%', 'Framework');
    if(h.includes('ng-version')) add('Angular', '90%', 'Framework');
    if(h.includes('tailwindcss') || /class="[^"]*\b(flex|grid|px-\d|py-\d|bg-)\b/.test(html)) add('Tailwind CSS', '70%', 'CSS');
    if(h.includes('bootstrap')) add('Bootstrap', '80%', 'CSS');
    if(h.includes('googletagmanager.com') || h.includes('gtag(')) add('Google Analytics / GTM', '95%', 'Analytics');
    if(h.includes('fonts.googleapis.com')) add('Google Fonts', '95%', 'Fonts');
    if(srv.includes('nginx')) add('Nginx', '95%', 'Server');
    if(srv.includes('apache')) add('Apache', '95%', 'Server');
    if(srv.includes('cloudflare') || headers['cf-ray']) add('Cloudflare CDN', '95%', 'CDN');
    return found;
  }

  function analyzeSeo(doc, html, url){
    const title = doc.querySelector('title')?.textContent?.trim() || '';
    const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
    const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const twCard = doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || '';
    const schemas = doc.querySelectorAll('script[type="application/ld+json"]').length;
    const h1 = doc.querySelectorAll('h1').length;
    const h2 = doc.querySelectorAll('h2').length;
    const imgs = Array.from(doc.querySelectorAll('img'));
    const missingAlt = imgs.filter(i => !i.getAttribute('alt')?.trim()).length;
    const links = Array.from(doc.querySelectorAll('a[href]'));
    const host = new URL(url).hostname;
    let internal = 0, external = 0;
    links.forEach(a => {
      try{
        const u = new URL(a.getAttribute('href'), url);
        if(u.hostname === host) internal++; else external++;
      }catch{}
    });
    const text = (doc.body?.innerText || doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;

    let score = 0;
    const tips = [];
    if(title.length >= 10 && title.length <= 65) score += 20; else tips.push('Title tag should be 10–65 characters.');
    if(desc.length >= 50 && desc.length <= 165) score += 20; else tips.push('Meta description should be 50–165 characters.');
    if(h1 === 1) score += 15; else tips.push(`Found ${h1} H1 tags (recommended: exactly 1).`);
    if(canonical) score += 10; else tips.push('Add a canonical <link rel="canonical"> tag.');
    if(viewport) score += 10; else tips.push('Add a mobile viewport meta tag.');
    if(ogTitle) score += 10; else tips.push('Add Open Graph (og:title) metadata.');
    if(schemas > 0) score += 5; else tips.push('Add JSON-LD Schema.org structured data.');
    if(imgs.length === 0 || missingAlt === 0) score += 10; else tips.push(`${missingAlt} image(s) missing ALT attributes.`);

    return {
      score, tips, title, desc, canonical, robots, viewport, ogTitle, twCard, schemas,
      h1, h2, imgCount: imgs.length, missingAlt, internalLinks: internal, externalLinks: external, words
    };
  }

  async function runIntelligence(rawUrl){
    let url = (rawUrl || '').trim();
    if(!url) return;
    if(!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let parsed;
    try{ parsed = new URL(url); }catch{ alert('Invalid URL'); return; }
    if(isPrivateHost(parsed.hostname)){ alert('SSRF Protection: localhost and private IPs are blocked.'); return; }

    const statusEl = $('#wi-status');
    const btn = $('#wi-run');
    if(btn){ btn.disabled = true; btn.textContent = 'Analyzing…'; }
    if(statusEl) statusEl.textContent = '1/3 Fetching page & headers…';

    try{
      const page = await fetchHtml(url);
      if(statusEl) statusEl.textContent = '2/3 Parsing SEO, content & technologies…';
      const doc = new DOMParser().parseFromString(page.html, 'text/html');
      const seo = analyzeSeo(doc, page.html, url);
      const tech = detectTech(page.html, page.headers);

      if(statusEl) statusEl.textContent = '3/3 Querying DNS, IP & Security…';
      const host = parsed.hostname;
      const [dnsA, dnsAAAA, dnsMX, dnsNS, dnsTXT, dnsDMARC] = await Promise.all([
        get(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`).catch(()=>({})),
        get(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=AAAA`).catch(()=>({})),
        get(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=MX`).catch(()=>({})),
        get(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=NS`).catch(()=>({})),
        get(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`).catch(()=>({})),
        get(`https://dns.google/resolve?name=${encodeURIComponent('_dmarc.'+host)}&type=TXT`).catch(()=>({}))
      ]);
      const ipv4 = (dnsA.Answer||[]).filter(x=>x.type===1).map(x=>x.data);
      const ipv6 = (dnsAAAA.Answer||[]).filter(x=>x.type===28).map(x=>x.data);
      const mx = (dnsMX.Answer||[]).map(x=>x.data);
      const ns = (dnsNS.Answer||[]).map(x=>x.data);
      const spf = (dnsTXT.Answer||[]).some(x=>/v=spf1/i.test(x.data));
      const dmarc = (dnsDMARC.Answer||[]).some(x=>/v=DMARC1/i.test(x.data));

      let geo = {};
      if(ipv4[0]){
        try{
          const g = await get(`https://ipwho.is/${encodeURIComponent(ipv4[0])}`);
          geo = { ip: g.ip, country: g.country, isp: g.connection?.isp, asn: g.connection?.asn };
        }catch{}
      }

      const httpsOk = parsed.protocol === 'https:';
      let secScore = httpsOk ? 50 : 0;
      if(spf) secScore += 25;
      if(dmarc) secScore += 25;

      const pingSamples = [];
      for(let i=0;i<3;i++){
        const pt0 = performance.now();
        try{
          await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(4000) });
          pingSamples.push(Math.round(performance.now() - pt0));
        }catch{}
      }
      const pingSummary = pingSamples.length
        ? `${Math.min(...pingSamples)} / ${Math.round(pingSamples.reduce((a,b)=>a+b,0)/pingSamples.length)} / ${Math.max(...pingSamples)} ms`
        : 'Timeout';

      const result = {
        url, host, checkedAt: new Date().toISOString(),
        httpStatus: page.status, responseMs: page.ms, pingSummary, htmlBytes: page.html.length, via: page.via,
        seo, tech, secScore, httpsOk,
        dns: { ipv4, ipv6, mx, ns, spf, dmarc },
        geo
      };
      wiState.data = result;

      // Save to local historical database
      const hist = JSON.parse(localStorage.getItem(WI_HIST_KEY) || '[]');
      hist.unshift({ host, checkedAt: result.checkedAt, seoScore: seo.score, secScore, responseMs: page.ms, htmlBytes: page.html.length, title: seo.title });
      localStorage.setItem(WI_HIST_KEY, JSON.stringify(hist.slice(0, 50)));

      if(statusEl) statusEl.textContent = 'Analysis complete.';
      renderWiBody();
    }catch(e){
      if(statusEl) statusEl.textContent = 'Error: ' + (e.message || e);
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = 'Analyze →'; }
    }
  }

  function renderWiBody(){
    const box = $('#wi-body');
    if(!box) return;
    const d = wiState.data;
    if(!d){
      box.innerHTML = `<div class="panel tool-box"><div class="result-empty">Enter any public URL above and click <strong>Analyze →</strong> to run a full Website Intelligence audit.</div></div>`;
      return;
    }

    const tabs = [
      ['overview', 'Overview'],
      ['seo', 'SEO & Content'],
      ['perf', 'Performance & Tech'],
      ['security', 'Security & Domain'],
      ['traffic', 'Traffic & History'],
      ['compare', 'Monitor & Compare']
    ];

    const navHtml = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${tabs.map(([id, lbl]) =>
      `<button class="copy-btn ${wiState.tab===id?'active':''}" data-wi-tab="${id}" style="${wiState.tab===id?'border-color:var(--green);color:var(--green)':''}">${lbl}</button>`
    ).join('')}</div>`;

    let body = '';
    if(wiState.tab === 'overview'){
      body = `
        <div class="nf-res-grid">
          ${kv('SEO SCORE', `${d.seo.score} / 100`, 'measured')}
          ${kv('SECURITY SCORE', `${d.secScore} / 100`, 'measured')}
          ${kv('RESPONSE TIME', `${d.responseMs} ms`, 'measured')}
          ${kv('WEBSITE PING (MIN/AVG/MAX)', d.pingSummary || '—', 'measured')}
          ${kv('HTML SIZE', `${(d.htmlBytes/1024).toFixed(1)} KB`, 'measured')}
          ${kv('SERVER IP', d.geo.ip || d.dns.ipv4[0] || '—', 'public')}
          ${kv('ISP / ASN', d.geo.isp ? `${d.geo.isp} (AS${d.geo.asn})` : '—', 'public')}
          ${kv('TECHNOLOGIES', d.tech.map(t=>t.name).join(', ') || 'None detected', 'estimated')}
          ${kv('MONTHLY TRAFFIC', 'Nem áll rendelkezésre nyilvános adat', 'unavailable')}
        </div>
        <div class="nf-res-subhead">REAL-DATA SCORE CHART</div>
        <div class="panel tool-box" style="padding:14px">
          <svg viewBox="0 0 420 96" style="width:100%;max-width:520px;height:auto;display:block">
            <text x="0" y="20" fill="currentColor" font-size="11">SEO (${d.seo.score}/100)</text>
            <rect x="130" y="10" width="260" height="14" rx="4" fill="rgba(255,255,255,0.08)"/>
            <rect x="130" y="10" width="${Math.round(d.seo.score*2.6)}" height="14" rx="4" fill="#b7f36b"/>
            <text x="0" y="50" fill="currentColor" font-size="11">Security (${d.secScore}/100)</text>
            <rect x="130" y="40" width="260" height="14" rx="4" fill="rgba(255,255,255,0.08)"/>
            <rect x="130" y="40" width="${Math.round(d.secScore*2.6)}" height="14" rx="4" fill="#7be0ff"/>
            <text x="0" y="80" fill="currentColor" font-size="11">Speed (${Math.max(5, 100 - Math.min(95, Math.round(d.responseMs/20)))}/100)</text>
            <rect x="130" y="70" width="260" height="14" rx="4" fill="rgba(255,255,255,0.08)"/>
            <rect x="130" y="70" width="${Math.round(Math.max(5, 100 - Math.min(95, Math.round(d.responseMs/20)))*2.6)}" height="14" rx="4" fill="#ffd166"/>
          </svg>
        </div>`;
    } else if(wiState.tab === 'seo'){
      body = `
        <div class="nf-res-grid">
          ${kv('TITLE', d.seo.title || 'Missing', 'measured')}
          ${kv('META DESCRIPTION', d.seo.desc || 'Missing', 'measured')}
          ${kv('CANONICAL', d.seo.canonical || 'Missing', 'measured')}
          ${kv('H1 / H2 COUNT', `${d.seo.h1} / ${d.seo.h2}`, 'measured')}
          ${kv('WORD COUNT', d.seo.words, 'measured')}
          ${kv('IMAGES / MISSING ALT', `${d.seo.imgCount} / ${d.seo.missingAlt}`, 'measured')}
          ${kv('INTERNAL / EXTERNAL LINKS', `${d.seo.internalLinks} / ${d.seo.externalLinks}`, 'measured')}
          ${kv('SCHEMA.ORG (JSON-LD)', d.seo.schemas, 'measured')}
        </div>
        <div class="nf-res-subhead">SEO RECOMMENDATIONS</div>
        <div class="panel tool-box">${d.seo.tips.length ? d.seo.tips.map(t=>`<div>• ${esc(t)}</div>`).join('') : '<div>No major SEO issues detected.</div>'}</div>`;
    } else if(wiState.tab === 'perf'){
      body = `
        <div class="nf-res-grid">
          ${kv('FIRST RESPONSE', `${d.responseMs} ms`, 'measured')}
          ${kv('HTML PAYLOAD', `${(d.htmlBytes/1024).toFixed(1)} KB`, 'measured')}
          ${kv('FETCH METHOD', d.via, 'measured')}
          ${kv('CORE WEB VITALS', 'Browser lab estimate only', 'unavailable')}
        </div>
        <div class="nf-res-subhead">DETECTED TECHNOLOGIES (${d.tech.length})</div>
        <div class="nf-res-table-wrap"><table class="nf-res-table"><thead><tr><th>TECHNOLOGY</th><th>CATEGORY</th><th>CONFIDENCE</th></tr></thead><tbody>
          ${d.tech.length ? d.tech.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.category)}</td><td>${esc(t.confidence)}</td></tr>`).join('') : '<tr><td colspan="3">No specific frameworks detected.</td></tr>'}
        </tbody></table></div>`;
    } else if(wiState.tab === 'security'){
      body = `
        <div class="nf-res-grid">
          ${kv('HTTPS', d.httpsOk ? 'Enabled' : 'Disabled', 'measured')}
          ${kv('SPF RECORD', d.dns.spf ? 'Present' : 'Missing', 'public')}
          ${kv('DMARC RECORD', d.dns.dmarc ? 'Present' : 'Missing', 'public')}
          ${kv('IPv4 (A)', d.dns.ipv4.join(', ') || 'None', 'public')}
          ${kv('IPv6 (AAAA)', d.dns.ipv6.join(', ') || 'None', 'public')}
          ${kv('NAMESERVERS', d.dns.ns.join(', ') || 'None', 'public')}
        </div>`;
    } else if(wiState.tab === 'traffic'){
      const hist = JSON.parse(localStorage.getItem(WI_HIST_KEY) || '[]').filter(x => x.host === d.host);
      body = `
        <div class="notice">External websites' exact Google Analytics / visitor counts cannot be read from a URL. Below are real measurements recorded since your first scan.</div>
        <div class="nf-res-subhead">LOCAL HISTORICAL MEASUREMENTS (${hist.length})</div>
        <div class="nf-res-table-wrap"><table class="nf-res-table"><thead><tr><th>DATE</th><th>SEO</th><th>SEC</th><th>RESPONSE</th><th>HTML KB</th></tr></thead><tbody>
          ${hist.map(h=>`<tr><td>${esc(h.checkedAt.slice(0,19).replace('T',' '))}</td><td>${h.seoScore}</td><td>${h.secScore}</td><td>${h.responseMs} ms</td><td>${(h.htmlBytes/1024).toFixed(1)}</td></tr>`).join('')}
        </tbody></table></div>`;
    } else if(wiState.tab === 'compare'){
      const watch = JSON.parse(localStorage.getItem(WI_WATCH_KEY) || '[]');
      body = `
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn secondary" id="wi-watch-add">+ Add ${esc(d.host)} to Watchlist</button>
          <button class="btn secondary" id="wi-compare-add">+ Add to Comparison</button>
        </div>
        <div class="nf-res-subhead">WATCHLIST (${watch.length})</div>
        <div class="nf-res-table-wrap"><table class="nf-res-table"><thead><tr><th>HOST</th><th>ADDED</th><th>LAST SEO</th></tr></thead><tbody>
          ${watch.length ? watch.map(w=>`<tr><td>${esc(w.host)}</td><td>${esc(w.addedAt.slice(0,10))}</td><td>${w.seoScore}</td></tr>`).join('') : '<tr><td colspan="3">Watchlist is empty.</td></tr>'}
        </tbody></table></div>`;
    }

    box.innerHTML = `${navHtml}${body}`;
    box.querySelectorAll('[data-wi-tab]').forEach(b => b.onclick = () => { wiState.tab = b.dataset.wiTab; renderWiBody(); });
    $('#wi-watch-add')?.addEventListener('click', () => {
      const watch = JSON.parse(localStorage.getItem(WI_WATCH_KEY) || '[]').filter(x => x.host !== d.host);
      watch.unshift({ host: d.host, addedAt: new Date().toISOString(), seoScore: d.seo.score });
      localStorage.setItem(WI_WATCH_KEY, JSON.stringify(watch));
      renderWiBody();
    });
  }

  window.intelligencePage = function(){
    nav('intelligence');
    setTimeout(() => {
      $('#wi-run')?.addEventListener('click', () => runIntelligence($('#wi-url')?.value));
      $('#wi-url')?.addEventListener('keydown', e => { if(e.key === 'Enter') runIntelligence($('#wi-url')?.value); });
      $('#wi-export-json')?.addEventListener('click', () => {
        if(wiState.data) save(JSON.stringify(wiState.data, null, 2), `${wiState.data.host}-intelligence.json`, 'application/json');
      });
      renderWiBody();
    }, 0);
    return `
      <div class="eyebrow">WEBSITE INTELLIGENCE / AUDIT PLATFORM</div>
      <h1 class="page-title">Website Intelligence</h1>
      <p class="page-desc">Comprehensive SEO, performance, technology, security, DNS and historical monitoring from a single URL.</p>
      <section class="panel tool-box" style="margin-bottom:14px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input id="wi-url" class="form-control" style="flex:1;min-width:240px" value="https://example.com" placeholder="https://example.com">
          <button class="btn" id="wi-run">Analyze →</button>
          <button class="copy-btn" id="wi-export-json">EXPORT JSON</button>
        </div>
        <div id="wi-status" style="margin-top:8px;font-size:12px;color:var(--muted)">Ready.</div>
      </section>
      <div id="wi-body"></div>
    `;
  };
})();
