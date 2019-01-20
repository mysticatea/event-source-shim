/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var eventTargetShim = require('event-target-shim');

const LINE = /([^\r\n]*)(?:\r\n|[\r\n])/gu;
const DIGITS = /^[0-9]+$/u;
//istanbul ignore next
const queue = 
/*eslint-disable @mysticatea/prettier */
typeof queueMicrotask === "function" ? queueMicrotask : // Modern browsers
    typeof setImmediate === "function" ? setImmediate : // IE11
        /* otherwise */ (f) => setTimeout(f, 0); // Foolproof
let defaultReconnectionTime = 4000;
let reconnectionTimeIncreasingRate = 1.5;
let maxBufferSize = 64 * 1024;
(function (ReadyState) {
    ReadyState[ReadyState["CONNECTING"] = 0] = "CONNECTING";
    ReadyState[ReadyState["OPEN"] = 1] = "OPEN";
    ReadyState[ReadyState["CLOSED"] = 2] = "CLOSED";
})(exports.ReadyState || (exports.ReadyState = {}));
/**
 * `EventSource` implementation.
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
class EventSource extends eventTargetShim.EventTarget {
    constructor(url, options) {
        super();
        /** The connection has not yet been established, or it was closed and the user agent is reconnecting. */
        this.CONNECTING = exports.ReadyState.CONNECTING;
        /** The user agent has an open connection and is dispatching events as it receives them. */
        this.OPEN = exports.ReadyState.OPEN;
        /** The connection is not open, and the user agent is not trying to reconnect. Either there was a fatal error or the `close()` method was invoked. */
        this.CLOSED = exports.ReadyState.CLOSED;
        createConnection(this, internalSlots.init(this, url, options));
    }
    /** Returns the URL providing the event stream. */
    get url() {
        return internalSlots.get(this).url.href;
    }
    /** Returns true if the credentials mode for connection requests to the URL providing the event stream is set to "include", and false otherwise. */
    get withCredentials() {
        return internalSlots.get(this).withCredentials;
    }
    /** Returns the state of this EventSource object's connection. It can have the values described below. */
    get readyState() {
        return internalSlots.get(this).readyState;
    }
    /**
     * Aborts any instances of the fetch algorithm started for this EventSource object, and sets the readyState attribute to CLOSED.
     */
    close() {
        close(internalSlots.get(this));
    }
}
/** The connection has not yet been established, or it was closed and the user agent is reconnecting. */
EventSource.CONNECTING = exports.ReadyState.CONNECTING;
/** The user agent has an open connection and is dispatching events as it receives them. */
EventSource.OPEN = exports.ReadyState.OPEN;
/** The connection is not open, and the user agent is not trying to reconnect. Either there was a fatal error or the `close()` method was invoked. */
EventSource.CLOSED = exports.ReadyState.CLOSED;
eventTargetShim.defineEventAttribute(EventSource.prototype, "error");
eventTargetShim.defineEventAttribute(EventSource.prototype, "message");
eventTargetShim.defineEventAttribute(EventSource.prototype, "open");
// Set properties and methods enumerable.
Object.defineProperties(EventSource.prototype, {
    url: { enumerable: true },
    withCredentials: { enumerable: true },
    readyState: { enumerable: true },
    close: { enumerable: true },
});
/**
 * Set the default value of reconnection time.
 *
 * The reconnection time is an internal slot of `EventSource` object.
 * It's a user-agent-defined value.
 *
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#concept-event-stream-reconnection-time
 * @param value The value to set.
 */
function setDefaultReconnectionTime(value) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`reconnection time must be a positive number.`);
    }
    defaultReconnectionTime = value;
}
/**
 * Set the default value of reconnection time.
 *
 * The reconnection time is an internal slot of `EventSource` object.
 * It's a user-agent-defined value.
 *
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#concept-event-stream-reconnection-time
 * @param value The value to set.
 */
function setReconnectionTimeIncreasingRate(value) {
    if (!Number.isFinite(value) || value <= 1) {
        throw new Error(`reconnection time's increasing rate must be greater than 1.0.`);
    }
    reconnectionTimeIncreasingRate = value;
}
/**
 * Set the default value of max buffer size.
 *
 * This is constant for implementation details.
 * If the length of `XMLHttpRequest#responseText` became greater than max buffer
 * size, this implementation disconnects and reestablishes in order to clear it.
 *
 * @param value The value to set.
 */
