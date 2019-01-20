import path from "path"
import { JSDOM } from "jsdom"
import Mocha from "mocha"
import { MockControlServer } from "./mock-control-server"
import { MockControlClient } from "./mock-control-client"

//eslint-disable-next-line no-shadow
;(async (global: any) => {
    // Setup mock server
    const server = await MockControlServer.start()
    try {
        // Setup JSDOM
        global.window = new JSDOM("", { url: server.serverURL }).window
        global.server = new MockControlClient(server)

        // Setup mocha
        const mocha = new Mocha({ growl: true, timeout: 15000 })
        mocha.addFile(path.resolve(__dirname, "../test/event-source.ts"))

        // Run mocha
        const failures = await new Promise(resolve => mocha.run(resolve))
        process.exitCode = failures ? 1 : 0
    } finally {
        server.stop()
    }
})(global).catch(error => {
    console.error(error)
    process.exitCode = 1
})
