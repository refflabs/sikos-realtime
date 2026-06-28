import 'dotenv/config'

function parseOrigins(value) {
  return (value || 'http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

const config = {
  port: Number(process.env.PORT || process.env.SOCKET_PORT || 6001),
  socketSecret: process.env.SOCKET_SECRET || '',
  laravelApiUrl: (process.env.LARAVEL_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, ''),
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  isProduction: process.env.NODE_ENV === 'production',
}

if (!config.socketSecret) {
  console.warn('[realtime] SOCKET_SECRET is not set — broadcast endpoint is insecure')
}

if (config.isProduction && !config.socketSecret) {
  throw new Error('SOCKET_SECRET is required in production')
}

export default config
