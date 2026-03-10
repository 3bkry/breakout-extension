const CHECKED_CACHE_KEY = 'checkedSymbolsCache';

async function initGrid() {
    const cached = await chrome.storage.local.get(CHECKED_CACHE_KEY);
    const symbols = cached[CHECKED_CACHE_KEY] || [];

    const container = document.getElementById('gridContainer');

    if (symbols.length === 0) {
        container.innerHTML = '<div class="empty-message">No symbols selected for grid.</div>';
        return;
    }

    // Determine grid layout based on number of symbols
    const count = symbols.length;
    let cols, rows;

    if (count === 1) {
        cols = 1; rows = 1;
    } else if (count === 2) {
        cols = 2; rows = 1;
    } else if (count <= 4) {
        cols = 2; rows = 2;
    } else if (count <= 6) {
        cols = 3; rows = 2;
    } else if (count <= 9) {
        cols = 3; rows = 3;
    } else if (count <= 12) {
        cols = 4; rows = 3;
    } else if (count <= 16) {
        cols = 4; rows = 4;
    } else {
        // Auto-fit roughly square
        cols = Math.ceil(Math.sqrt(count));
        rows = Math.ceil(count / cols);
    }

    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    symbols.forEach(symbolFull => {
        const iframe = document.createElement('iframe');
        iframe.src = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbolFull)}&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&saveimage=0&hideideas=1`;
        iframe.allowFullscreen = true;
        container.appendChild(iframe);
    });
}

initGrid();
