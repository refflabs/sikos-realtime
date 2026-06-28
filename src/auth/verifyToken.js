import config from '../config.js'

const tokenCache = new Map()
const CACHE_TTL = 60 * 1000 // 1 minute

/**
 * Validate Sanctum Bearer token against Laravel /api/me
 * @returns {Promise<{ id: number, role: string, email: string, name: string } | null>}
 */
export async function verifyToken(token) {
  if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined' || token === '') {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000) // 15 seconds timeout

  try {
    const res = await fetch(`${config.laravelApiUrl}/me`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      return null
    }

    const user = await res.json()
    if (!user?.id) {
      return null
    }

    const userData = {
      id: user.id,
      role: user.role || 'user',
      email: user.email,
      name: user.name,
    }

    return userData
  } catch (err) {
    console.error('[realtime] Token verification failed:', err.message)
    return null
  } finally {
    clearTimeout(timeout)
  }
}
