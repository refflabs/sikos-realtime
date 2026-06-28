import { Channels } from '../events.js'

const ALLOWED_ROOMS = new Set([Channels.PUBLIC, Channels.ADMIN])

/**
 * @param {import('socket.io').Server} io
 */
export function createBroadcastRouter(io, secret) {
  return (req, res) => {
    if (!secret || req.headers['x-socket-secret'] !== secret) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { event, data, room } = req.body ?? {}

    if (!event || typeof event !== 'string') {
      return res.status(422).json({ message: 'event (string) is required' })
    }

    if (room !== undefined && room !== null) {
      const roomName = String(room)
      if (!ALLOWED_ROOMS.has(roomName)) {
        return res.status(422).json({ message: `Invalid room: ${roomName}` })
      }
      io.to(roomName).emit(event, data)
    } else {
      io.emit(event, data)
    }

    return res.json({ ok: true, event, room: room ?? null })
  }
}
