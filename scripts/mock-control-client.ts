/**
 * Mock server for tests.
 */
export class MockControlClient {
    private readonly controllerURL: string

    /**
     * The URL of the server.
     */
    public readonly url: string

    /**
     * Initialize this instance.
     */
    public constructor(server: { serverURL: string; controllerURL: string }) {
        this.url = server.serverURL
        this.controllerURL = server.controllerURL
    }

    /**
     * Wait for connection.
     */
    public async waitForConnection(
        operation: () => Promise<void> | void,
        timeout = 1500,
    ): Promise<Connection> {
        const awaiter = await getAwaiter(
            `${this.controllerURL}wait-for-connection?timeout=${timeout}`,
            ({ id, method, headers, path }) =>
                new Connection(
                    `${this.controllerURL}connections/${id}/`,
                    method,
                    headers,
                    path,
                ),
        )
        await operation()
        return awaiter.get()
    }

    /**
     * Stop the server.
     */
    public async stop(): Promise<void> {
        await post(`${this.controllerURL}stop`)
    }

    /**
     * Restart the server.
     */
    public async restart(): Promise<void> {
        await post(`${this.controllerURL}restart`)
    }
}

export class Connection {
    private readonly controllerURL: string
    public readonly method: string
    public readonly headers: Record<string, string | string[] | undefined>
    public readonly path: string

    public constructor(
        controllerURL: string,
        method: string,
        headers: Record<string, string | string[] | undefined>,
        path: string,
    ) {
        this.controllerURL = controllerURL
        this.method = method
        this.headers = headers
        this.path = path
    }

    public async write(data: string): Promise<void> {
        await post(`${this.controllerURL}write`, { data })
    }
    public async end(): Promise<void> {
        await post(`${this.controllerURL}end`)
    }

    public async waitForDisconnection(
        operation: () => Promise<void> | void,
        timeout = 1500,
    ): Promise<void> {
        const awaiter = await getAwaiter(
            `${this.controllerURL}wait-for-disconnection?timeout=${timeout}`,
            () => undefined,
        )
        await operation()
        return awaiter.get()
    }
}

export interface Awaiter<T> {
    get(): Promise<T>
}

function getAwaiter<T>(
    url: string,
    select: (data: any) => T,
): Promise<Awaiter<T>> {
    return new Promise((resolveConnect, rejectConnect) => {
        let resolveResult: (value: T) => void
        let rejectResult: (error: Error) => void
        const promise = new Promise<T>((resolve, reject) => {
            resolveResult = resolve
            rejectResult = reject
        })

        const xhr = new window.XMLHttpRequest()
        xhr.open("GET", url, true)
        xhr.setRequestHeader("Accept", "application/json")
        xhr.onprogress = () => {
            xhr.onprogress = null
            resolveConnect({ get: () => promise })
        }
        xhr.onload = () => {
            const { status, statusText, responseText } = xhr
            if (status === 200) {
                try {
                    const data = JSON.parse(responseText)
                    if (data.type === "join") {
                        resolveResult(select(data))
                    } else if (data.type === "timeout") {
                        rejectResult(new Error("timeout"))
                    } else {
                        rejectResult(new Error(data.message || "UNKNOWN"))
                    }
                } catch (error) {
                    rejectResult(error)
                }
            } else if (status === 204) {
                resolveResult(select(undefined))
            } else {
                rejectResult(new Error(`${status} ${statusText}`))
            }
        }
        xhr.onerror = () => {
            rejectConnect(new Error("Networking error"))
            rejectResult(new Error("Networking error"))
        }
        xhr.send()
    })
}

function post(url: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const xhr = new window.XMLHttpRequest()
        xhr.open("POST", url, true)
        xhr.setRequestHeader("Accept", "application/json")
        if (body) {
            xhr.setRequestHeader("Content-Type", "application/json")
        }
        xhr.onload = () => {
            const { status, statusText, responseText } = xhr
            if (status === 200) {
                try {
                    resolve(JSON.parse(responseText))
                } catch (error) {
                    reject(error)
                }
            } else if (status === 204) {
                resolve()
            } else {
                reject(new Error(`${status} ${statusText}`))
            }
        }
        xhr.onerror = () => {
            reject(new Error("Networking error"))
        }
        xhr.send(body && JSON.stringify(body))
    })
}

// Workaround of type error.
declare global {
    interface Window {
        XMLHttpRequest: typeof XMLHttpRequest
    }
}
