import { EventTarget } from "event-target-shim";
declare type Events = {
    error: Event;
    message: MessageEvent;
    open: Event;
};
declare type EventAttributes = {
    onerror: Event;
    onmessage: MessageEvent;
    onopen: Event;
};
/**
 * Constants for `readyState` property.
 */
export declare const enum ReadyState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSED = 2
}
/**
 * `EventSource` implementation.
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
export declare class EventSource extends EventTarget<Events, EventAttributes, "standard"> {
    /** The connection has not yet been established, or it was closed and the user agent is reconnecting. */
    static readonly CONNECTING = ReadyState.CONNECTING;
    /** The user agent has an open connection and is dispatching events as it receives them. */
    static readonly OPEN = ReadyState.OPEN;
    /** The connection is not open, and the user agent is not trying to reconnect. Either there was a fatal error or the `close()` method was invoked. */
    static readonly CLOSED = ReadyState.CLOSED;
    /** The connection has not yet been established, or it was closed and the user agent is reconnecting. */
    readonly CONNECTING = ReadyState.CONNECTING;
    /** The user agent has an open connection and is dispatching events as it receives them. */
    readonly OPEN = ReadyState.OPEN;
    /** The connection is not open, and the user agent is not trying to reconnect. Either there was a fatal error or the `close()` method was invoked. */
    readonly CLOSED = ReadyState.CLOSED;
    /** Returns the URL providing the event stream. */
    readonly url: string;
    /** Returns true if the credentials mode for connection requests to the URL providing the event stream is set to "include", and false otherwise. */
    readonly withCredentials: boolean;
    /** Returns the state of this EventSource object's connection. It can have the values described below. */
    readonly readyState: ReadyState;
    constructor(url: string, options?: EventSourceInit);
    /**
     * Aborts any instances of the fetch algorithm started for this EventSource object, and sets the readyState attribute to CLOSED.
     */
    close(): void;
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
export declare function setDefaultReconnectionTime(value: number): void;
/**
 * Set the default value of reconnection time.
 *
 * The reconnection time is an internal slot of `EventSource` object.
 * It's a user-agent-defined value.
 *
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#concept-event-stream-reconnection-time
 * @param value The value to set.
 */
export declare function setReconnectionTimeIncreasingRate(value: number): void;
/**
 * Set the default value of max buffer size.
 *
 * This is constant for implementation details.
 * If the length of `XMLHttpRequest#responseText` became greater than max buffer
 * size, this implementation disconnects and reestablishes in order to clear it.
 *
 * @param value The value to set.
 */
export declare function setMaxBufferSize(value: number): void;
export {};
