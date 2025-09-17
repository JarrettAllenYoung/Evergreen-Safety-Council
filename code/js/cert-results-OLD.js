<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>


(function () {
  // Shared header names (adjust if your CSV headers differ)
  const DEFAULT_HEADERS = {
    NUM: 'Certification #',
    FN:  'First',
    LN:  'Last',
    EXP: 'Cert. Exp. Date',
  };

  // Generic initializer for one tab
  function initCertLookup({
    csvUrl,
    selectors: { certInput, lastInput, button, output, clearLink }, // ⬅️ added clearLink
    headers = DEFAULT_HEADERS
  }) {
    let index = null; // cert# -> array of rows

    function setLoading(btn, isLoading) {
      btn.classList.toggle('loading', isLoading);
      btn.disabled = isLoading;
    }
    function render(outEl, html) { outEl.innerHTML = html; }
    const norm = v => String(v || '').trim().toLowerCase();

    async function buildIndex() {
      if (index) return index;
      const res = await fetch(csvUrl + '&cb=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Network error');
      const text = await res.text();
      if (text.trim().startsWith('<!DOCTYPE') || text.includes('<html')) {
        throw new Error('CSV endpoint returned HTML; check csvUrl');
      }
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

      const map = Object.create(null);
      for (const row of parsed.data) {
        const key = String(row[headers.NUM] ?? '').trim();
        if (!key) continue;
        (map[key] ||= []).push(row); // support duplicates of the same cert#
      }
      index = map;
      return map;
    }

    async function lookup(cert, last) {
      const map = await buildIndex();
      const rows = map[cert] || [];
      const want = norm(last);
      // Exact last-name match, case-insensitive
      return rows.find(r => norm(r[headers.LN]) === want) || null;
    }

    document.addEventListener('DOMContentLoaded', function () {
      const certEl = document.querySelector(certInput);
      const lastEl = document.querySelector(lastInput);
      const btn    = document.querySelector(button);
      const out    = document.querySelector(output);
      const clr    = clearLink ? document.querySelector(clearLink) : null; // ⬅️ clear link element
      if (!certEl || !lastEl || !btn || !out) return;

      async function handleCheck(e) {
        e.preventDefault();
        const cert = String(certEl.value || '').trim();
        const last = String(lastEl.value || '').trim();

        if (!cert || !last) {
          render(out, '<p>Please enter certification # and last name.</p>');
          return;
        }

        setLoading(btn, true);
        render(out, '');

        try {
          const row = await lookup(cert, last);
          if (row) {
            const first = (row[headers.FN]  || '').trim();
            const ln    = (row[headers.LN]  || '').trim();
            const num   = (row[headers.NUM] || '').trim();
            const exp   = (row[headers.EXP] || '').trim();
            render(out, `
              <p>
                <strong>${first} ${ln}</strong><br>
                Certification #: ${num}<br>
                Expiration: ${exp}
              </p>
            `);
          } else {
            render(out, '<p>Certification not found.</p>');
          }
        } catch (err) {
          console.error(err);
          render(out, '<p>Sorry, something went wrong.</p>');
        } finally {
          setLoading(btn, false);
        }
      }

      function handleClear(e) { // ⬅️ new
        if (e) e.preventDefault();
        certEl.value = '';
        lastEl.value = '';
        render(out, '');
        btn.classList.remove('loading');
        btn.disabled = false;
        certEl.focus();
      }

      btn.addEventListener('click', handleCheck);
      certEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleCheck(e); });
      lastEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleCheck(e); });
      if (clr) clr.addEventListener('click', handleClear);
    });
  }

  // ----- PEVO tab -----
  initCertLookup({
    csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWo_LcTb5jCAOU5b6ZcUXVx0nY0cAJuV8Tumuk1Szz8zpRUYrZ8XM2LrzyufqnarTKSK4_X85mgpxq/pub?output=csv',
    selectors: {
      certInput: '.pevo-cert-input',
      lastInput: '.pevo-last-input',
      button: '.pevo-check-btn',
      output: '#pevo-result',
      clearLink: '.pevo-clear', // ⬅️ add this anchor/button in your markup
    }
    // headers: { NUM:'...', FN:'...', LN:'...', EXP:'...' } // only if PEVO uses different labels
  });

  // ----- WITPAC tab -----
  initCertLookup({
    csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgbVwrRM1Una1d29lwAccdwoMfBzaY8cc8zQ0O2LLT6rEOcDs_glNiH05f8TNEYwtBu183xZhDjYYd/pub?output=csv',
    selectors: {
      certInput: '.witpac-cert-input',
      lastInput: '.witpac-last-input',
      button: '.witpac-check-btn',
      output: '#witpac-result',
      clearLink: '.witpac-clear', // ⬅️ add this anchor/button in your markup
    }
    // headers: { NUM:'...', FN:'...', LN:'...', EXP:'...' } // override if WITPAC headers differ
  });
})();