import { EventSource } from "./dist/event-source"

const global = typeof window !== "undefined" ? window : null
if (global != null && global.EventSource == null) {
    global.EventSource = EventSource
}
