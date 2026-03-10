// Symbol Launcher — popup.js
// Caches symbols in chrome.storage.local. Only re-fetches on manual refresh.

(function () {
    const CHART_BASE = 'https://www.tradingview.com/chart?symbol=';
    const CACHE_KEY = 'symbolCache';

    let allSymbols = [];
    let filteredSymbols = [];
    let checkedSet = new Set();
    let currentQuery = '';
    let currentTypeFilter = 'all';
    let isFetching = false;

    const searchInput = document.getElementById('searchInput');
    const countBadge = document.getElementById('countBadge');
    const symbolListEl = document.getElementById('symbolList');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const selectedCountEl = document.getElementById('selectedCount');
    const openChartsBtn = document.getElementById('openChartsBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // ── Load from cache ONLY. Never auto-fetch. ──
    async function init() {
        const cached = await chrome.storage.local.get(CACHE_KEY);

        if (cached[CACHE_KEY] && cached[CACHE_KEY].length > 0) {
            allSymbols = cached[CACHE_KEY];
            applyFilter();
            renderList();
        } else {
            // No cache — show prompt to click refresh
            symbolListEl.innerHTML = `
                <div class="empty-state">
                    <span style="font-size:28px;margin-bottom:8px">📋</span>
                    <b>No symbols cached yet</b><br>
                    <small>Click the 🔄 button above to load symbols.<br>Make sure a TradingView tab is open.</small>
                </div>`;
        }
    }

    // ── Fetch one page from TV tab ──
    async function fetchPage(tabId, start) {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            args: [start],
            func: async (startOffset) => {
                const url = `https://symbol-search.tradingview.com/symbol_search/v3/?text=&hl=1&exchange=&lang=en&search_type=undefined&start=${startOffset}&domain=production&sort_by_country=US&promo=true`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                return data.symbols || data;
            }
        });
        return results[0].result || [];
    }

    // ── Progressive fetch (only called by refresh button) ──
    async function fetchAndCache() {
        if (isFetching) return;
        isFetching = true;

        // Reset
        allSymbols = [];
        filteredSymbols = [];
        const seen = new Set(); // deduplicate

        symbolListEl.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <span>Connecting to TradingView...</span>
            </div>`;

        try {
            const tabs = await chrome.tabs.query({ url: '*://*.tradingview.com/*' });

            if (tabs.length === 0) {
                symbolListEl.innerHTML = `
                    <div class="empty-state">
                        <span style="font-size:24px;margin-bottom:8px">🌐</span>
                        <b>No TradingView tab open</b><br>
                        <small>Please open <a href="https://www.tradingview.com" target="_blank" style="color:#22d3ee">tradingview.com</a> first.</small>
                    </div>`;
                isFetching = false;
                return;
            }

            const tabId = tabs[0].id;
            let start = 0;

            while (true) {
                const batch = await fetchPage(tabId, start);
                if (!Array.isArray(batch) || batch.length === 0) break;

                for (const s of batch) {
                    const full = `${s.exchange || s.prefix || ''}:${s.symbol}`;
                    if (seen.has(full)) continue; // skip duplicates
                    seen.add(full);

                    allSymbols.push({
                        symbol: s.symbol,
                        exchange: s.exchange || s.prefix || '',
                        description: s.description || '',
                        type: s.type || '',
                        full
                    });
                }

                applyFilter();
                renderList();

                start += batch.length;
                if (start >= 15000) break;
            }

            // Save to cache
            await chrome.storage.local.set({ [CACHE_KEY]: allSymbols });

        } catch (err) {
            console.error('[Symbol Launcher] Fetch error:', err);
            if (allSymbols.length === 0) {
                symbolListEl.innerHTML = `<div class="empty-state">Failed to load symbols.<br><small>${err.message}</small></div>`;
            }
            if (allSymbols.length > 0) {
                await chrome.storage.local.set({ [CACHE_KEY]: allSymbols });
            }
        } finally {
            isFetching = false;
        }
    }

    // ── Apply search + type filter ──
    function applyFilter() {
        filteredSymbols = allSymbols.filter(s => {
            // Type filter
            if (currentTypeFilter !== 'all') {
                const t = (s.type || '').toLowerCase();
                if (currentTypeFilter === 'crypto' && !t.includes('crypto')) return false;
                if (currentTypeFilter === 'stock' && !t.includes('stock')) return false;
                if (currentTypeFilter === 'forex' && !(t.includes('forex') || t.includes('cfd'))) return false;
                if (currentTypeFilter === 'index' && !t.includes('index')) return false;
                if (currentTypeFilter === 'futures' && !t.includes('futures')) return false;
            }

            // Text search
            if (currentQuery) {
                return s.symbol.toLowerCase().includes(currentQuery) ||
                    s.exchange.toLowerCase().includes(currentQuery) ||
                    s.description.toLowerCase().includes(currentQuery);
            }

            return true;
        });
    }

    // ── Render the symbol list ──
    function renderList() {
        if (filteredSymbols.length === 0 && allSymbols.length > 0) {
            symbolListEl.innerHTML = '<div class="empty-state">No symbols match your filter</div>';
            countBadge.textContent = '0';
            updateFooter();
            return;
        }

        if (filteredSymbols.length === 0) {
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

            row.addEventListener('click', (e) => {
                if (e.target !== cb) cb.checked = !cb.checked;

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
        currentQuery = searchInput.value.trim().toLowerCase();
        applyFilter();
        renderList();
    });

    // ── Type filter buttons ──
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTypeFilter = btn.dataset.type;
            applyFilter();
            renderList();
        });
    });

    // ── Select All / Deselect All ──
    selectAllBtn.addEventListener('click', () => {
        for (const sym of filteredSymbols) checkedSet.add(sym.full);
        renderList();
    });

    deselectAllBtn.addEventListener('click', () => {
        for (const sym of filteredSymbols) checkedSet.delete(sym.full);
        renderList();
    });

    // ── Refresh button — clear cache and re-fetch ──
    refreshBtn.addEventListener('click', async () => {
        if (isFetching) return;
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳';
        await chrome.storage.local.remove(CACHE_KEY);
        await fetchAndCache();
        refreshBtn.textContent = '🔄';
        refreshBtn.disabled = false;
    });

    // ── Open Charts ──
    openChartsBtn.addEventListener('click', () => {
        if (checkedSet.size === 0) return;

        for (const symbolFull of checkedSet) {
            const url = CHART_BASE + encodeURIComponent(symbolFull);
            chrome.tabs.create({ url, active: false });
        }

        openChartsBtn.textContent = '✓ Tabs Opened!';
        openChartsBtn.disabled = true;
        setTimeout(() => {
            openChartsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Open Charts`;
            openChartsBtn.disabled = checkedSet.size === 0;
        }, 1500);
    });

    // ── Init ──
    init();
})();
