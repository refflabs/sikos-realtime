import { Channels, Events } from '../events.js'
import { getChatHistory, addMessage, getChatThreads, deleteChatSession, deleteAllChats } from './chatStore.js'

const ALLOWED_CHANNELS = new Set([Channels.PUBLIC, Channels.ADMIN])

/* ── Presence store: userId → { name, role, socketIds: Set, since } ── */
const onlineUsers = new Map()

function broadcastPresence(io, userId, online) {
  const user = onlineUsers.get(userId)
  const payload = {
    userId,
    name: user?.name,
    role: user?.role,
    online,
    since: user?.since ?? null,
  }
  // Broadcast ke semua admin
  io.to(Channels.ADMIN).emit(online ? Events.USER_ONLINE : Events.USER_OFFLINE, payload)
}

function handleUserOnline(io, socket, user) {
  if (!user?.id) return

  if (!onlineUsers.has(user.id)) {
    onlineUsers.set(user.id, {
      name: user.name,
      role: user.role,
      socketIds: new Set([socket.id]),
      since: new Date().toISOString(),
    })
    broadcastPresence(io, user.id, true)

    // Jika admin online → broadcast ke semua user
    if (user.role === 'admin') {
      socket.broadcast.emit(Events.USER_ONLINE, { userId: user.id, role: 'admin', online: true })
    }
  } else {
    onlineUsers.get(user.id).socketIds.add(socket.id)
  }
}

function handleUserOffline(io, socket, user) {
  if (!user?.id) return

  const info = onlineUsers.get(user.id)
  if (info) {
    info.socketIds.delete(socket.id)
    if (info.socketIds.size === 0) {
      onlineUsers.delete(user.id)
      broadcastPresence(io, user.id, false)

      if (user.role === 'admin') {
        socket.broadcast.emit(Events.USER_OFFLINE, { userId: user.id, role: 'admin', online: false })
      }
    }
  }
}

