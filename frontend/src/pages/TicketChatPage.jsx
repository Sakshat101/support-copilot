import { useState, useRef, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { sendMessage, getMyTickets } from '../api'
import { Bot, User, ArrowLeft, Send } from 'lucide-react'
import { getCustomerId } from '../api'

export default function TicketChatPage() {
  const { ticketId }  = useParams()
  const location      = useLocation()
  const navigate      = useNavigate()
  const state         = location.state || {}

  const [subject]     = useState(state.subject || `Ticket #${ticketId}`)
  const [ticketBody]  = useState(state.body || '')
  const [threadId]    = useState(state.thread_id || `ticket-${ticketId}`)
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [pendingApproval, setPendingApproval] = useState(null)
  const bottomRef = useRef(null)
  const customerId = getCustomerId()

  // auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // first message — agent greets in context of the ticket
  useEffect(() => {
    if (ticketBody) {
      setMessages([{
        role: 'system',
        text: `Ticket: ${subject}\n\n${ticketBody}`,
      }])
    }
  }, [])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setLoading(true)
    setPendingApproval(null)

    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setMessages(prev => [...prev, { role: 'assistant', text: '' }])

    const result = await sendMessage(
      {
        message: userMsg,
        customerId,
        threadId,
        ticketSubject: subject,
        ticketBody,
      },
      (chunk) => {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            text: updated[updated.length - 1].text + chunk,
          }
          return updated
        })
      }
    )

    if (result && result.status === 'pending_approval') {
      setPendingApproval(result)
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          text: `⏸ Action paused for approval: **${result.action}**\n\n${result.draft}`,
          isPending: true,
        }
        return updated
      })
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* header */}
      <div className="px-6 py-4 border-b bg-white flex items-center gap-4">
        <button
          onClick={() => navigate('/my-tickets')}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate">{subject}</h2>
          <p className="text-xs text-gray-400 truncate">{ticketBody}</p>
        </div>
        <span className="text-xs text-gray-400 font-mono flex-shrink-0">#{ticketId}</span>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bot size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Ask anything about your issue</p>
            <p className="text-xs mt-1 text-center max-w-xs">
              The agent already knows your ticket details — just type your question
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'system') return (
            <div key={i} className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-700 whitespace-pre-wrap">
              <span className="font-medium">Your issue: </span>{ticketBody}
            </div>
          )
          return (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-indigo-600" />
                </div>
              )}
              <div className={`max-w-xl px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : msg.isPending
                  ? 'bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-sm'
                  : 'bg-white border text-gray-800 rounded-tl-sm'
              }`}>
                {msg.text}
                {msg.isPending && (
                  <p className="mt-2 text-xs text-amber-600 font-medium">
                    → An operator will review this action shortly
                  </p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-white" />
                </div>
              )}
            </div>
          )
        })}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <Bot size={14} className="text-indigo-600" />
            </div>
            <div className="bg-white border px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="px-6 py-4 border-t bg-white">
        <div className="flex gap-3">
          <input
            className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ask about your issue..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}