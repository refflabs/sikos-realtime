import fs from 'fs'
import path from 'path'

const MESSAGES_FILE = path.resolve('messages.json')

let messages = {}

// Load messages from file on startup
try {
  if (fs.existsSync(MESSAGES_FILE)) {
    const data = fs.readFileSync(MESSAGES_FILE, 'utf8')
    messages = JSON.parse(data)
  }
} catch (err) {
  console.error('[chatStore] Failed to load messages:', err)
  messages = {}
}

function saveMessages() {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8')
  } catch (err) {
    console.error('[chatStore] Failed to save messages:', err)
  }
}

export function getChatHistory(userId) {
  return messages[userId] || []
}

export function addMessage(userId, message) {
  if (!messages[userId]) {
    messages[userId] = []
  }
  messages[userId].push(message)
  saveMessages()
  return message
}

export function getChatThreads() {
  return Object.keys(messages).map((uId) => {
    const threadMsgs = messages[uId]
    const lastMsg = threadMsgs[threadMsgs.length - 1]
    const tenantMsg = threadMsgs.find(m => m.role !== 'admin')
    return {
      userId: Number(uId),
      userName: tenantMsg?.senderName || `Penghuni #${uId}`,
      lastMessage: lastMsg?.text || '',
      timestamp: lastMsg?.timestamp || new Date().toISOString(),
    }
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

export function deleteChatSession(userId) {
  if (messages[userId]) {
    delete messages[userId]
    saveMessages()
    return true
  }
  return false
}

export function deleteAllChats() {
  messages = {}
  saveMessages()
  return true
}
