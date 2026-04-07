import { useState, useEffect, useRef, useCallback } from 'react'

/* ─── API ──────────────────────────────────────────────── */
const api = {
  query:    (q) => fetch('/query',     { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ question: q }) }).then(r => r.json()),
  ingest:   (p, t) => fetch('/ingest', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path_or_url: p, doc_type: t }) }).then(r => r.json()),
  documents: ()  => fetch('/documents').then(r => r.json()),
  deleteDoc: (id) => fetch(`/documents/${id}`, { method:'DELETE' }),
}

/* ─── Icons ─────────────────────────────────────────────── */
const Icon = ({ d, size=16, stroke='currentColor', fill='none', strokeWidth=1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p,i) => <path key={i} d={p}/>) : <path d={d}/>}
  </svg>
)
const Icons = {
  send:    "M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2",
  plus:    "M12 5v14M5 12h14",
  trash:   "M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
  file:    "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6",
  link:    "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  chevron: "M6 9l6 6 6-6",
  x:       "M18 6L6 18M6 6l12 12",
  book:    "M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  sparkle: ["M12 3v1M12 20v1M4.22 4.22l.7.7M19.07 19.07l.7.7M3 12h1M20 12h1M4.22 19.78l.7-.7M19.07 4.93l.7-.7", "M12 8a4 4 0 100 8 4 4 0 000-8z"],
}

/* ─── Thinking Dots ─────────────────────────────────────── */
function ThinkingDots() {
  return (
    <div style={{ display:'flex', gap:5, alignItems:'center', padding:'4px 0' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width:6, height:6, borderRadius:'50%',
          background: 'var(--amber)',
          animation: `pulse-dot 1.4s ease-in-out ${i*0.2}s infinite`,
        }}/>
      ))}
    </div>
  )
}

/* ─── Source Card ───────────────────────────────────────── */
function SourceCard({ source, index }) {
  const [open, setOpen] = useState(false)
  const label = source.metadata?.source?.split('/').pop() || source.document_id?.slice(0,8) || `Source ${index+1}`

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 6,
      overflow: 'hidden',
      background: 'var(--bg-surface)',
      animation: `fadeUp 0.3s var(--ease-out) ${index * 0.05}s both`,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:8,
          padding:'7px 10px', background:'none',
          color: 'var(--text-secondary)', fontSize:12,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background='none'}
      >
        <span style={{
          width:18, height:18, borderRadius:3,
          background:'var(--amber-subtle)', border:'1px solid var(--amber-dim)',
          color:'var(--amber)', fontSize:10, fontFamily:'var(--font-mono)',
          display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink:0, fontWeight:500,
        }}>{index+1}</span>
        <span style={{ flex:1, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {label}
        </span>
        <span style={{
          fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)',
          background:'var(--bg-elevated)', padding:'2px 5px', borderRadius:3,
        }}>{source.level}</span>
        <div style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s',
          color: 'var(--text-muted)',
        }}>
          <Icon d={Icons.chevron} size={12}/>
        </div>
      </button>
      {open && (
        <div style={{
          padding:'10px 12px',
          borderTop:'1px solid var(--border-subtle)',
          fontSize:13,
          color:'var(--text-secondary)',
          lineHeight:1.7,
          fontFamily:'var(--font-display)',
          fontStyle:'italic',
          background:'var(--bg-elevated)',
        }}>
          "{source.content?.slice(0, 280)}{source.content?.length > 280 ? '…' : ''}"
        </div>
      )}
    </div>
  )
}

