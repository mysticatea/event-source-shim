"use strict"

const global = typeof window !== "undefined" ? window : null
if (global != null && global.EventSource == null) {
    global.EventSource = require("./dist/event-source")
}
