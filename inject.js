// This script runs in the main page context, so it has access to the actual window.WebSocket object

(function () {
    // Save the original WebSocket constructor
    const OriginalWebSocket = window.WebSocket;

    // The target URL pattern to intercept
    const TARGET_WS_URL = "data.tradingview.com/socket.io/websocket";

    // Aggressive hook of the prototype as well (to survive framework caching)
    const originalProtoSend = OriginalWebSocket.prototype.send;
    OriginalWebSocket.prototype.send = function () {
        if (!this.__proxied) {
            setupSocketInterception(this, this.url);
        }
        return originalProtoSend.apply(this, arguments);
    };

    function setupSocketInterception(ws, url) {
        if (ws.__proxied) return;

        const shouldIntercept = typeof url === 'string' &&
            (url.includes('data.tradingview.com') || url.includes('socket.io') || url.includes('prodata'));

        if (!shouldIntercept) return;
        ws.__proxied = true;

        console.log("[Trading Breakout] Intercepted active WebSocket to:", url);

        // Capture incoming messages
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

        // Capture outgoing messages 
        // We hooked the prototype, but we can also hook the instance just in case
        const originalInstanceSend = ws.send;
        ws.send = function () {
            try {
                window.postMessage({
                    type: "FROM_PAGE_WS_INTERCEPT",
                    payload: arguments[0],
                    isOutgoing: true
                }, "*");
            } catch (e) {
                console.error("[Trading Breakout] Error posting outgoing message:", e);
            }
            return originalInstanceSend.apply(this, arguments);
        };
    }

    // Create a proxy constructor
    window.WebSocket = function (url, protocols) {
        let ws;
        if (protocols) {
            ws = new OriginalWebSocket(url, protocols);
        } else {
            ws = new OriginalWebSocket(url);
        }

        setupSocketInterception(ws, url);
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