/* ─── Message ────────────────────────────────────────────── */
function Message({ msg, index }) {
  const isUser = msg.role === 'user'
  const [showSources, setShowSources] = useState(false)
  const hasSources = msg.sources?.length > 0

  return (
    <div style={{
      display:'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap:12, alignItems:'flex-start',
      animation: `fadeUp 0.4s var(--ease-out) both`,
      padding:'4px 0',
    }}>
      {/* Avatar */}
      <div style={{
        width:30, height:30, borderRadius: isUser ? '8px' : '50%',
        background: isUser ? 'var(--amber-dim)' : 'var(--bg-elevated)',
        border: `1px solid ${isUser ? 'var(--amber)' : 'var(--border)'}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0, color: isUser ? 'var(--amber)' : 'var(--text-muted)',
        fontSize:11, fontFamily:'var(--font-mono)', fontWeight:500,
        boxShadow: isUser ? '0 0 12px rgba(201,162,74,0.15)' : 'none',
      }}>
        {isUser ? 'you' : <Icon d={Icons.sparkle} size={14}/>}
      </div>

      {/* Bubble */}
      <div style={{ flex:1, maxWidth:'72%' }}>
        <div style={{
          background: isUser ? 'var(--bg-elevated)' : 'var(--bg-surface)',
          border: `1px solid ${isUser ? 'var(--border)' : 'var(--border-subtle)'}`,
          borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          padding:'12px 16px',
          position:'relative',
        }}>
          {msg.thinking ? (
            <ThinkingDots/>
          ) : (
            <p style={{
              fontSize: isUser ? 14 : 14.5,
              lineHeight:1.75,
              color:'var(--text-primary)',
              fontFamily: isUser ? 'var(--font-ui)' : 'var(--font-display)',
              fontWeight: isUser ? 400 : 300,
              letterSpacing: isUser ? 0 : '0.01em',
            }}>
              {msg.content}
            </p>
          )}
        </div>

        {/* Sources toggle */}
        {hasSources && (
          <div style={{ marginTop:8 }}>
            <button
              onClick={() => setShowSources(o => !o)}
              style={{
                display:'inline-flex', alignItems:'center', gap:5,
                fontSize:11.5, color:'var(--amber)',
                fontFamily:'var(--font-mono)',
                padding:'3px 8px', borderRadius:4,
                background: showSources ? 'var(--amber-subtle)' : 'transparent',
                border:'1px solid transparent',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--amber-dim)'; e.currentTarget.style.background='var(--amber-subtle)' }}
              onMouseLeave={e => { if(!showSources){ e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.background='transparent' }}}
            >
              <Icon d={Icons.book} size={11}/>
              {msg.sources.length} source{msg.sources.length>1?'s':''}
              <div style={{ transform: showSources?'rotate(180deg)':'none', transition:'transform 0.2s' }}>
                <Icon d={Icons.chevron} size={10}/>
              </div>
            </button>

            {showSources && (
              <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:5 }}>
                {msg.sources.map((s,i) => <SourceCard key={i} source={s} index={i}/>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Upload Modal ──────────────────────────────────────── */
function UploadModal({ onClose, onSuccess }) {
  const [type, setType]   = useState('url')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const docTypes = { url:'html', file:'markdown' }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!value.trim()) return
    setLoading(true); setError('')
    try {
      const dt = type === 'url' ? 'html' : value.endsWith('.pdf') ? 'pdf' : 'markdown'
      await api.ingest(value.trim(), dt)
      onSuccess()
      onClose()
    } catch(err) {
      setError('Ingestion failed. Check the path or URL.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:100,
      background:'rgba(10,9,7,0.85)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      animation:'fadeUp 0.2s var(--ease-out)',
    }} onClick={onClose}>
      <div style={{
        background:'var(--bg-surface)',
        border:'1px solid var(--border)',
        borderRadius:12,
        padding:28,
        width:440,
        boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
        animation:'fadeUp 0.25s var(--ease-out)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:400, color:'var(--text-primary)' }}>
            Add to Archive
          </h2>
          <button onClick={onClose} style={{ color:'var(--text-muted)', padding:4, borderRadius:4, transition:'color 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>
            <Icon d={Icons.x} size={16}/>
          </button>
        </div>

        {/* Type tabs */}
        <div style={{
          display:'flex', gap:4, marginBottom:16,
          background:'var(--bg-base)', borderRadius:7, padding:3,
        }}>
          {[['url','URL / Web Page'],['file','Local File Path']].map(([k,label]) => (
            <button key={k} onClick={() => setType(k)} style={{
              flex:1, padding:'6px 10px', borderRadius:5, fontSize:12.5,
              fontFamily:'var(--font-ui)', fontWeight:500,
              background: type===k ? 'var(--bg-elevated)' : 'none',
              color: type===k ? 'var(--text-primary)' : 'var(--text-muted)',
              border: type===k ? '1px solid var(--border)' : '1px solid transparent',
              transition:'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ position:'relative', marginBottom:8 }}>
            <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}>
              <Icon d={type==='url' ? Icons.link : Icons.file} size={14}/>
            </div>
            <input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={type==='url' ? 'https://example.com/doc.html' : '/Users/you/docs/file.md'}
              style={{
                width:'100%', padding:'10px 12px 10px 36px',
                background:'var(--bg-base)',
                border:'1px solid var(--border)',
                borderRadius:7, color:'var(--text-primary)',
                fontSize:13, outline:'none', transition:'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor='var(--amber-dim)'}
              onBlur={e => e.target.style.borderColor='var(--border)'}
            />
          </div>

          {error && <p style={{ color:'var(--rust)', fontSize:12, marginBottom:10 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !value.trim()}
            style={{
              width:'100%', padding:'10px',
              background: loading || !value.trim() ? 'var(--bg-elevated)' : 'var(--amber)',
              color: loading || !value.trim() ? 'var(--text-muted)' : '#111009',
              borderRadius:7, fontSize:13.5, fontWeight:600,
              fontFamily:'var(--font-ui)',
              transition:'all 0.15s',
              opacity: loading ? 0.7 : 1,
            }}
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
  const name = doc.source?.split('/').pop() || doc.id?.slice(0,12)
  const ext = name.split('.').pop()?.toUpperCase() || 'DOC'

  const extColors = { PDF:'var(--rust)', MD:'var(--sage)', HTML:'var(--amber)', TXT:'var(--text-muted)' }
  const extColor = extColors[ext] || 'var(--text-muted)'

  return (
    <div
      style={{
        display:'flex', alignItems:'center', gap:9,
        padding:'7px 8px', borderRadius:6,
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        transition:'background 0.15s',
        animation:'slideIn 0.2s var(--ease-out) both',
        cursor:'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width:28, height:28, borderRadius:5, flexShrink:0,
        background:'var(--bg-elevated)', border:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <span style={{ fontSize:8, fontFamily:'var(--font-mono)', color:extColor, fontWeight:500 }}>{ext}</span>
      </div>
      <div style={{ flex:1, overflow:'hidden' }}>
        <div style={{ fontSize:12.5, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {name}
        </div>
        <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
          {doc.chunk_count} chunks
        </div>
      </div>
      {hovered && (
        <button
          onClick={() => onDelete(doc.id)}
          style={{
            color:'var(--text-muted)', padding:4, borderRadius:4,
            transition:'color 0.15s', flexShrink:0,
          }}
          onMouseEnter={e => e.currentTarget.style.color='var(--rust)'}
          onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}
        >
          <Icon d={Icons.trash} size={13}/>
        </button>
      )}
    </div>
  )
}

/* ─── App ────────────────────────────────────────────────── */
export default function App() {
  const [messages, setMessages]     = useState([])
  const [documents, setDocuments]   = useState([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [docsLoading, setDocsLoading] = useState(true)

  const chatRef   = useRef(null)
  const inputRef  = useRef(null)

  const loadDocs = useCallback(async () => {
    try {
      const docs = await api.documents()
      setDocuments(Array.isArray(docs) ? docs : [])
    } catch { setDocuments([]) }
    finally { setDocsLoading(false) }
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior:'smooth' })
    }
  }, [messages])

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(m => [...m, { role:'user', content:q }, { role:'assistant', thinking:true, content:'', sources:[] }])
    setLoading(true)
    try {
      const res = await api.query(q)
      setMessages(m => {
        const next = [...m]
        next[next.length-1] = { role:'assistant', content: res.answer || 'No answer.', sources: res.sources || [] }
        return next
      })
    } catch {
      setMessages(m => {
        const next = [...m]
        next[next.length-1] = { role:'assistant', content:'Failed to get a response. Is the server running?', sources:[] }
        return next
      })
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleDelete = async (id) => {
    await api.deleteDoc(id)
    setDocuments(d => d.filter(doc => doc.id !== id))
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 'var(--sidebar-w)',
        display:'flex', flexDirection:'column',
        background:'var(--bg-surface)',
        borderRight:'1px solid var(--border)',
        flexShrink:0,
      }}>
        {/* Brand */}
        <div style={{
          padding:'20px 16px 16px',
          borderBottom:'1px solid var(--border-subtle)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
            <div style={{
              width:28, height:28, borderRadius:7,
              background:'var(--amber-subtle)',
              border:'1px solid var(--amber-dim)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Icon d={Icons.sparkle} size={14} stroke='var(--amber)'/>
            </div>
            <span style={{
              fontFamily:'var(--font-display)', fontSize:19, fontWeight:400,
              color:'var(--text-primary)', letterSpacing:'0.02em',
            }}>Archive</span>
          </div>
          <p style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)', paddingLeft:36 }}>
            rag intelligence
          </p>
        </div>

        {/* Doc list header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 12px 6px',
        }}>
          <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
            Documents
          </span>
          <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text-muted)' }}>
            {documents.length}
          </span>
        </div>

        {/* Docs */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 4px' }}>
          {docsLoading ? (
            <div style={{ padding:'20px 12px', color:'var(--text-muted)', fontSize:12 }}>Loading…</div>
          ) : documents.length === 0 ? (
            <div style={{ padding:'20px 12px', color:'var(--text-muted)', fontSize:12, lineHeight:1.8 }}>
              No documents yet.<br/>
              <span style={{ color:'var(--amber)', cursor:'pointer' }} onClick={() => setShowUpload(true)}>
                Add one to get started.
              </span>
            </div>
          ) : (
            documents.map(doc => (
              <DocumentItem key={doc.id} doc={doc} onDelete={handleDelete}/>
            ))
          )}
        </div>

        {/* Add doc button */}
        <div style={{ padding:'12px 8px', borderTop:'1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setShowUpload(true)}
            style={{
              width:'100%', padding:'8px 12px',
              display:'flex', alignItems:'center', gap:7,
              borderRadius:7, color:'var(--amber)',
              border:'1px solid var(--amber-dim)',
              background:'var(--amber-subtle)',
              fontSize:13, fontWeight:500, fontFamily:'var(--font-ui)',
              transition:'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--amber-glow)'; e.currentTarget.style.boxShadow='0 0 16px rgba(201,162,74,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background='var(--amber-subtle)'; e.currentTarget.style.boxShadow='none' }}
          >
            <Icon d={Icons.plus} size={14}/>
            Add Document
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>

        {/* Ambient glow */}
        <div style={{
          position:'absolute', top:-120, left:'50%', transform:'translateX(-50%)',
          width:500, height:300,
          background:'radial-gradient(ellipse, rgba(201,162,74,0.04) 0%, transparent 70%)',
          pointerEvents:'none',
        }}/>

        {/* Header */}
        <header style={{
          padding:'16px 28px',
          borderBottom:'1px solid var(--border-subtle)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          backdropFilter:'blur(8px)',
          background:'rgba(17,16,9,0.6)',
        }}>
          <div>
            <h1 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:400, color:'var(--text-primary)' }}>
              Knowledge Query
            </h1>
            <p style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:1 }}>
              {documents.length} document{documents.length!==1?'s':''} indexed
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              style={{
                fontSize:12, color:'var(--text-muted)',
                fontFamily:'var(--font-mono)',
                padding:'5px 10px', borderRadius:5,
                border:'1px solid var(--border)',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.borderColor='var(--text-muted)' }}
              onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.borderColor='var(--border)' }}
            >
              clear
            </button>
          )}
        </header>

        {/* Messages */}
        <div ref={chatRef} style={{
          flex:1, overflowY:'auto', padding:'24px 28px',
          display:'flex', flexDirection:'column', gap:20,
        }}>
          {messages.length === 0 && (
            <div style={{
              flex:1, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              gap:12, color:'var(--text-muted)',
              animation:'fadeUp 0.5s var(--ease-out)',
            }}>
              <div style={{
                width:56, height:56, borderRadius:'50%',
                background:'var(--bg-elevated)',
                border:'1px solid var(--border)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Icon d={Icons.sparkle} size={22} stroke='var(--text-muted)'/>
              </div>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--text-secondary)', fontWeight:400 }}>
                  Ask anything about your documents
                </p>
                <p style={{ fontSize:12, marginTop:4 }}>
                  {documents.length === 0 ? 'Add documents from the sidebar to begin' : `${documents.length} document${documents.length!==1?'s':''} ready to query`}
                </p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => <Message key={i} msg={msg} index={i}/>)}
        </div>

        {/* Input */}
        <div style={{
          padding:'16px 28px 24px',
          background:'linear-gradient(to top, var(--bg-base) 70%, transparent)',
        }}>
          <div style={{
            display:'flex', alignItems:'flex-end', gap:10,
            background:'var(--bg-surface)',
            border:'1px solid var(--border)',
            borderRadius:12,
            padding:'10px 10px 10px 16px',
            transition:'border-color 0.2s, box-shadow 0.2s',
            boxShadow:'0 4px 24px rgba(0,0,0,0.3)',
          }}
            onFocusCapture={e => {
              e.currentTarget.style.borderColor='var(--amber-dim)'
              e.currentTarget.style.boxShadow='0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px var(--amber-dim)'
            }}
            onBlurCapture={e => {
              e.currentTarget.style.borderColor='var(--border)'
              e.currentTarget.style.boxShadow='0 4px 24px rgba(0,0,0,0.3)'
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,160)+'px' }}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your archive…"
              rows={1}
              disabled={loading}
              style={{
                flex:1, background:'none', border:'none', outline:'none',
                color:'var(--text-primary)', fontSize:14, lineHeight:1.6,
                resize:'none', maxHeight:160, overflow:'auto',
                fontFamily:'var(--font-ui)',
                '::placeholder': { color:'var(--text-muted)' },
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width:34, height:34, borderRadius:8, flexShrink:0,
                background: loading || !input.trim() ? 'var(--bg-elevated)' : 'var(--amber)',
                color: loading || !input.trim() ? 'var(--text-muted)' : '#111009',
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'all 0.15s',
                boxShadow: !loading && input.trim() ? '0 2px 12px rgba(201,162,74,0.3)' : 'none',
              }}
              onMouseEnter={e => { if(!loading && input.trim()) e.currentTarget.style.transform='scale(1.05)' }}
              onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
            >
              {loading
                ? <div style={{ width:14, height:14, border:'1.5px solid var(--text-muted)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
                : <Icon d={Icons.send} size={14}/>
              }
            </button>
          </div>
          <p style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', marginTop:10, fontFamily:'var(--font-mono)' }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </main>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setTimeout(loadDocs, 800) }}
        />
      )}
    </div>
  )
}
