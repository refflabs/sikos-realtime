import { verifyToken } from '../auth/verifyToken.js'

/**
 * Optional auth — anonymous clients may connect but cannot join admin channel
 * Invalid tokens are treated as guest (not rejected) to prevent transport close loops
 */
export function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token

  console.log(`[realtime] Handshake auth attempt. Token present: ${Boolean(token)}`)

  if (!token) {
    console.log('[realtime] No token provided in handshake. Connecting as guest.')
    socket.data.user = null
    return next()
  }

  verifyToken(token)
    .then((user) => {
      if (user) {
        console.log(`[realtime] Token verified. User: ${user.name} [ID: ${user.id}, Role: ${user.role}]`)
      } else {
        console.log('[realtime] Token verification failed (returned null). Connecting as guest.')
      }
      socket.data.user = user || null
      next()
    })
    .catch((err) => {
      console.error('[realtime] Token validation error:', err)
      socket.data.user = null
      next()
    })
}
