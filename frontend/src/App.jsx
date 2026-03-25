import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

function App() {
  const [users, setUsers] = useState([])
  const [authUser, setAuthUser] = useState(() => {
    const raw = localStorage.getItem('chat_auth_user')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      localStorage.removeItem('chat_auth_user')
      return null
    }
  })
  const [selectedUserId, setSelectedUserId] = useState('')
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [searchText, setSearchText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [error, setError] = useState('')

  const socketRef = useRef(null)
  const messageBoxRef = useRef(null)

  const currentUserId = authUser?._id || ''

  const contacts = useMemo(
    () => users.filter((user) => user._id !== currentUserId),
    [users, currentUserId],
  )

  const selectedUser = useMemo(
    () => users.find((user) => user._id === selectedUserId),
    [users, selectedUserId],
  )

  const filteredContacts = useMemo(() => {
    const term = searchText.trim().toLowerCase()
    if (!term) return contacts
    return contacts.filter((user) => user.username.toLowerCase().includes(term))
  }, [contacts, searchText])

  const getUserId = (value) =>
    typeof value === 'object' && value !== null ? value._id : value

  const loadUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/users`, {
        params: {
          excludeUserId: currentUserId || undefined,
        },
      })
      setUsers(response.data)
    } catch {
      setError('Could not load users. Make sure backend is running.')
    }
  }, [currentUserId])

  const loadMessages = async (senderId, receiverId) => {
    if (!senderId || !receiverId) return
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${API_BASE}/messages/${senderId}/${receiverId}?page=1&limit=100`,
      )
      setMessages(response.data.messages || [])
    } catch {
      setError('Could not load messages for this chat.')
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuth = async (event) => {
    event.preventDefault()

    if (!authUsername.trim()) {
      setError('Please enter your username.')
      return
    }

    if (!authPassword.trim()) {
      setError('Please enter your password.')
      return
    }

    if (authMode === 'register' && authPassword.trim().length < 6) {
      setError('Password should be at least 6 characters.')
      return
    }

    setError('')
    setIsAuthLoading(true)

    try {
      const response =
        authMode === 'login'
          ? await axios.post(`${API_BASE}/users/login`, {
              username: authUsername.trim(),
              password: authPassword,
            })
          : await axios.post(`${API_BASE}/users`, {
              username: authUsername.trim(),
              password: authPassword,
              email: authEmail.trim() || undefined,
            })

      const user = response.data
      setAuthUser(user)
      localStorage.setItem('chat_auth_user', JSON.stringify(user))
      setAuthPassword('')
      setAuthEmail('')
      setSelectedUserId('')
      setMessages([])
      await loadUsers()
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          (authMode === 'login' ? 'Login failed.' : 'Registration failed.'),
      )
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = () => {
    setAuthUser(null)
    setSelectedUserId('')
    setMessages([])
    localStorage.removeItem('chat_auth_user')
  }

  const handleSendMessage = async (event) => {
    event.preventDefault()
    const text = newMessage.trim()

    if (!text || !currentUserId || !selectedUserId) return

    setError('')
    try {
      const response = await axios.post(`${API_BASE}/messages`, {
        sender: currentUserId,
        receiver: selectedUserId,
        text,
      })
      setMessages((prev) => [...prev, response.data])
      setNewMessage('')
    } catch {
      setError('Message could not be sent.')
    }
  }

  useEffect(() => {
    if (!currentUserId) {
      setUsers([])
      return
    }
    loadUsers()
  }, [currentUserId, loadUsers])

  useEffect(() => {
    if (!currentUserId || !selectedUserId) {
      setMessages([])
      return
    }
    loadMessages(currentUserId, selectedUserId)
  }, [currentUserId, selectedUserId])

  useEffect(() => {
    if (!currentUserId) return

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('register-user', currentUserId)
    })

    socket.on('receive-message', (message) => {
      const senderId = getUserId(message.sender)
      const receiverId = getUserId(message.receiver)

      const belongsToOpenChat =
        (senderId === currentUserId && receiverId === selectedUserId) ||
        (senderId === selectedUserId && receiverId === currentUserId)

      if (belongsToOpenChat) {
        setMessages((prev) => [...prev, message])
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [currentUserId, selectedUserId])

  useEffect(() => {
    if (!messageBoxRef.current) return
    messageBoxRef.current.scrollTop = messageBoxRef.current.scrollHeight
  }, [messages])

  if (!authUser) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Welcome to Simple Chat</h1>
          <p>Login with username and password to open your chats.</p>

          {error ? <div className="alert">{error}</div> : null}

          <form className="auth-form" onSubmit={handleAuth}>
            <input
              type="text"
              placeholder="Username"
              value={authUsername}
              onChange={(event) => setAuthUsername(event.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
            />

            {authMode === 'register' ? (
              <input
                type="email"
                placeholder="Email (optional)"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
              />
            ) : null}

            <button type="submit" disabled={isAuthLoading}>
              {isAuthLoading
                ? 'Please wait...'
                : authMode === 'login'
                  ? 'Login'
                  : 'Create account'}
            </button>
          </form>

          <button
            type="button"
            className="switch-mode"
            onClick={() => {
              setError('')
              setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))
            }}
          >
            {authMode === 'login'
              ? 'No account? Create one'
              : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Simple Chat</h1>
        <p>Search contacts and start chatting.</p>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      <section className="chat-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h3>Contacts</h3>
            <input
              type="text"
              placeholder="Search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          {filteredContacts.length === 0 ? (
            <p className="muted pad">No contacts found.</p>
          ) : (
            <ul className="contact-list">
              {filteredContacts.map((user) => (
                <li key={user._id}>
                  <button
                    type="button"
                    className={`contact-btn ${
                      user._id === selectedUserId ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedUserId(user._id)}
                  >
                    {user.username}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="chat-panel">
          <div className="chat-header">
            <strong>{`You: ${authUser.username}`}</strong>
            <span>{selectedUser ? `Chatting with ${selectedUser.username}` : 'Choose a contact'}</span>
          </div>

          <div className="messages" ref={messageBoxRef}>
            {isLoading ? <p className="muted">Loading messages...</p> : null}

            {!isLoading && messages.length === 0 ? (
              <p className="muted">No messages yet.</p>
            ) : null}

            {messages.map((message) => {
              const senderId = getUserId(message.sender)
              const mine = senderId === currentUserId
              return (
                <div
                  key={message._id || `${message.timestamp}-${message.text}`}
                  className={`message-row ${mine ? 'mine' : 'theirs'}`}
                >
                  <div className="bubble">
                    <p>{message.text}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <form className="send-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              placeholder={
                selectedUser
                  ? `Message ${selectedUser.username}`
                  : 'Select a contact to send message'
              }
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              disabled={!selectedUser}
            />
            <button type="submit" disabled={!selectedUser || !newMessage.trim()}>
              Send
            </button>
          </form>
        </main>
      </section>
    </div>
  )
}

export default App