function setMaxBufferSize(value) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`max buffer size must be a positive number.`);
    }
    maxBufferSize = value;
}
// Internal data slots.
const internalSlots = new class {
    constructor() {
        this.map = new WeakMap();
    }
    init(key, url, options) {
        const a = parseURL(url);
        const slots = {
            url: a,
            request: null,
            reconnectionTime: defaultReconnectionTime,
            lastEventId: "",
            withCredentials: Boolean(options && options.withCredentials),
            readyState: exports.ReadyState.CONNECTING,
            additionalReconnectionTime: 0,
        };
        this.map.set(key, slots);
        if (!a.href.startsWith(a.protocol)) {
            throw new Error(`Invalid URL: ${JSON.stringify(url)}`);
        }
        return slots;
    }
    get(key) {
        if (!this.map.has(key)) {
            throw new Error("'this' reference must be a EventSource.");
        }
        return this.map.get(key);
    }
}();
/**
 * Connect to the server.
 * @param source The EventSource object.
 */
function createConnection(source, slots) {
    if (window.navigator.onLine === false) {
        window.addEventListener("online", function listener() {
            window.removeEventListener("online", listener);
            if (slots.readyState !== exports.ReadyState.CLOSED) {
                createConnection(source, slots);
            }
        });
        return;
    }
    const state = {
        origin: "",
        data: "",
        type: "",
        lastEventId: null,
        pos: 0,
    };
    const request = (slots.request = new window.XMLHttpRequest());
    let first = true;
    request.open("GET", source.url, true);
    request.withCredentials = source.withCredentials;
    request.setRequestHeader("Accept", "text/event-stream");
    request.setRequestHeader("Cache-Control", "no-store");
    if (slots.lastEventId) {
        request.setRequestHeader("Last-Event-ID", slots.lastEventId);
    }
    // Process received chunk.
    request.onprogress = () => {
        if (slots.readyState === exports.ReadyState.CLOSED || request.status === 0) {
            return;
        }
        // Verify the connection if it's first time.
        if (first) {
            first = false;
            const { status, responseURL } = request;
            const contentType = request.getResponseHeader("Content-Type");
            if (status === 200 &&
                contentType != null &&
                contentType.toLowerCase().startsWith("text/event-stream")) {
                // Known Limitation:
                //   IE11 doesn't support `responseURL`. In that case, we cannot
                //   get the final URL, so it uses the request URL.
                const a = responseURL ? parseURL(responseURL) : slots.url;
                state.origin = `${a.protocol}//${a.host}`;
                announceConnection(source, slots);
            }
            else {
                failConnection(source, slots);
                return;
            }
        }
        // Handle events.
        parseStream(source, slots, state, request.responseText);
        // Clear `xhr.responseText` if it's longer than `maxBufferSize`, in
        // order to prevent memory leaks.
        if (request.responseText.length > maxBufferSize) {
            request.abort();
        }
    };
    // Reestablish the connection on 200 OK.
    // Otherwise, fail the connection.
    request.onload = () => {
        if (slots.readyState === exports.ReadyState.CLOSED || request.status === 0) {
            return;
        }
        slots.request = null;
        if (request.status === 200) {
            reestablishConnection(source, slots);
        }
        if (request.status === 204 && first) {
            failConnection(source, slots);
        }
    };
    // Restablish the connection on networking error.
    request.onerror = () => {
        if (slots.readyState !== exports.ReadyState.CLOSED) {
            slots.request = null;
            reestablishConnection(source, slots);
        }
    };
    // Reconnect on abort.
    request.onabort = () => {
        if (slots.readyState !== exports.ReadyState.CLOSED) {
            slots.request = null;
            createConnection(source, slots);
        }
    };
    request.send();
}
/**
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#announce-the-connection
 */
function announceConnection(source, slots) {
    queue(() => {
        if (slots.readyState !== exports.ReadyState.CLOSED) {
            slots.readyState = exports.ReadyState.OPEN;
            source.dispatchEvent(createEvent("open"));
        }
    });
    // Update additional reconnection time.
    slots.additionalReconnectionTime = 0;
}
/**
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#reestablish-the-connection
 */
