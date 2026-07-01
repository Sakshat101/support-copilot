import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTicket, getMyTickets } from '../api'
import { Plus, MessageSquare, Clock, CheckCircle, AlertTriangle, Ticket } from 'lucide-react'

const STATUS_COLORS = {
  new:    'bg-blue-100 text-blue-800',
  open:   'bg-indigo-100 text-indigo-800',
  closed: 'bg-gray-100 text-gray-600',
}

const URGENCY_COLORS = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-green-100 text-green-700',
}

export default function MyTicketsPage() {
  const [tickets, setTickets]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [subject, setSubject]   = useState('')
  const [body, setBody]         = useState('')
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      const data = await getMyTickets()
      setTickets(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function submit() {
    if (!subject.trim() || !body.trim()) return
    setCreating(true)
    setError('')
    try {
      const ticket = await createTicket(subject, body)
      setSubject('')
      setBody('')
      setShowForm(false)
      await load()
      // go straight to the chat for this ticket
      navigate(`/tickets/${ticket.id}/chat`, {
        state: {
          subject: ticket.subject,
          body: ticket.body,
          thread_id: ticket.thread_id,
        }
      })
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create ticket')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Tickets</h2>
          <p className="text-sm text-gray-500 mt-1">
            Submit a support request and chat with our AI agent
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} />
          New Ticket
        </button>
      </div>

      {/* create ticket form */}
      {showForm && (
        <div className="bg-white border border-indigo-200 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Describe your issue</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Subject *
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. My order arrived damaged"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Describe your issue *
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                rows={4}
                placeholder="e.g. I ordered headphones (order ORD-456) and they arrived with a cracked case. I'd like a refund or replacement."
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={creating || !subject.trim() || !body.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Submitting...' : 'Submit Ticket'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="border px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ticket list */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : tickets.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
          <Ticket size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No tickets yet</p>
          <p className="text-xs mt-1">Click "New Ticket" to submit your first request</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => (
            <div
              key={t.id}
              onClick={() => navigate(`/tickets/${t.id}/chat`, {
                state: {
                  subject: t.subject,
                  body: t.body,
                  thread_id: t.thread_id,
                }
              })}
              className="bg-white border rounded-xl px-5 py-4 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {t.subject}
                    </p>
                    {t.sla_breached && (
                      <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{t.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(t.created_at).toLocaleString()}
                    {t.intent && ` · ${t.intent}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-600'}`}>
                    {t.status}
                  </span>
                  {t.urgency && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${URGENCY_COLORS[t.urgency] || 'bg-gray-100 text-gray-600'}`}>
                      {t.urgency}
                    </span>
                  )}
                  <MessageSquare size={13} className="text-gray-300 mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}