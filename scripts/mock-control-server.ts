import stream from "stream"
import fastify from "fastify"
import cors from "fastify-cors"
import { makeClosable } from "./make-closable"
import { Connection, MockServer } from "./mock-server"

/**
 * The controller for mock server.
 */
export class MockControlServer {
    private readonly target: MockServer
    private readonly core = fastify()
        .register(cors)
        .get<{ timeout: number }, {}>(
            "/wait-for-connection",
            {
                schema: {
                    querystring: {
                        timeout: { type: "integer" },
                    },
                },
            },
            async (req, res) => {
                const ret = new stream.PassThrough()
                const promise = this.target.waitForConnection(req.query.timeout)

                // Notify started.
                res.code(200)
                    .type("application/json")
                    .send(ret)
                ret.write(" ".repeat(1024))

                try {
                    // Wait for connection.
                    const connection = await promise
                    const type = "join"
                    const id = ++this.lastConnectionId
                    const { method, headers, path } = connection

                    this.connections.set(id, connection)

                    ret.write(
                        JSON.stringify({ type, id, method, headers, path }),
                    )
                } catch (error) {
                    if (error.message !== "timeout") {
                        ret.write(
                            JSON.stringify({
                                type: "error",
                                message: error.message,
                            }),
                        )
                    } else {
                        ret.write(JSON.stringify({ type: "timeout" }))
                    }
                } finally {
                    ret.end()
                }
            },
        )
        .post("/stop", async (_req, res) => {
            await this.target.stop()
            res.code(204).send()
        })
        .post("/restart", async (_req, res) => {
            await this.target.restart()
            res.code(204).send()
        })
        .get<{ timeout: number }, { id: number }>(
            "/connections/:id/wait-for-disconnection",
            {
                schema: {
                    params: {
                        id: { type: "integer" },
                    },
                    querystring: {
                        timeout: { type: "integer" },
                    },
                },
            },
            async (req, res) => {
                const id = req.params.id
                const connection = this.connections.get(id)
                if (connection == null) {
                    res.code(404).send()
                    return
                }

                const ret = new stream.PassThrough()
                const promise = connection.waitForDisconnection(
                    req.query.timeout,
                )

                // Notify started.
                res.code(200)
                    .type("application/json")
                    .send(ret)
                ret.write(" ".repeat(1024))

                // Wait for disconnection.
                try {
                    await promise
                    ret.write(JSON.stringify({ type: "join" }))
                } catch (error) {
                    if (error.message !== "timeout") {
                        ret.write(
                            JSON.stringify({
                                type: "error",
                                message: error.message,
                            }),
                        )
                    } else {
                        ret.write(JSON.stringify({ type: "timeout" }))
                    }
                } finally {
                    ret.end()
                }
            },
        )
        .post<{}, { id: number }, {}, { data: string }>(
            "/connections/:id/write",
            {
                schema: {
                    params: {
                        id: { type: "integer" },
                    },
                    body: {
                        type: "object",
                        properties: {
                            data: { type: "string" },
                        },
                        additionalProperties: false,
                    },
                },
            },
            async (req, res) => {
                const id = req.params.id
                const data = req.body.data
                const connection = this.connections.get(id)
                if (connection == null) {
                    res.code(404).send()
                    return
                }

                await connection.write(data)
                res.code(204).send()
            },
        )
        .post<{}, { id: number }>(
            "/connections/:id/end",
            {
                schema: {
                    params: {
                        id: { type: "integer" },
                    },
                },
            },
            async (req, res) => {
                const id = req.params.id
                const connection = this.connections.get(id)
                if (connection == null) {
                    res.code(404).send()
                    return
                }

                await connection.end()
                res.code(204).send()
            },
        )
    private readonly connections = new Map<number, Connection>()
    private _url = ""
    private lastConnectionId = 0

    /**
     * Start a mock server and control server.
     */
    public static async start(): Promise<MockControlServer> {
        const target = await MockServer.start()
        return new Promise((resolve, reject) => {
            const controller = new MockControlServer(target)
            controller.core.listen(0, (error, address) => {
                if (error) {
                    target.stop().then(() => reject(error), reject)
                } else {
                    controller._url = `${address}/`
                    resolve(controller)
                }
            })
        })
    }

    /**
     * The URL to the control server.
     */
    public get serverURL(): string {
        return this.target.url
    }

    /**
     * The URL to the control server.
     */
    public get controllerURL(): string {
        return this._url
    }

    /**
     * Stop this controller.
     */
    public async stop(): Promise<void> {
        await new Promise(resolve => {
            this.core.server.close(resolve)
        })
        await this.target.stop()
    }

    /**
     * Initialize this instance.
     */
    private constructor(server: MockServer) {
        this.target = server
        makeClosable(this.core.server)
    }
}
