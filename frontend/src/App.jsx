import { useState, useEffect, useRef, useCallback } from 'react'

/* ─── API ──────────────────────────────────────────────── */
const api = {
  query:     (q)    => fetch('/query',     { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ question: q }) }).then(r => r.json()),
  ingest:    (p, t) => fetch('/ingest',    { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path_or_url: p, doc_type: t }) }).then(r => r.json()),
  documents: ()     => fetch('/documents').then(r => r.json()),
  deleteDoc: (id)   => fetch(`/documents/${id}`, { method:'DELETE' }),
}

/* ─── Icons (minimal stroked SVG) ──────────────────────── */
const Icon = ({ d, size = 16, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
)
const Icons = {
  send:    "M22 2L11 13M22 2L15 22 11 13M11 13 2 9 22 2",
  plus:    "M12 5v14M5 12h14",
  trash:   "M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
  file:    ["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z", "M14 2v6h6"],
  link:    "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  chevron: "M6 9l6 6 6-6",
  x:       "M18 6L6 18M6 6l12 12",
  book:    "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  feather: ["M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z", "M16 8L2 22M17.5 15H9"],
}

/* ─── Thinking Dots ─────────────────────────────────────── */
export function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--terracotta)',
          animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  )
}

/* ─── Source Card ───────────────────────────────────────── */
export function SourceCard({ source, index }) {
  const [open, setOpen] = useState(false)
  const label = source.metadata?.source?.split('/').pop() || source.document_id?.slice(0, 10) || `Source ${index + 1}`

  return (
    <div style={{
      border: '1px solid var(--border-cream)',
      borderRadius: 8,
      overflow: 'hidden',
      background: 'var(--ivory)',
      boxShadow: '0 0 0 0px transparent',
      transition: 'box-shadow 0.15s',
      animation: `fadeUp 0.25s var(--ease-out) ${index * 0.05}s both`,
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', background: 'none',
        color: 'var(--text-secondary)', fontSize: 13,
        transition: 'background 0.12s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--warm-sand)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <span style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          background: 'var(--warm-sand)',
          border: '1px solid var(--border-warm)',
          color: 'var(--terracotta)',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{index + 1}</span>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-warm-dark)' }}>
          {label}
        </span>
        <span style={{
          fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
          background: 'var(--warm-sand)', padding: '1px 6px', borderRadius: 4,
        }}>{source.level}</span>
        <div style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }}>
          <Icon d={Icons.chevron} size={12} />
        </div>
      </button>

      {open && (
        <div style={{
          padding: '10px 14px 12px',
          borderTop: '1px solid var(--border-cream)',
          fontSize: 14, lineHeight: 1.7,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          background: 'var(--white)',
        }}>
          "{source.content?.slice(0, 300)}{source.content?.length > 300 ? '…' : ''}"
        </div>
      )}
    </div>
  )
}

