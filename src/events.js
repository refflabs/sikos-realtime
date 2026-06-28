/** @readonly Realtime event contract — keep in sync with Backend/config/realtime.php */
export const Events = {
  BOOKING_CREATED: 'booking:created',
  BOOKING_STATUS_CHANGED: 'booking:status_changed',
  BOOKINGS_UPDATED: 'bookings:updated',
  ROOM_UPDATED: 'room:updated',
  SERVER_ERROR: 'server:error',
  CLIENT_SUBSCRIBE: 'client:subscribe',
  CHAT_SEND_MESSAGE: 'chat:send_message',
  CHAT_MESSAGE_RECEIVED: 'chat:message_received',
  CHAT_GET_HISTORY: 'chat:get_history',
  CHAT_HISTORY: 'chat:history',
  CHAT_GET_THREADS: 'chat:get_threads',
  CHAT_THREADS: 'chat:threads',
  CHAT_THREAD_UPDATED: 'chat:thread_updated',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
}

export const Channels = {
  PUBLIC: 'public',
  ADMIN: 'admin',
}

export const ENVELOPE_VERSION = 1

export function createEnvelope(type, payload) {
  return {
    type,
    payload,
    meta: {
      version: ENVELOPE_VERSION,
      timestamp: new Date().toISOString(),
    },
  }
}
