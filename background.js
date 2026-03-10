// Symbol Launcher — background.js
// Handles the background rotation of tabs through the selected symbol list

const CHART_BASE = 'https://www.tradingview.com/chart?symbol=';

let rotationState = {
    active: false,
    queue: [],
    originalList: [],
    isLoop: false,
    tabIds: new Set(),
    tabTimers: new Map()
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'START_ROTATION') {
        const { symbols, isLoop } = msg;
        startRotation(symbols, isLoop);
        sendResponse({ success: true });
    }
});

async function startRotation(symbols, isLoop) {
    if (symbols.length === 0) return;

    // Clear any existing state
    rotationState.active = false;
    rotationState.tabTimers.forEach(timer => clearTimeout(timer));
    rotationState.tabTimers.clear();
    rotationState.tabIds.clear();

    rotationState.active = true;
    rotationState.originalList = [...symbols];
    rotationState.queue = [...symbols];
    rotationState.isLoop = isLoop;

    // Open first 2 tabs (or 1 if only 1 selected)
    const sym1 = getNextSymbol();
    const sym2 = getNextSymbol();

    if (sym1) {
        let tab1 = await chrome.tabs.create({ url: CHART_BASE + encodeURIComponent(sym1), active: false });
        rotationState.tabIds.add(tab1.id);
    }
    if (sym2) {
        let tab2 = await chrome.tabs.create({ url: CHART_BASE + encodeURIComponent(sym2), active: false });
        rotationState.tabIds.add(tab2.id);
    }
}

function getNextSymbol() {
    if (rotationState.queue.length > 0) {
        return rotationState.queue.shift();
    } else if (rotationState.isLoop && rotationState.originalList.length > 0) {
        rotationState.queue = [...rotationState.originalList];
        return rotationState.queue.shift();
    }
    return null;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!rotationState.active) return;
    if (!rotationState.tabIds.has(tabId)) return;

    // Wait until the page has finished loading
    if (changeInfo.status === 'complete') {
        // Clear any existing timer for this tab to prevent double-firing
        if (rotationState.tabTimers.has(tabId)) {
            clearTimeout(rotationState.tabTimers.get(tabId));
        }

        // Wait 5 seconds to let TradingView scripts run and WebSocket connections establish
        const timer = setTimeout(() => {
            if (!rotationState.active || !rotationState.tabIds.has(tabId)) return;

            const nextSym = getNextSymbol();
            if (nextSym) {
                // Navigate this existing tab to the next symbol
                chrome.tabs.update(tabId, { url: CHART_BASE + encodeURIComponent(nextSym) });
            } else {
                // List is completely exhausted and loop is off
                rotationState.tabIds.delete(tabId);
                rotationState.tabTimers.delete(tabId);

                if (rotationState.tabIds.size === 0) {
                    rotationState.active = false; // All done
                }
            }
        }, 5000);

        rotationState.tabTimers.set(tabId, timer);
    }
});

// Cleanup completely if the user manually closes one of our managed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
    if (rotationState.tabIds.has(tabId)) {
        rotationState.tabIds.delete(tabId);
        if (rotationState.tabTimers.has(tabId)) {
            clearTimeout(rotationState.tabTimers.get(tabId));
            rotationState.tabTimers.delete(tabId);
        }

        if (rotationState.tabIds.size === 0) {
            rotationState.active = false;
        }
    }
});
