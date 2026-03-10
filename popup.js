// Symbol Launcher — popup.js
// Fetches symbols from TradingView's search API and lets the user open chart tabs.

(function () {
    const API_URL = 'https://symbol-search.tradingview.com/symbol_search/v3/';
    const CHART_BASE = 'https://www.tradingview.com/chart?symbol=';
    const PAGE_SIZE = 100;

    let allSymbols = [];
    let filteredSymbols = [];
    let checkedSet = new Set();

    const searchInput = document.getElementById('searchInput');
    const countBadge = document.getElementById('countBadge');
    const symbolListEl = document.getElementById('symbolList');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const selectedCountEl = document.getElementById('selectedCount');
    const openChartsBtn = document.getElementById('openChartsBtn');

    // ── Fetch symbols from TradingView API ──
    async function fetchSymbols() {
        try {
            const params = new URLSearchParams({
                text: '',
                hl: '1',
                exchange: '',
                lang: 'en',
                search_type: 'undefined',
                start: '0',
                domain: 'production',
                sort_by_country: 'US',
                promo: 'true'
            });

            const res = await fetch(`${API_URL}?${params.toString()}`, {
                headers: {
                    'accept': '*/*',
                    'origin': 'https://www.tradingview.com',
                    'referer': 'https://www.tradingview.com/'
                }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            // data.symbols is the array
            const symbols = data.symbols || data;

            allSymbols = (Array.isArray(symbols) ? symbols : []).map(s => ({
                symbol: s.symbol,
                exchange: s.exchange || s.prefix || '',
                description: s.description || '',
                type: s.type || '',
                full: `${s.exchange || s.prefix || ''}:${s.symbol}`
            }));

            filteredSymbols = [...allSymbols];
            renderList();
        } catch (err) {
            console.error('[Symbol Launcher] Fetch error:', err);
            symbolListEl.innerHTML = `<div class="empty-state">Failed to load symbols.<br><small>${err.message}</small></div>`;
        }
    }

    // ── Render the symbol list ──
    function renderList() {
        if (filteredSymbols.length === 0) {
            symbolListEl.innerHTML = '<div class="empty-state">No symbols found</div>';
            countBadge.textContent = '0';
            updateFooter();
            return;
        }

        countBadge.textContent = filteredSymbols.length;

        const fragment = document.createDocumentFragment();

        for (const sym of filteredSymbols) {
            const row = document.createElement('div');
            row.className = 'symbol-row' + (checkedSet.has(sym.full) ? ' checked' : '');

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = checkedSet.has(sym.full);

            const info = document.createElement('div');
            info.className = 'symbol-info';

            const topRow = document.createElement('div');
            topRow.className = 'symbol-top-row';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'symbol-name';
            nameSpan.textContent = sym.symbol;

            const exchSpan = document.createElement('span');
            exchSpan.className = 'symbol-exchange';
            exchSpan.textContent = sym.exchange;

            topRow.appendChild(nameSpan);
            topRow.appendChild(exchSpan);

            const descSpan = document.createElement('div');
            descSpan.className = 'symbol-desc';
            descSpan.textContent = sym.description;

            info.appendChild(topRow);
            info.appendChild(descSpan);

            const typeSpan = document.createElement('span');
            const typeClass = getTypeClass(sym.type);
            typeSpan.className = `symbol-type ${typeClass}`;
            typeSpan.textContent = sym.type || '—';

            row.appendChild(cb);
            row.appendChild(info);
            row.appendChild(typeSpan);

            // Click handler — toggle checkbox
            row.addEventListener('click', (e) => {
                if (e.target === cb) {
                    // Checkbox handles itself
                } else {
                    cb.checked = !cb.checked;
                }

                if (cb.checked) {
                    checkedSet.add(sym.full);
                    row.classList.add('checked');
                } else {
                    checkedSet.delete(sym.full);
                    row.classList.remove('checked');
                }
                updateFooter();
            });

            fragment.appendChild(row);
        }

        symbolListEl.innerHTML = '';
        symbolListEl.appendChild(fragment);
        updateFooter();
    }

    function getTypeClass(type) {
        const t = (type || '').toLowerCase();
        if (t.includes('crypto')) return 'type-crypto';
        if (t.includes('stock')) return 'type-stock';
        if (t.includes('forex') || t.includes('cfd')) return 'type-forex';
        if (t.includes('index')) return 'type-index';
        if (t.includes('futures')) return 'type-futures';
        return 'type-default';
    }

    function updateFooter() {
        const count = checkedSet.size;
        selectedCountEl.textContent = `${count} selected`;
        openChartsBtn.disabled = count === 0;
    }

    // ── Search / filter ──
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) {
            filteredSymbols = [...allSymbols];
        } else {
            filteredSymbols = allSymbols.filter(s =>
                s.symbol.toLowerCase().includes(q) ||
                s.exchange.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q)
            );
        }
        renderList();
    });

    // ── Select All / Deselect All ──
    selectAllBtn.addEventListener('click', () => {
        for (const sym of filteredSymbols) {
            checkedSet.add(sym.full);
        }
        renderList();
    });

    deselectAllBtn.addEventListener('click', () => {
        for (const sym of filteredSymbols) {
            checkedSet.delete(sym.full);
        }
        renderList();
    });

    // ── Open Charts ──
    openChartsBtn.addEventListener('click', () => {
        if (checkedSet.size === 0) return;

        for (const symbolFull of checkedSet) {
            const url = CHART_BASE + encodeURIComponent(symbolFull);
            chrome.tabs.create({ url, active: false });
        }

        // Brief visual feedback
        openChartsBtn.textContent = '✓ Tabs Opened!';
        openChartsBtn.disabled = true;
        setTimeout(() => {
            openChartsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Open Charts`;
            openChartsBtn.disabled = checkedSet.size === 0;
        }, 1500);
    });

    // ── Init ──
    fetchSymbols();
})();
