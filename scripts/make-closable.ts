import { Server } from "http"
import { Socket } from "net"

/**
 * Make the server closing immediately when the `close()` method is invoked.
 */
export function makeClosable(server: Server): void {
    const close = server.close
    const sockets = new Set<Socket>()

    server.on("connection", socket => {
        sockets.add(socket)
        socket.on("close", () => sockets.delete(socket))
    })

    server.close = callback => {
        close.call(server, callback)
        for (const socket of sockets) {
            socket.destroy()
        }
        return server
    }
}
