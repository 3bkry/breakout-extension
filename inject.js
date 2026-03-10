// This script runs in the main page context, so it has access to the actual window.WebSocket object

(function () {
    // Save the original WebSocket constructor
    const OriginalWebSocket = window.WebSocket;

    // The target URL pattern to intercept
    const TARGET_WS_URL = "data.tradingview.com/socket.io/websocket";

    // Create a proxy constructor
    window.WebSocket = function (url, protocols) {
        let ws;
        if (protocols) {
            ws = new OriginalWebSocket(url, protocols);
        } else {
            ws = new OriginalWebSocket(url);
        }

        // Check if this is the websocket we want to intercept
        // Loosen to match anything pointing to their data servers
        const shouldIntercept = typeof url === 'string' && (url.includes('data.tradingview.com') || url.includes('socket.io') || url.includes('prodata'));

        if (shouldIntercept) {
            console.log("[Trading Breakout] Intercepted new WebSocket connection to:", url);

            // We need to proxy the send method to capture outgoing messages
            const originalSend = ws.send;
            ws.send = function () {
                // Send a copy to the content script
                try {
                    window.postMessage({
                        type: "FROM_PAGE_WS_INTERCEPT",
                        payload: arguments[0],
                        isOutgoing: true
                    }, "*");
                } catch (e) {
                    console.error("[Trading Breakout] Error posting outgoing message:", e);
                }

                // Call the original send
                return originalSend.apply(this, arguments);
            };

            // We need to capture incoming messages
            // By using addEventListener, we don't interfere with the page's own onmessage assignments
            ws.addEventListener('message', function (event) {
                try {
                    window.postMessage({
                        type: "FROM_PAGE_WS_INTERCEPT",
                        payload: event.data,
                        isOutgoing: false
                    }, "*");
                } catch (e) {
                    console.error("[Trading Breakout] Error posting incoming message:", e);
                }
            });
        }

        return ws;
    };

    // Attempt to make our proxied WebSocket look like the original
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

    console.log("[Trading Breakout] Native WebSocket constructor completely overridden.");
})();
