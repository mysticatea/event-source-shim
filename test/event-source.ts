import assert from "assert"
import { Connection, MockControlClient } from "../scripts/mock-control-client"
import {
    EventSource,
    setDefaultReconnectionTime,
    setMaxBufferSize,
    // setReconnectionTimeIncreasingRate,
} from "../src/event-source"

/*globals server */
declare global {
    const server: MockControlClient
}

const eventURL = `${server.url}events`

describe("EventSource", () => {
    let source: EventSource

    before(() => {
        // reduce time to test.
        setDefaultReconnectionTime(100)
        setMaxBufferSize(4 * 1024)
    })

    afterEach(() => {
        if (source) {
            source.close()
        }
    })

    describe("constructor", () => {
        it("should throw an error if `url` is an invalid URL.", () => {
            assert.throws(() => {
                source = new EventSource("//:::::::::::")
            }, /Invalid URL/u)
        })
    })

    describe("`url` property", () => {
        it("should be resolved URL.", () => {
            source = new EventSource("/foo")
            assert.strictEqual(
                source.url,
                `${window.location.protocol}//${window.location.host}/foo`,
            )
        })
    })

    describe("`withCredentials` property", () => {
        it("should be a given value.", () => {
            source = new EventSource(eventURL, { withCredentials: true })
            assert.strictEqual(source.withCredentials, true)
        })

        it("should be false by default.", () => {
            source = new EventSource(eventURL)
            assert.strictEqual(source.withCredentials, false)
        })
    })

    describe("`readyState` property", () => {
        it("should be CONNECTING initially.", () => {
            source = new EventSource(eventURL)
            assert.strictEqual(source.readyState, source.CONNECTING)
        })

        it("should be OPEN after `open` event.", async () => {
            await server.waitForConnection(async () => {
                source = new EventSource(eventURL)
                await waitForEvent(source, "open")
            })
            assert.strictEqual(source.readyState, source.OPEN)
        })

        it("should be CLOSED after `close()` method was invoked.", async () => {
            await server.waitForConnection(async () => {
                source = new EventSource(eventURL)
                await waitForEvent(source, "open")
            })
            source.close()
            assert.strictEqual(source.readyState, source.CLOSED)
        })

        it("should be CLOSED after `close()` method was invoked immediately.", async () => {
            let ok = false
            const serverRequestReceivedPromise = server.waitForConnection(
                () => {
                    source = new EventSource(eventURL)
                    source.close()
                    assert.strictEqual(source.readyState, source.CLOSED)
                    ok = true
                },
            )

            // Server doesn't receive any request.
            await assertReject(serverRequestReceivedPromise, /timeout/u)
            assert(ok)
        })

        it("should be CLOSED when the server responded 500 Internal Server Error.", async () => {
            await server.waitForConnection(async () => {
                source = new EventSource(`${eventURL}?status=500`)
                await waitForEvent(source, "error")
            })
            assert.strictEqual(source.readyState, source.CLOSED)
        })

        it("should be CLOSED when the server responded 400 Bad Request.", async () => {
            await server.waitForConnection(async () => {
                source = new EventSource(`${eventURL}?status=400`)
                await waitForEvent(source, "error")
            })
            assert.strictEqual(source.readyState, source.CLOSED)
        })

        it("should be CLOSED when the server responded 204 No Content.", async () => {
            await server.waitForConnection(async () => {
                source = new EventSource(`${eventURL}?status=204`)
                await waitForEvent(source, "error")
            })
            assert.strictEqual(source.readyState, source.CLOSED)
        })

        it("should be CLOSED when the server responded unexpected content type.", async () => {
            await server.waitForConnection(async () => {
                source = new EventSource(`${eventURL}?type=application/json`)
                await waitForEvent(source, "error")
            })
            assert.strictEqual(source.readyState, source.CLOSED)
        })

        it("should be CONNECTING after `error` event if the connection is valid.", async () => {
            const connection = await server.waitForConnection(() => {
                source = new EventSource(eventURL)
            })

            await Promise.all([connection.end(), waitForEvent(source, "error")])
            assert.strictEqual(source.readyState, source.CONNECTING)
        })
    })

    describe("`close()` method", () => {
        it("should disconnect it.", async () => {
            const connection = await server.waitForConnection(() => {
                source = new EventSource(eventURL)
            })

            await connection.waitForDisconnection(() => {
                source.close()
            })
        })

        it("should not reestablish the connection after closed.", async () => {
            await server.waitForConnection(() => {
                source = new EventSource(eventURL)
            })

            await assertReject(
                server.waitForConnection(() => {
                    source.close()
                }),
                /timeout/u,
            )
        })

        it("should throw error when was invoked on another object.", () => {
            source = new EventSource(eventURL)
            assert.throws(
                () => source.close.call({}),
                /'this' reference must be a EventSource/u,
            )
        })
    })

    describe("about events", () => {
        let connection: Connection

        beforeEach(async () => {
            connection = await server.waitForConnection(() => {
                source = new EventSource(eventURL)
            })
        })

        describe("(misc)", () => {
            it("should send GET request.", () => {
                assert.strictEqual(connection.method, "GET")
            })

            it("should send `Accept` header with `text/event-stream`.", () => {
                assert.strictEqual(
                    connection.headers.accept,
                    "text/event-stream",
                )
            })

            it("should send `Cache-Control` header with `no-store`.", () => {
                assert.strictEqual(
                    connection.headers["cache-control"],
                    "no-store",
                )
            })

            it("should not send `Last-Event-ID` header at first time.", () => {
                assert.strictEqual(
                    connection.headers["last-event-id"],
                    undefined,
                )
            })

            it("should send to a given path.", () => {
                assert.strictEqual(connection.path, "/events")
            })

            it("should normalize line endings to LF.", async () => {
                const [, event] = await Promise.all([
                    connection.write(
                        "data: one\r\ndata:two\rdata: three\n\r\n",
                    ),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "one\ntwo\nthree")
            })

            it("should ignore BOM at the first.", async () => {
                source.close()
                connection = await server.waitForConnection(() => {
                    source = new EventSource(`${eventURL}?bom=true`)
                })

                const [, event] = await Promise.all([
                    connection.write("data: one\r\n\r"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "one")
            })

            it("should ignore comments.", async () => {
                const [, event] = await Promise.all([
                    connection.write(
                        ":this is comment.\ndata: test\n:this is comment.\n\n",
                    ),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "test")
            })

            it("should unknown fields.", async () => {
                const [, event] = await Promise.all([
                    connection.write(
                        "data: test\nunknown: this is comment.\nunknown\n\n",
                    ),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "test")
            })
        })

        describe("(data field)", () => {
            it("should not emit a message event when a `data` field didn't exist.", async () => {
                await connection.write(": comment\nunknown: aaa\n\n")
                await assertReject(waitForEvent(source, "message"), /timeout/u)
            })

            it("should emit a message event when a `data` field existed.", async () => {
                const [, event] = await Promise.all([
                    connection.write("data: test\n\n"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "test")
            })

            it("should emit a message event when a `data` field existed even if it's empty.", async () => {
                const [, event] = await Promise.all([
                    connection.write("data\n\n"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "")
            })

            it("should concatenate multiple `data` fields by LF.", async () => {
                const [, event] = await Promise.all([
                    connection.write("data: one\ndata:two\ndata: three\n\n"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "one\ntwo\nthree")
            })

            it("should concatenate multiple `data` fields by LF even if those are empty.", async () => {
                const [, event] = await Promise.all([
                    connection.write("data\ndata\n\n"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "\n")
            })

            it("should emit two message events when two event blocks existed.", async () => {
                const [, events] = await Promise.all([
                    connection.write(
                        "data: one\n\ndata: two\n\ndata: three\n\n",
                    ),
                    waitForEvents(source, "message", 3),
                ])

                assert.strictEqual(events[0].data, "one")
                assert.strictEqual(events[1].data, "two")
                assert.strictEqual(events[2].data, "three")
            })
        })

        describe("(id field)", () => {
            it("should not set `event.lastEventId` when an `id` field didn't exist.", async () => {
                const [, event] = await Promise.all([
                    connection.write("data: test\n\n"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "test")
                assert.strictEqual(event.lastEventId, "")
            })

            it("should set `event.lastEventId` when an `id` field existed.", async () => {
                const [, event] = await Promise.all([
                    connection.write("data: test\nid: 1234\n\n"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "test")
                assert.strictEqual(event.lastEventId, "1234")
            })

            it("should set `event.lastEventId` when an `id` field existed (another order).", async () => {
                const [, event] = await Promise.all([
                    connection.write("id: 1234\ndata: test\n\n"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "test")
                assert.strictEqual(event.lastEventId, "1234")
            })

            it("should ignore the `id` field if it contains null character.", async () => {
                const [, event] = await Promise.all([
                    connection.write("data: test\nid: 12\u000034\n\n"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "test")
                assert.strictEqual(event.lastEventId, "")
            })

            it("should clear `event.lastEventId` when an empty `id` field existed.", async () => {
                const [, events] = await Promise.all([
                    connection.write(
                        "data: one\nid: 1234\n\ndata: two\nid\n\n",
                    ),
                    waitForEvents(source, "message", 2),
                ])

                assert.strictEqual(events[0].data, "one")
                assert.strictEqual(events[0].lastEventId, "1234")
                assert.strictEqual(events[1].data, "two")
                assert.strictEqual(events[1].lastEventId, "")
            })

            it("should not clear `event.lastEventId` when `id` field didn't exist after set.", async () => {
                const [, events] = await Promise.all([
                    connection.write("data: one\nid: 1234\n\ndata: two\n\n"),
                    waitForEvents(source, "message", 2),
                ])

                assert.strictEqual(events[0].data, "one")
                assert.strictEqual(events[0].lastEventId, "1234")
                assert.strictEqual(events[1].data, "two")
                assert.strictEqual(events[1].lastEventId, "1234")
            })

            it("should send `Last-Event-ID` header when reestablish after set.", async () => {
                await Promise.all([
                    connection.write("data: one\nid: 1234\n\n"),
                    waitForEvent(source, "message"),
                ])

                connection = await server.waitForConnection(async () => {
                    await connection.end()
                })

                assert.strictEqual(connection.headers["last-event-id"], "1234")
            })

            it("should keep last event ID over reestablish.", async () => {
                await Promise.all([
                    connection.write("data: one\nid: 1234\n\n"),
                    waitForEvent(source, "message"),
                ])

                connection = await server.waitForConnection(async () => {
                    await connection.end()
                })

                const [, event] = await Promise.all([
                    connection.write("data: two\n\n"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.data, "two")
                assert.strictEqual(event.lastEventId, "1234")
            })

            it("should respect `id` field even if `data` field didn't exist.", async () => {
                await connection.write("id: 1234\n\n")
                await delay(100) // We cannot detect the completion of the event block.

                connection = await server.waitForConnection(async () => {
                    await connection.end()
                })

                assert.strictEqual(connection.headers["last-event-id"], "1234")
            })
        })

        describe("(event field)", () => {
            it("should emit a hello event when an `event` field was hello.", async () => {
                const [, event] = await Promise.all([
                    connection.write("data: hey\nevent:hello\n\n"),
                    waitForEvent(source, "hello"),
                ])

                assert.strictEqual(event.type, "hello")
                assert.strictEqual(event.data, "hey")
            })

            it("should emit a hello event when an `event` field was hello (another order).", async () => {
                const [, event] = await Promise.all([
                    connection.write("event:hello\ndata: hey\n\n"),
                    waitForEvent(source, "hello"),
                ])

                assert.strictEqual(event.type, "hello")
                assert.strictEqual(event.data, "hey")
            })

            it("should not affect to following event blocks.", async () => {
                const [, ...events] = await Promise.all([
                    connection.write(
                        "data: one\nevent: hello\n\ndata: two\n\n",
                    ),
                    waitForEvent(source, "hello"),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(events[0].type, "hello")
                assert.strictEqual(events[0].data, "one")
                assert.strictEqual(events[1].type, "message")
                assert.strictEqual(events[1].data, "two")
            })

            it("should not affect to following event blocks (when no data field).", async () => {
                const [, , event] = await Promise.all([
                    connection.write("event: hello\n\ndata: two\n\n"),
                    assertReject(waitForEvent(source, "hello"), /timeout/u),
                    waitForEvent(source, "message"),
                ])

                assert.strictEqual(event.type, "message")
                assert.strictEqual(event.data, "two")
            })
        })

        describe("(retry field)", () => {
            it("should change the interval to reestablish the connection when a `retry` field existed.", async () => {
                await connection.write("id:123\nretry:450\n\n")
                await delay(100) // We cannot detect the completion of the event block.

                // disconnect
                await connection.end()
                // will not reestablish by 300ms
                await assertReject(
                    server.waitForConnection(noop, 300),
                    /timeout/u,
                )
                // will reestablish by next 300ms
                connection = await server.waitForConnection(noop, 300)

                assert.strictEqual(connection.headers["last-event-id"], "123")
            })

            it("should ignore `retry` field if it contains non digit character.", async () => {
                await connection.write("id:123\nretry:450x\n\n")
                await delay(100) // We cannot detect the completion of the event block.

                // disconnect
                await connection.end()
                // will reestablish by 300ms
                connection = await server.waitForConnection(noop, 300)

                assert.strictEqual(connection.headers["last-event-id"], "123")
            })
        })
    })

    describe("(misc)", () => {
        it("should have expected enumerable properties", () => {
            const expected = new Set([
                "CONNECTING",
                "OPEN",
                "CLOSED",
                "url",
                "withCredentials",
                "readyState",
                "onopen",
                "onmessage",
                "onerror",
                "close",
                "addEventListener",
                "removeEventListener",
                "dispatchEvent",
            ])

            source = new EventSource(eventURL)

            //eslint-disable-next-line @mysticatea/prefer-for-of
            for (const key in source) {
                assert(
                    expected.delete(key),
                    `Unexpected "${key}" property was found.`,
                )
            }

            const key = Array.from(expected)[0]
            assert.strictEqual(
                expected.size,
                0,
                `Expected "${key}" property was not found.`,
            )
        })

        it("should reestablish on networking errors.", async () => {
            // First contact.
            let connection = await server.waitForConnection(() => {
                source = new EventSource(eventURL)
            })
            let [, event] = await Promise.all([
                connection.write("retry:1000\ndata:one\n\n"),
                waitForEvent(source, "message"),
            ])
            assert.strictEqual(event.data, "one")

            // Server down.
            await Promise.all([
                server.stop(),
                waitForEvent(source, "error", 5000), // detected the down.
            ])
            await waitForEvent(source, "error", 5000) // faild to reestablish the connection by ECONREFUSED.

            // Server restart.
            connection = await server.waitForConnection(async () => {
                await server.restart()
            }, 5000) // completed to reestablish the connection.

            // Second contact.
            ;[, event] = await Promise.all([
                connection.write("data:two\n\n"),
                waitForEvent(source, "message"),
            ])
            assert.strictEqual(event.data, "two")
        })

        it("should disconnect and reestablish the connection when the buffer was overflowed.", async () => {
            // Write 2KB data (total size with initial paddings is 4KB and a bit).
            let connection = await server.waitForConnection(() => {
                source = new EventSource(eventURL)
            })
            await Promise.all<any>([
                ...Array.from({ length: 31 }, () =>
                    connection.write(
                        "data: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx!\n\n",
                    ),
                ),
                waitForEvents(source, "message", 31),
            ])

            // Write the final one, then wait for reconnection.
            ;[connection] = await Promise.all([
                server.waitForConnection(async () => {
                    await connection.write(
                        "data: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx!\n\n",
                    )
                }),
                waitForEvent(source, "message"),
            ])

            // Can continue to write.
            const [, event] = await Promise.all([
                connection.write("data:two\n\n"),
                waitForEvent(source, "message"),
            ])
            assert.strictEqual(event.data, "two")
        })

        it("should wait for online event if offline.", async () => {
            const controller = new OfflineController()
            try {
                controller.makeOffline()

                // Don't receive connection...
                await assertReject(
                    server.waitForConnection(() => {
                        source = new EventSource(eventURL)
                    }, 2000),
                    /timeout/u,
                )

                // Receive connection on line.
                const connection = await server.waitForConnection(() => {
                    controller.makeOnline()
                })

                const [, event] = await Promise.all([
                    connection.write("data:one\r\r"),
                    waitForEvent(source, "message"),
                ])
                assert.strictEqual(event.data, "one")
            } finally {
                controller.dispose()
            }
        })

        it("should not connect to the server if closed before online.", async () => {
            const controller = new OfflineController()
            try {
                controller.makeOffline()

                // Don't receive connection...
                await assertReject(
                    server.waitForConnection(() => {
                        source = new EventSource(eventURL)
                    }, 2000),
                    /timeout/u,
                )

                // Close it.
                source.close()

                // Don't receive connection...
                await assertReject(
                    server.waitForConnection(() => {
                        controller.makeOnline()
                    }, 2000),
                    /timeout/u,
                )
            } finally {
                controller.dispose()
            }
        })
    })
})

describe("setDefaultReconnectionTime", () => {
    // TBD
})

describe("setMaxBufferSize", () => {
    // TBD
})

describe("setReconnectionTimeIncreasingRate", () => {
    // TBD
})

/**
 * Wait while given milliseconds.
 */
function delay(timeout: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, timeout))
}

/**
 * Wait for a given event on a given `EventSource` object.
 * @param source The `EventSource` object to watch.
 * @param type The event type to watch.
 */
async function waitForEvent<TEventType extends string>(
    source: EventSource,
    type: TEventType,
    timeout?: number,
): Promise<TEventType extends "open" | "error" ? Event : MessageEvent> {
    return (await waitForEvents(source, type, 1, timeout))[0]
}

/**
 * Wait for multiple event of a given type on a given `EventSource` object.
 * @param source The `EventSource` object to watch.
 * @param type The event type to watch.
 * @param count The number of events to wait.
 */
function waitForEvents<TEventType extends string>(
    source: EventSource,
    type: TEventType,
    count: number,
    timeout = 500 + count * 500,
): Promise<(TEventType extends "open" | "error" ? Event : MessageEvent)[]> {
    return new Promise((resolve, reject) => {
        const events: any[] = []

        const eventListener = (event: any) => {
            events.push(event)
            if (events.length >= count) {
                dispose()
                resolve(events)
            }
        }

        const errorListener = () => {
            dispose()
            reject(new Error("'error' event happened."))
        }

        const timer = setTimeout(() => {
            dispose()
            reject(new Error("timeout"))
        }, timeout)

        const dispose = () => {
            source.removeEventListener(type, eventListener)
            source.removeEventListener("error", errorListener)
            clearTimeout(timer)
        }

        source.addEventListener(type, eventListener)
        if (type !== "error") {
            source.addEventListener("error", errorListener)
        }
    })
}

async function assertReject(
    promise: Promise<any>,
    messagePattern: RegExp,
): Promise<void> {
    try {
        await promise
    } catch (error) {
        assert(
            messagePattern.test(error.message),
            `The error message didn't satisfy ${messagePattern}: ${JSON.stringify(
                error.message,
            )}`,
        )
        return
    }
    assert.fail("The promise should be rejected, but fulfilled.")
}

class OfflineController {
    private readonly original = Object.getOwnPropertyDescriptor(
        window.navigator,
        "onLine",
    )
    private onLine = window.navigator.onLine

    public constructor() {
        Object.defineProperty(window.navigator, "onLine", {
            configurable: true,
            get: () => this.onLine,
        })
    }

    public makeOnline(): void {
        if (this.onLine !== true) {
            this.onLine = true
            window.dispatchEvent(createEvent("online"))
        }
    }

    public makeOffline(): void {
        if (this.onLine !== false) {
            this.onLine = false
            window.dispatchEvent(createEvent("offline"))
        }
    }

    public dispose(): void {
        if (this.original) {
            Object.defineProperty(window.navigator, "onLine", this.original)
        } else {
            // @ts-ignore
            delete window.navigator.onLine
        }
    }
}

/**
 * Create an `Event` object.
 */
function createEvent(type: string): Event {
    try {
        return new window.Event(type, { bubbles: false, cancelable: false })
    } catch {
        // For IE11
        const event = window.document.createEvent("Event")
        event.initEvent(type, false, false)
        return event
    }
}

function noop() {
    // do nothing.
}