export function registerSocketHandlers(io, socket) {
  // Every client receives public room availability updates
  socket.join(Channels.PUBLIC)

  // If user is logged in, join their user-specific room and automatically mark online
  if (socket.data.user?.id) {
    const user = socket.data.user
    socket.join(`user:${user.id}`)
    handleUserOnline(io, socket, user)
  }

  socket.on(Events.CLIENT_SUBSCRIBE, (data, ack) => {
    const channels = Array.isArray(data?.channels) ? data.channels : []
    const joined = []
    const errors = []

    for (const channel of channels) {
      if (!ALLOWED_CHANNELS.has(channel)) {
        errors.push(`Unknown channel: ${channel}`)
        continue
      }

      if (channel === Channels.ADMIN) {
        if (socket.data.user?.role !== 'admin') {
          errors.push('Forbidden: admin channel requires admin role')
          continue
        }
      }

      socket.join(channel)
      joined.push(channel)
    }

    const response = { ok: errors.length === 0, joined, errors }
    if (typeof ack === 'function') {
      ack(response)
    }
  })

  /* ── Presence: user/admin goes online ── */
  socket.on('presence:online', () => {
    const user = socket.data.user
    if (!user) return
    handleUserOnline(io, socket, user)
  })

  /* ── Presence: user/admin goes offline ── */
  socket.on('presence:offline', () => {
    const user = socket.data.user
    if (!user) return
    handleUserOffline(io, socket, user)
  })

  /* ── Get admin presence (untuk initial load di ChatWidget) ── */
  socket.on('presence:get_admin', (data, ack) => {
    let adminOnline = false
    for (const [, info] of onlineUsers) {
      if (info.role === 'admin') {
        adminOnline = true
        break
      }
    }
    if (typeof ack === 'function') {
      ack({ online: adminOnline })
    }
  })

  /* ── Get all online users (Admin only) ── */
  socket.on('presence:get_online_users', (data, ack) => {
    if (socket.data.user?.role !== 'admin') {
      if (typeof ack === 'function') ack({ error: 'Forbidden' })
      return
    }
    const users = []
    for (const [userId, info] of onlineUsers) {
      users.push({ userId, name: info.name, role: info.role, since: info.since, online: true })
    }
    if (typeof ack === 'function') ack({ users })
  })

  // Handle chat message sending
  socket.on(Events.CHAT_SEND_MESSAGE, (data, ack) => {
    if (!socket.data.user) {
      return socket.emit(Events.SERVER_ERROR, { message: 'Unauthorized: Harap login terlebih dahulu.' })
    }

    const text = data?.text?.trim()
    if (!text) return

    const user = socket.data.user
    let msg

    if (user.role === 'admin') {
      const targetUserId = Number(data?.userId)
      if (!targetUserId) {
        return socket.emit(Events.SERVER_ERROR, { message: 'Bad Request: Target userId diperlukan.' })
      }

      msg = {
        id: Math.random().toString(36).substring(2, 9),
        userId: targetUserId,
        senderId: user.id,
        senderName: user.name,
        role: 'admin',
        text,
        timestamp: new Date().toISOString(),
      }

      addMessage(targetUserId, msg)

      // Broadcast to target user's room
      io.to(`user:${targetUserId}`).emit(Events.CHAT_MESSAGE_RECEIVED, msg)
      // Broadcast to admin channel to sync other admin sessions
      io.to(Channels.ADMIN).emit(Events.CHAT_MESSAGE_RECEIVED, msg)
      // Broadcast thread updates to admin
      io.to(Channels.ADMIN).emit(Events.CHAT_THREAD_UPDATED, getChatThreads())
    } else {
      const tenantId = user.id
      msg = {
        id: Math.random().toString(36).substring(2, 9),
        userId: tenantId,
        senderId: tenantId,
        senderName: user.name,
        role: 'user',
        text,
        timestamp: new Date().toISOString(),
      }

      addMessage(tenantId, msg)

      // Broadcast to user's room (sync multiple tabs)
      io.to(`user:${tenantId}`).emit(Events.CHAT_MESSAGE_RECEIVED, msg)
      // Broadcast to admin channel
      io.to(Channels.ADMIN).emit(Events.CHAT_MESSAGE_RECEIVED, msg)
      // Broadcast thread updates to admin
      io.to(Channels.ADMIN).emit(Events.CHAT_THREAD_UPDATED, getChatThreads())
    }

    if (typeof ack === 'function') {
      ack({ ok: true, message: msg })
    }
  })

  // Handle retrieving chat history
  socket.on(Events.CHAT_GET_HISTORY, (data, ack) => {
    if (!socket.data.user) {
      return socket.emit(Events.SERVER_ERROR, { message: 'Unauthorized' })
    }

    const user = socket.data.user
    const targetUserId = (user.role === 'admin' && data?.userId) ? Number(data.userId) : user.id
    const history = getChatHistory(targetUserId)

    if (typeof ack === 'function') {
      ack(history)
    } else {
      socket.emit(Events.CHAT_HISTORY, { userId: targetUserId, history })
    }
  })

  // Handle retrieving chat threads list (Admin only)
  socket.on(Events.CHAT_GET_THREADS, (data, ack) => {
    if (socket.data.user?.role !== 'admin') {
      return socket.emit(Events.SERVER_ERROR, { message: 'Forbidden: Admin only.' })
    }

    const threads = getChatThreads()
    if (typeof ack === 'function') {
      ack(threads)
    } else {
      socket.emit(Events.CHAT_THREADS, threads)
    }
  })

  // Admin delete chat session
  socket.on('chat:delete_session', (data, ack) => {
    if (socket.data.user?.role !== 'admin') {
      return socket.emit(Events.SERVER_ERROR, { message: 'Forbidden: Admin only.' })
    }
    const targetUserId = Number(data?.userId)
    if (!targetUserId) {
      return socket.emit(Events.SERVER_ERROR, { message: 'Bad Request: target userId required.' })
    }
    
    deleteChatSession(targetUserId)

    // Broadcast to that user's room to clear their chat history live
    io.to(`user:${targetUserId}`).emit('chat:session_deleted', { userId: targetUserId })
    // Broadcast to admin channel to sync other admin sessions
    io.to(Channels.ADMIN).emit('chat:session_deleted', { userId: targetUserId })
    // Broadcast updated threads list to admin
    io.to(Channels.ADMIN).emit(Events.CHAT_THREAD_UPDATED, getChatThreads())

    if (typeof ack === 'function') {
      ack({ ok: true })
    }
  })

  // Admin delete all chats history
  socket.on('chat:delete_all', (data, ack) => {
    if (socket.data.user?.role !== 'admin') {
      return socket.emit(Events.SERVER_ERROR, { message: 'Forbidden: Admin only.' })
    }
    
    deleteAllChats()

    // Broadcast to all clients to clear all chats live
    io.emit('chat:all_deleted')
    // Broadcast updated threads list to admin (which is now empty)
    io.to(Channels.ADMIN).emit(Events.CHAT_THREAD_UPDATED, [])

    if (typeof ack === 'function') {
      ack({ ok: true })
    }
  })

  socket.on('disconnect', (reason) => {
    const user = socket.data.user
    if (user) {
      handleUserOffline(io, socket, user)
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[realtime] Client disconnected (${socket.id}): ${reason}`)
    }
  })
}
