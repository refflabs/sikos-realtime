import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import config from './src/config.js'
import { authMiddleware } from './src/socket/middleware.js'
import { registerSocketHandlers } from './src/socket/handlers.js'
import { createBroadcastRouter } from './src/http/broadcast.js'

const app = express()
app.use(
  cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
  }),
)
app.use(express.json({ limit: '64kb' }))

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 25000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
})

io.use(authMiddleware)

io.on('connection', (socket) => {
  const user = socket.data.user
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[realtime] Client connected  (${socket.id}) user=${user ? `${user.name}[${user.role}]` : 'guest'}`)
  }
  registerSocketHandlers(io, socket)
})

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
  })
})

app.post('/broadcast', createBroadcastRouter(io, config.socketSecret))

httpServer.listen(config.port, () => {
  console.log(`[realtime] Socket.IO listening on port ${config.port}`)
  console.log(`[realtime] CORS origins: ${config.corsOrigins.join(', ')}`)
})
