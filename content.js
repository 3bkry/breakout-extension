// The content script runs in the isolated extension environment.
// We need to inject a script into the main page environment to override the native WebSocket.

function injectScript(file_path) {
    var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', file_path);
    (document.head || document.documentElement).appendChild(s);
}

// Inject inject.js into the DOM so it runs in the page's context
injectScript(chrome.runtime.getURL('inject.js'));

// Listen for messages from the injected script
window.addEventListener("message", function (event) {
    // We only accept messages from ourselves
    if (event.source != window)
        return;

    if (event.data.type && (event.data.type == "FROM_PAGE_WS_INTERCEPT")) {
        const payload = event.data.payload;
        const isOutgoing = event.data.isOutgoing;

        // Skip heartbeat/ping messages (~h~)
        if (typeof payload === 'string' && payload.includes('~h~')) {
            return;
        }

        // Log in the extension context
        console.log(`[Extension Content] Intercepted ${isOutgoing ? 'outgoing' : 'incoming'} WS msg:`, payload);

        // Forward the message to the local server
        forwardToLocalServer(payload, isOutgoing);
    }
}, false);

function forwardToLocalServer(message, isOutgoing) {
    const url = "https://breakout-alert.vercel.app/api/tradingview/listen";
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol');

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            direction: isOutgoing ? 'outgoing' : 'incoming',
            timestamp: new Date().toISOString(),
            payload: message,
            symbol: symbol
        })
    }).then(async (res) => {
        if (!res.ok) {
            const errText = await res.text();
            console.error("[Trading Breakout] API Failed with status:", res.status, errText);
        } else {
            console.log("[Trading Breakout] Successfully sent to Vercel.");
        }
    }).catch(err => {
        console.error("[Trading Breakout] Fetch exception:", err);
    });
}