function reestablishConnection(source, slots) {
    queue(() => {
        if (slots.readyState !== exports.ReadyState.CLOSED) {
            slots.readyState = exports.ReadyState.CONNECTING;
            source.dispatchEvent(createEvent("error"));
        }
    });
    setTimeout(() => {
        queue(() => {
            if (slots.readyState === exports.ReadyState.CONNECTING) {
                createConnection(source, slots);
            }
        });
    }, slots.reconnectionTime + slots.additionalReconnectionTime);
    // Update additional reconnection time.
    slots.additionalReconnectionTime =
        reconnectionTimeIncreasingRate *
            (slots.reconnectionTime + slots.additionalReconnectionTime) -
            slots.reconnectionTime;
}
/**
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#fail-the-connection
 */
function failConnection(source, slots) {
    queue(() => {
        if (slots.readyState !== exports.ReadyState.CLOSED) {
            close(slots);
            source.dispatchEvent(createEvent("error"));
        }
    });
}
/**
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream
 */
function parseStream(source, slots, state, buffer) {
    let match;
    LINE.lastIndex = state.pos;
    while ((match = LINE.exec(buffer)) != null) {
        state.pos = LINE.lastIndex;
        const line = match[1];
        const colonPos = line.indexOf(":");
        if (line === "") {
            dispatchMessage(source, slots, state);
        }
        else if (colonPos === -1) {
            processField(slots, state, line, "");
        }
        else if (colonPos >= 1) {
            const name = line.slice(0, colonPos);
            const value = line.slice(colonPos + (line[colonPos + 1] === " " ? 2 : 1));
            processField(slots, state, name, value);
        }
    }
}
/**
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#processField
 */
function processField(slots, state, fieldName, fieldValue) {
    switch (fieldName.toLowerCase()) {
        case "event":
            state.type = fieldValue;
            break;
        case "data":
            state.data += fieldValue;
            state.data += "\n";
            break;
        case "id":
            if (!fieldValue.includes("\u0000")) {
                state.lastEventId = fieldValue;
            }
            break;
        case "retry":
            if (DIGITS.test(fieldValue)) {
                slots.reconnectionTime = parseInt(fieldValue, 10);
            }
            break;
        // no default
    }
}
/**
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#dispatchMessage
 */
function dispatchMessage(source, slots, state) {
    const { data, type, lastEventId } = state;
    state.data = state.type = "";
    if (lastEventId != null) {
        slots.lastEventId = lastEventId;
    }
    if (data === "") {
        return;
    }
    const event = createMessageEvent(type || "message", data.slice(0, -1), state.origin, slots.lastEventId);
    queue(() => {
        if (slots.readyState !== exports.ReadyState.CLOSED) {
            source.dispatchEvent(event);
        }
    });
}
/**
 * Close the connection.
 */
function close(slots) {
    const { request } = slots;
    slots.readyState = exports.ReadyState.CLOSED;
    slots.request = null;
    if (request) {
        request.abort();
    }
}
/**
 * Create an `Event` object.
 */
/*istanbul ignore next */
function createEvent(type) {
    try {
        return new window.Event(type, { bubbles: false, cancelable: false });
    }
    catch (_a) {
        // For IE11
        const event = window.document.createEvent("Event");
        event.initEvent(type, false, false);
        return event;
    }
}
/**
 * Create an `MessageEvent` object.
 */
/*istanbul ignore next */
function createMessageEvent(type, data, origin, lastEventId) {
    try {
        return new window.MessageEvent(type, {
            bubbles: false,
            cancelable: false,
            data,
            lastEventId,
            origin,
            source: window,
        });
    }
    catch (_a) {
        // For IE11
        const event = window.document.createEvent("MessageEvent");
        event.initMessageEvent(type, false, false, data, origin, lastEventId, window);
        return event;
    }
}
/**
 * Parse and resolve URL.
 */
function parseURL(url) {
    const a = window.document.createElement("a");
    a.href = url;
    return a;
}

exports.EventSource = EventSource;
exports.setDefaultReconnectionTime = setDefaultReconnectionTime;
exports.setReconnectionTimeIncreasingRate = setReconnectionTimeIncreasingRate;
exports.setMaxBufferSize = setMaxBufferSize;
//# sourceMappingURL=event-source.js.map
