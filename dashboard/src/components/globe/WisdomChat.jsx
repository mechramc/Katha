/**
 * WisdomChat.jsx — Conversational wisdom delivery pane.
 *
 * User types how they're feeling. Ancestor responds in their voice.
 * Auto-fetches consent token from localStorage. Maps free-text feelings
 * to situational triggers for the engine.
 */

import { useState, useRef, useEffect } from 'react'
import { useVault } from '../../hooks/useVault'
import { useTokenStore } from '../../hooks/useTokenStore'

const FEELING_TRIGGER_MAP = [
  { keywords: ['anxious', 'anxiety', 'worried', 'nervous', 'scared', 'fear', 'panic'], trigger: 'anxiety-overwhelm' },
  { keywords: ['lost', 'confused', 'direction', 'purpose', 'meaning', 'path'], trigger: 'loss-of-direction' },
  { keywords: ['fail', 'failure', 'mistake', 'wrong', 'messed up', 'regret'], trigger: 'failure-shame' },
  { keywords: ['lonely', 'alone', 'isolated', 'miss', 'missing'], trigger: 'loneliness' },
  { keywords: ['angry', 'anger', 'frustrated', 'unfair', 'injustice'], trigger: 'anger-injustice' },
  { keywords: ['change', 'moving', 'transition', 'new', 'different', 'leaving'], trigger: 'major-life-change' },
  { keywords: ['proud', 'success', 'achieved', 'accomplish', 'milestone', 'celebrate'], trigger: 'milestone-celebration' },
  { keywords: ['grief', 'loss', 'died', 'death', 'gone', 'mourning'], trigger: 'grief' },
  { keywords: ['decide', 'decision', 'choice', 'choose', 'crossroads', 'torn'], trigger: 'difficult-decision' },
  { keywords: ['love', 'relationship', 'partner', 'heart', 'romantic'], trigger: 'relationship-crossroads' },
  { keywords: ['identity', 'who am i', 'belong', 'culture', 'heritage', 'roots'], trigger: 'identity-belonging' },
  { keywords: ['grateful', 'thankful', 'blessed', 'appreciate', 'gratitude'], trigger: 'gratitude-reflection' },
]

function detectTrigger(text) {
  const lower = text.toLowerCase()
  for (const entry of FEELING_TRIGGER_MAP) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.trigger
  }
  return 'anxiety-overwhelm'
}

export default function WisdomChat({ passportId, passportInfo, onMemoryHighlight }) {
  const vault = useVault()
  const { getTokenForPassport } = useTokenStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [noToken, setNoToken] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset messages when passport changes
  useEffect(() => {
    setMessages([])
    setNoToken(false)
  }, [passportId])

  const ancestorName = passportInfo?.contributor || passportInfo?.familyName || 'Your ancestor'

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading || !passportId) return

    const stored = getTokenForPassport(passportId)
    if (!stored) {
      setNoToken(true)
      return
    }
    setNoToken(false)

    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    setLoading(true)

    const trigger = detectTrigger(text)
    const result = await vault.triggerWisdom(passportId, trigger, stored.token)

    if (result.error) {
      setMessages((prev) => [...prev, { role: 'error', text: result.error }])
    } else if (result.data) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ancestor',
          text: result.data.wisdom,
          trigger: result.data.trigger,
          memoriesUsed: result.data.memoriesUsed || [],
        },
      ])
      if (result.data.memoriesUsed?.length > 0 && onMemoryHighlight) {
        onMemoryHighlight(result.data.memoriesUsed.map((m) => m.memoryId))
      }
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-950/80 backdrop-blur-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <p className="text-[10px] text-white/30 uppercase tracking-widest">Speak with</p>
        <h3 className="text-lg font-semibold text-white/90 mt-0.5">{ancestorName}</h3>
        {passportInfo?.familyName && (
          <p className="text-xs text-white/40 mt-0.5">{passportInfo.familyName} Family</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/20 text-sm italic">
              Tell {ancestorName} how you&apos;re feeling...
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {[
                'I feel anxious about my future',
                'I failed at something important',
                'I feel lost and confused',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-indigo-600/80 text-white rounded-br-sm'
                  : msg.role === 'error'
                  ? 'bg-rose-900/40 text-rose-300 border border-rose-700/30 rounded-bl-sm'
                  : 'bg-amber-900/20 border border-amber-700/20 text-amber-100/90 rounded-bl-sm'
              }`}
            >
              {msg.role === 'ancestor' && (
                <p className="text-[10px] text-amber-500/60 uppercase tracking-wider mb-1.5 font-medium">
                  {ancestorName}
                </p>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              {msg.memoriesUsed?.length > 0 && (
                <p className="text-[10px] text-amber-500/40 mt-2">
                  Grounded in {msg.memoriesUsed.length} memor
                  {msg.memoriesUsed.length === 1 ? 'y' : 'ies'}
                </p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-amber-900/20 border border-amber-700/20 rounded-2xl rounded-bl-sm px-4 py-3">
              <p className="text-[10px] text-amber-500/60 uppercase tracking-wider mb-1.5 font-medium">
                {ancestorName}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {noToken && (
          <div className="bg-rose-900/30 border border-rose-700/30 rounded-xl px-4 py-3 text-sm text-rose-300">
            No consent token found. Go to{' '}
            <span className="font-medium text-rose-200">Consent</span> and grant access first.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="How are you feeling today?"
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 rounded-xl bg-amber-600/80 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