/* ─── Message ────────────────────────────────────────────── */
export function Message({ msg }) {
  const isUser = msg.role === 'user'
  const [showSources, setShowSources] = useState(false)
  const hasSources = msg.sources?.length > 0

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 10, alignItems: 'flex-start',
      animation: 'fadeUp 0.35s var(--ease-out) both',
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: isUser ? 8 : '50%',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser ? 'var(--warm-sand)' : 'var(--terracotta)',
        border: `1px solid ${isUser ? 'var(--border-warm)' : 'transparent'}`,
        color: isUser ? 'var(--charcoal-warm)' : 'var(--ivory)',
        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 500,
      }}>
        {isUser ? 'you' : <Icon d={Icons.feather} size={13} />}
      </div>

      {/* Bubble */}
      <div style={{ flex: 1, maxWidth: '74%' }}>
        <div style={{
          padding: '11px 16px',
          borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          background: isUser ? 'var(--warm-sand)' : 'var(--white)',
          border: `1px solid ${isUser ? 'var(--border-warm)' : 'var(--border-cream)'}`,
          boxShadow: isUser ? 'none' : 'rgba(0,0,0,0.04) 0px 2px 12px',
        }}>
          {msg.thinking ? <ThinkingDots /> : (
            <p style={{
              fontSize: isUser ? 15 : 15.5,
              lineHeight: 1.7,
              color: isUser ? 'var(--charcoal-warm)' : 'var(--text-primary)',
              fontFamily: isUser ? 'var(--font-sans)' : 'var(--font-serif)',
              fontWeight: 400,
            }}>
              {msg.content}
            </p>
          )}
        </div>

        {/* Sources */}
        {hasSources && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setShowSources(o => !o)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              padding: '4px 9px', borderRadius: 6,
              border: '1px solid var(--border-warm)',
              background: showSources ? 'var(--warm-sand)' : 'transparent',
              transition: 'all 0.12s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--warm-sand)'}
              onMouseLeave={e => { if (!showSources) e.currentTarget.style.background = 'transparent' }}
            >
              <Icon d={Icons.book} size={12} />
              {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''}
              <div style={{ transform: showSources ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <Icon d={Icons.chevron} size={10} />
              </div>
            </button>

            {showSources && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {msg.sources.map((s, i) => <SourceCard key={i} source={s} index={i} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Upload Modal ──────────────────────────────────────── */
export function UploadModal({ onClose, onSuccess }) {
  const [type, setType]     = useState('url')
  const [value, setValue]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!value.trim()) return
    setLoading(true); setError('')
    try {
      const dt = type === 'url' ? 'html' : value.endsWith('.pdf') ? 'pdf' : 'markdown'
      await api.ingest(value.trim(), dt)
      onSuccess(); onClose()
    } catch {
      setError('Failed to ingest. Check the path or URL.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(20,20,19,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeUp 0.15s var(--ease-out)',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--ivory)',
        border: '1px solid var(--border-warm)',
        borderRadius: 12,
        padding: 28,
        width: 420,
        boxShadow: 'rgba(0,0,0,0.1) 0px 8px 40px',
        animation: 'fadeUp 0.2s var(--ease-out)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 21, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Add to Archive
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 3 }}>Ingest a document or web page</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', padding: 4, borderRadius: 6, marginTop: 2 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
            <Icon d={Icons.x} size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 14, background: 'var(--warm-sand)', borderRadius: 8, padding: 3 }}>
          {[['url', 'URL / Web Page'], ['file', 'File Path']].map(([k, label]) => (
            <button key={k} onClick={() => setType(k)} style={{
              flex: 1, padding: '6px 10px', borderRadius: 6,
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
              background: type === k ? 'var(--white)' : 'none',
              color: type === k ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: type === k ? '1px solid var(--border-cream)' : '1px solid transparent',
              boxShadow: type === k ? 'rgba(0,0,0,0.04) 0px 1px 4px' : 'none',
              transition: 'all 0.12s',
            }}>{label}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
              <Icon d={type === 'url' ? Icons.link : Icons.file} size={14} />
            </div>
            <input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={type === 'url' ? 'https://example.com/article' : '/Users/you/docs/notes.md'}
              style={{
                width: '100%', padding: '9px 12px 9px 34px',
                background: 'var(--white)',
                border: '1px solid var(--border-warm)',
                borderRadius: 8, color: 'var(--text-primary)',
                fontSize: 13.5, outline: 'none', transition: 'border-color 0.12s, box-shadow 0.12s',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--focus-blue)'; e.target.style.boxShadow = '0 0 0 2px rgba(56,152,236,0.15)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-warm)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          {error && <p style={{ color: '#b53333', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}

          <button type="submit" disabled={loading || !value.trim()} style={{
            width: '100%', padding: '10px',
            background: loading || !value.trim() ? 'var(--warm-sand)' : 'var(--terracotta)',
            color: loading || !value.trim() ? 'var(--text-tertiary)' : 'var(--ivory)',
            borderRadius: 8, fontSize: 14, fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            border: '1px solid transparent',
            transition: 'all 0.15s',
            boxShadow: loading || !value.trim() ? 'none' : '0 0 0 1px var(--terracotta)',
          }}
            onMouseEnter={e => { if (!loading && value.trim()) e.currentTarget.style.background = '#b5593a' }}
            onMouseLeave={e => { if (!loading && value.trim()) e.currentTarget.style.background = 'var(--terracotta)' }}
          >
            {loading ? 'Ingesting…' : 'Add to Archive'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ─── Document Item ─────────────────────────────────────── */
function DocumentItem({ doc, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const name = doc.source?.split('/').pop() || doc.id?.slice(0, 14)
  const ext = name?.split('.').pop()?.toUpperCase() || 'DOC'
  const extColors = { PDF: '#b53333', MD: '#4a7c59', HTML: 'var(--terracotta)', TXT: 'var(--text-tertiary)' }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 10px', borderRadius: 7,
        background: hovered ? 'var(--warm-sand)' : 'transparent',
        transition: 'background 0.12s',
        animation: 'slideIn 0.2s var(--ease-out) both',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 6, flexShrink: 0,
        background: 'var(--white)',
        border: '1px solid var(--border-cream)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: extColors[ext] || 'var(--text-tertiary)', fontWeight: 500 }}>{ext}</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {name}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          {doc.chunk_count} chunks
        </div>
      </div>
      {hovered && (
        <button onClick={() => onDelete(doc.id)}
          style={{ color: 'var(--text-tertiary)', padding: 4, borderRadius: 4, transition: 'color 0.12s', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#b53333'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
          <Icon d={Icons.trash} size={13} />
        </button>
      )}
    </div>
  )
}

/* ─── App ────────────────────────────────────────────────── */
export default function App() {
  const [messages, setMessages]       = useState([])
  const [documents, setDocuments]     = useState([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [showUpload, setShowUpload]   = useState(false)
  const [docsLoading, setDocsLoading] = useState(true)

  const chatRef  = useRef(null)
  const inputRef = useRef(null)

  const loadDocs = useCallback(async () => {
    try { setDocuments(await api.documents()) }
    catch { setDocuments([]) }
    finally { setDocsLoading(false) }
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: q }, { role: 'assistant', thinking: true, content: '', sources: [] }])
    setLoading(true)
    try {
      const res = await api.query(q)
      setMessages(m => {
        const next = [...m]
        next[next.length - 1] = { role: 'assistant', content: res.answer || 'No answer returned.', sources: res.sources || [] }
        return next
      })
    } catch {
      setMessages(m => {
        const next = [...m]
        next[next.length - 1] = { role: 'assistant', content: 'Could not reach the server. Is it running?', sources: [] }
        return next
      })
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleDelete = async (id) => {
    await api.deleteDoc(id)
    setDocuments(d => d.filter(doc => doc.id !== id))
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--parchment)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 'var(--sidebar-w)', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: 'var(--parchment)',
        borderRight: '1px solid var(--border-warm)',
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border-cream)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'var(--terracotta)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ivory)',
            }}>
              <Icon d={Icons.feather} size={14} />
            </div>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Archive
            </span>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6, paddingLeft: 36, fontFamily: 'var(--font-mono)' }}>
            rag · knowledge base
          </p>
        </div>

        {/* Doc list header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 6px' }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Documents
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {documents.length}
          </span>
        </div>

        {/* Docs */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
          {docsLoading ? (
            <div style={{ padding: '16px 10px', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>
          ) : documents.length === 0 ? (
            <div style={{ padding: '16px 10px', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.8 }}>
              No documents yet.{' '}
              <span style={{ color: 'var(--terracotta)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(201,100,66,0.3)' }}
                onClick={() => setShowUpload(true)}>Add one to begin.</span>
            </div>
          ) : (
            documents.map(doc => <DocumentItem key={doc.id} doc={doc} onDelete={handleDelete} />)
          )}
        </div>

        {/* Add button */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border-cream)' }}>
          <button onClick={() => setShowUpload(true)} style={{
            width: '100%', padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            borderRadius: 8, color: 'var(--charcoal-warm)',
            border: '1px solid var(--border-warm)',
            background: 'var(--warm-sand)',
            fontSize: 13.5, fontWeight: 500,
            boxShadow: '0 0 0 0 transparent, 0 0 0 1px var(--ring-warm)',
            transition: 'all 0.12s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--white)'; e.currentTarget.style.boxShadow = '0 0 0 0 transparent, 0 0 0 1px var(--ring-deep)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--warm-sand)'; e.currentTarget.style.boxShadow = '0 0 0 0 transparent, 0 0 0 1px var(--ring-warm)' }}
          >
            <Icon d={Icons.plus} size={14} />
            Add Document
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--ivory)' }}>

        {/* Header */}
        <header style={{
          padding: '14px 28px',
          borderBottom: '1px solid var(--border-cream)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--ivory)',
        }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Knowledge Query
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {documents.length} document{documents.length !== 1 ? 's' : ''} indexed
            </p>
          </div>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} style={{
              fontSize: 12.5, color: 'var(--text-secondary)',
              padding: '5px 10px', borderRadius: 6,
              border: '1px solid var(--border-warm)',
              background: 'transparent',
              transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--warm-sand)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              Clear
            </button>
          )}
        </header>

        {/* Messages */}
        <div ref={chatRef} style={{
          flex: 1, overflowY: 'auto',
          padding: '28px 32px',
          display: 'flex', flexDirection: 'column', gap: 22,
        }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 14, paddingBottom: 40,
              animation: 'fadeUp 0.5s var(--ease-out)',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--white)',
                border: '1px solid var(--border-warm)',
                boxShadow: 'rgba(0,0,0,0.05) 0px 4px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--terracotta)',
              }}>
                <Icon d={Icons.feather} size={20} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  Ask anything about your archive
                </p>
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  {documents.length === 0
                    ? 'Add documents from the sidebar to begin'
                    : `${documents.length} document${documents.length !== 1 ? 's' : ''} ready to explore`}
                </p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        </div>

        {/* Input */}
        <div style={{
          padding: '16px 32px 24px',
          borderTop: '1px solid var(--border-cream)',
          background: 'var(--ivory)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            background: 'var(--white)',
            border: '1px solid var(--border-warm)',
            borderRadius: 12,
            padding: '10px 10px 10px 16px',
            transition: 'border-color 0.12s, box-shadow 0.12s',
            boxShadow: 'rgba(0,0,0,0.04) 0px 2px 8px',
          }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--focus-blue)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(56,152,236,0.15)' }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border-warm)'; e.currentTarget.style.boxShadow = 'rgba(0,0,0,0.04) 0px 2px 8px' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask anything about your documents…"
              rows={1}
              disabled={loading}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: 14.5, lineHeight: 1.6,
                resize: 'none', maxHeight: 160, overflow: 'auto',
                fontFamily: 'var(--font-sans)',
              }}
            />
            <button onClick={handleSend} disabled={loading || !input.trim()} style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: loading || !input.trim() ? 'var(--warm-sand)' : 'var(--terracotta)',
              color: loading || !input.trim() ? 'var(--text-tertiary)' : 'var(--ivory)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid transparent',
              transition: 'all 0.15s',
              boxShadow: !loading && input.trim() ? '0 0 0 1px var(--terracotta)' : '0 0 0 1px var(--ring-warm)',
            }}
              onMouseEnter={e => { if (!loading && input.trim()) e.currentTarget.style.background = '#b5593a' }}
              onMouseLeave={e => { if (!loading && input.trim()) e.currentTarget.style.background = 'var(--terracotta)' }}
            >
              {loading
                ? <div style={{ width: 14, height: 14, border: '1.5px solid var(--text-tertiary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                : <Icon d={Icons.send} size={14} />
              }
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 9, fontFamily: 'var(--font-mono)' }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </main>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => setTimeout(loadDocs, 800)}
        />
      )}
    </div>
  )
}
