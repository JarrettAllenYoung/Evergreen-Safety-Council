<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>


(function () {
  // Shared header names (adjust if your CSV headers differ)
  const DEFAULT_HEADERS = {
    NUM: 'Certification #',
    FN:  'First',
    LN:  'Last',
    EXP: 'Cert. Exp. Date',
  };

  // Generic initializer for one tab (now supports csvUrl OR csvUrls)
  function initCertLookup({
    csvUrl,                      // single URL (backward compatible)
    csvUrls,                     // OR array of URLs to search across (merged)
    selectors: { certInput, lastInput, button, output, clearLink },
    headers = DEFAULT_HEADERS
  }) {
    const urls = (csvUrls && csvUrls.length) ? csvUrls : (csvUrl ? [csvUrl] : []);
    let index = null; // cert# -> array of rows merged across all URLs

    function setLoading(btn, isLoading) {
      btn.classList.toggle('loading', isLoading);
      btn.disabled = isLoading;
    }
    function render(outEl, html) { outEl.innerHTML = html; }
    const norm = v => String(v || '').trim().toLowerCase();

    async function buildIndex() {
      if (index) return index;
      index = Object.create(null);

      // fetch all CSVs in parallel; skip failures
      const fetchOne = async (u) => {
        try {
          const res = await fetch(u + '&cb=' + Date.now(), { cache: 'no-store' });
          if (!res.ok) throw new Error('Network error');
          const text = await res.text();
          if (text.trim().startsWith('<!DOCTYPE') || text.includes('<html')) {
            throw new Error('CSV endpoint returned HTML');
          }
          return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
        } catch {
          return [];
        }
      };

      const datasets = await Promise.all(urls.map(fetchOne));
      for (const rows of datasets) {
        for (const row of rows) {
          const key = String(row[headers.NUM] ?? '').trim();
          if (!key) continue;
          (index[key] ||= []).push(row); // merge: allow duplicates across sheets
        }
      }
      return index;
    }

    async function lookup(cert, last) {
      const map  = await buildIndex();
      const rows = map[cert] || [];
      const want = norm(last);
      // Exact last-name match, case-insensitive. First match wins (order = csvUrls order).
      return rows.find(r => norm(r[headers.LN]) === want) || null;
    }

    document.addEventListener('DOMContentLoaded', function () {
      const certEl = document.querySelector(certInput);
      const lastEl = document.querySelector(lastInput);
      const btn    = document.querySelector(button);
      const out    = document.querySelector(output);
      const clr    = clearLink ? document.querySelector(clearLink) : null;
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
            <p class="success-message"><svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="#26834f" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm13.707-1.293a1 1 0 0 0-1.414-1.414L11 12.586l-1.793-1.793a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l4-4Z" clip-rule="evenodd"/>
</svg>The certification you entered is valid. Below are the details.</p>
              <p>
                <strong>${first} ${ln}</strong><br>
                Certification #: ${num}<br>
                Expiration: ${exp}
              </p>
            `);
          } else {
            render(out, `
  <p class="error-message">
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
         width="24" height="24" viewBox="0 0 24 24" fill="#fd2e09"
         class="w-6 h-6 text-gray-800 dark:text-white" style="vertical-align:-3px;margin-right:8px">
      <path fill-rule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm9.008-3.018a1.502 1.502 0 0 1 2.522 1.159v.024a1.44 1.44 0 0 1-1.493 1.418 1 1 0 0 0-1.037.999V14a1 1 0 1 0 2 0v-.539a3.44 3.44 0 0 0 2.529-3.256 3.502 3.502 0 0 0-7-.255 1 1 0 0 0 2 .076c.014-.398.187-.774.48-1.044Zm.982 7.026a1 1 0 1 0 0 2H12a1 1 0 1 0 0-2h-.01Z" clip-rule="evenodd"/>
    </svg>
    The certification details you entered were not found in our database.
  </p>
`);
          }
        } catch (err) {
          console.error(err);
          render(out, '<p class="error-message">Sorry, something went wrong.</p>');
        } finally {
          setLoading(btn, false);
        }
      }

      function handleClear(e) {
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

  // ----- PEVO tab: search BOTH PEVO then WITPAC -----
  initCertLookup({
    csvUrls: [
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWo_LcTb5jCAOU5b6ZcUXVx0nY0cAJuV8Tumuk1Szz8zpRUYrZ8XM2LrzyufqnarTKSK4_X85mgpxq/pub?output=csv', // PEVO
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgbVwrRM1Una1d29lwAccdwoMfBzaY8cc8zQ0O2LLT6rEOcDs_glNiH05f8TNEYwtBu183xZhDjYYd/pub?output=csv'  // WITPAC
    ],
    selectors: {
      certInput: '.pevo-cert-input',
      lastInput: '.pevo-last-input',
      button: '.pevo-check-btn',
      output: '#pevo-result',
      clearLink: '.pevo-clear',
    }
    // headers: { NUM:'...', FN:'...', LN:'...', EXP:'...' }
  });

  // ----- WITPAC tab: search only WITPAC -----
  initCertLookup({
    csvUrls: [
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWo_LcTb5jCAOU5b6ZcUXVx0nY0cAJuV8Tumuk1Szz8zpRUYrZ8XM2LrzyufqnarTKSK4_X85mgpxq/pub?output=csv', // PEVO
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgbVwrRM1Una1d29lwAccdwoMfBzaY8cc8zQ0O2LLT6rEOcDs_glNiH05f8TNEYwtBu183xZhDjYYd/pub?output=csv'  // WITPAC
    ],
    selectors: {
      certInput: '.witpac-cert-input',
      lastInput: '.witpac-last-input',
      button: '.witpac-check-btn',
      output: '#witpac-result',
      clearLink: '.witpac-clear',
    }
    // headers: { NUM:'...', FN:'...', LN:'...', EXP:'...' }
  });
})();