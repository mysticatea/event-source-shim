import assert from "assert"
import { ServerResponse } from "http"
import { AddressInfo } from "net"
import stream from "stream"
import fastify, { FastifyInstance } from "fastify"
import cors from "fastify-cors"
import { makeClosable } from "./make-closable"

/**
 * Mock server for tests.
 */
export class MockServer {
    private onRequest: ((connection: Connection) => void) | null = null
    private port = 0
    private core: FastifyInstance | null = null

    /**
     * Start a new mock server.
     */
    public static start(): Promise<MockServer> {
        return new MockServer().initServer()
    }

    /**
     * The URL of the server.
     */
    public get url(): string {
        return `http://localhost:${this.port}/`
    }

    /**
     * Wait for connection.
     */
    public waitForConnection(timeout = 1000): Promise<Connection> {
        return new Promise<Connection>((resolve, reject) => {
            this.onRequest = resolve
            setTimeout(() => {
                if (this.onRequest === resolve) {
                    this.onRequest = null
                    reject(new Error("timeout"))
                }
            }, timeout)
        })
    }

    /**
     * Stop the server.
     */
    public stop(): Promise<void> {
        return new Promise(resolve => {
            const { core } = this
            this.core = null

            if (core) {
                core.close(resolve)
            } else {
                resolve()
            }
        })
    }

    /**
     * Restart the server.
     */
    public async restart(): Promise<void> {
        if (this.core == null) {
            await this.initServer()
        }
    }

    //eslint-disable-next-line no-useless-constructor
    private constructor() {
        // Do nothing.
    }

    private initServer(): Promise<MockServer> {
        assert(this.core == null)

        const core = (this.core = fastify()
            .register(cors)
            .get<
                { bom: boolean; status: number; type: string },
                { path: string }
            >(
                "/:path",
                {
                    schema: {
                        params: {
                            path: { type: "string" },
                        },
                        querystring: {
                            bom: { type: "boolean" },
                            status: { type: "integer" },
                            type: { type: "string" },
                        },
                    },
                },
                (req, res) => {
                    if (this.core !== core) {
                        res.status(503).send()
                        return
                    }

                    const { onRequest } = this
                    this.onRequest = null

                    if (onRequest == null) {
                        console.error(`Unexpected request: GET ${req.req.url}`)
                        res.status(500).send()
                        return
                    }

                    const {
                        bom = false,
                        status = 200,
                        type = "text/event-stream",
                    } = req.query
                    const { method = "GET", headers, url: path = "/" } = req.req
                    const events = new stream.PassThrough()
                    const connection = new Connection(
                        method,
                        headers,
                        path,
                        events,
                        res.res,
                    )

                    res.status(status).header("Content-Type", type)
                    if (status === 204) {
                        res.send()
                    } else {
                        res.send(events)

                        if (bom) {
                            events.write("\uFEFF")
                        }
                        events.write("\n".repeat(2048))
                    }

                    onRequest(connection)
                },
            ))
        makeClosable(core.server)

        return new Promise((resolve, reject) => {
            core.listen(this.port, error => {
                if (error) {
                    reject(error)
                } else {
                    const address = core.server.address() as AddressInfo
                    this.port = address.port
                    resolve(this)
                }
            })
        })
    }
}

export class Connection {
    public readonly method: string
    public readonly headers: Record<string, string | string[] | undefined>
    public readonly path: string

    private readonly events: stream.Writable
    private closed = false
    private onClose: (() => void) | null = null

    public constructor(
        method: string,
        headers: Record<string, string | string[] | undefined>,
        path: string,
        events: stream.Writable,
        res: ServerResponse,
    ) {
        this.method = method
        this.headers = headers
        this.path = path
        this.events = events

        res.on("close", () => {
            const { onClose } = this
            this.closed = true
            this.onClose = null

            if (onClose) {
                onClose()
            }
        })
    }

    public write(data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.events.write(data, error => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }

    public end(): Promise<void> {
        return new Promise(resolve => {
            this.events.end(() => {
                resolve()
            })
        })
    }

    public waitForDisconnection(timeout = 1000): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.closed) {
                resolve()
            } else {
                const timer = setTimeout(() => {
                    this.onClose = null
                    reject(new Error("timeout"))
                }, timeout)

                this.onClose = () => {
                    clearTimeout(timer)
                    resolve()
                }
            }
        })
    }
}
