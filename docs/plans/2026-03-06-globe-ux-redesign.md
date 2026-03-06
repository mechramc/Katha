# Globe UX Redesign — Hackathon Demo Experience

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Globe into Katha's primary experience — a split-pane interface with conversational wisdom delivery on the left and the 3D Living Memory Globe on the right, with auto-token flow and ancestor filtering.

**Architecture:** The current separate GlobeView and WisdomDelivery screens merge into a single `GlobeExperience` screen. The left pane is a chat-style conversational interface where a descendant types how they're feeling and receives ancestor wisdom in their voice. The right pane is the existing Three.js globe. Consent tokens are auto-managed via localStorage so the user never sees a JWT. The Globe becomes the default route (`/`).

**Tech Stack:** React, Three.js (existing Globe component), Tailwind CSS, existing useVault hook, localStorage for token persistence.

---

## Task 1: Create Token Store (localStorage persistence)

**Files:**
- Create: `dashboard/src/hooks/useTokenStore.js`

**Step 1: Create the token store hook**

```js
// useTokenStore.js — Persist consent tokens in localStorage for auto-token flow.
// On consent grant, store { passportId, token, jti, scopes, grantedAt }.
// On wisdom request, retrieve the latest valid token for a passport.

import { useState, useCallback } from 'react'

const STORAGE_KEY = 'katha_consent_tokens'

function readTokens() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function writeTokens(tokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

export function useTokenStore() {
  const [tokens, setTokens] = useState(readTokens)

  const storeToken = useCallback((passportId, token, jti, scopes) => {
    const entry = { passportId, token, jti, scopes, grantedAt: new Date().toISOString() }
    const updated = [entry, ...readTokens().filter(t => t.jti !== jti)]
    writeTokens(updated)
    setTokens(updated)
    return entry
  }, [])

  const getTokenForPassport = useCallback((passportId) => {
    const all = readTokens()
    return all.find(t => t.passportId === passportId) || null
  }, [])

  const removeToken = useCallback((jti) => {
    const updated = readTokens().filter(t => t.jti !== jti)
    writeTokens(updated)
    setTokens(updated)
  }, [])

  return { tokens, storeToken, getTokenForPassport, removeToken }
}
```

**Step 2: Commit**

```bash
git add dashboard/src/hooks/useTokenStore.js
git commit -m "feat: add localStorage token store for auto-consent flow"
```

---

## Task 2: Update ConsentGrant to Store Tokens

**Files:**
- Modify: `dashboard/src/screens/ConsentGrant.jsx`

**Step 1: Wire token store into ConsentGrant**

Import `useTokenStore` and call `storeToken()` after a successful grant. Also call `removeToken()` on revoke.

Changes:
- Add `import { useTokenStore } from '../hooks/useTokenStore'`
- In component: `const { storeToken, removeToken } = useTokenStore()`
- In `handleGrant` success block (after line 111): add `storeToken(selectedPassport, result.data.token, result.data.jti, scopes)`
- In `handleRevoke` success block (after line 136): add `removeToken(jti)`

**Step 2: Commit**

```bash
git add dashboard/src/screens/ConsentGrant.jsx
git commit -m "feat: persist consent tokens to localStorage on grant/revoke"
```

---

## Task 3: Create the Conversational Wisdom Pane

**Files:**
- Create: `dashboard/src/components/globe/WisdomChat.jsx`

**Step 1: Build the chat component**

This is the left pane of the split layout. It shows:
- Ancestor context header (who the wisdom comes from)
- Chat-style message list (user prompts + ancestor responses)
- Text input at the bottom

The component receives `passportId`, `passportInfo`, `triggers`, and auto-fetches the consent token from localStorage.

```jsx
// WisdomChat.jsx — Conversational wisdom delivery pane.
// User types how they're feeling. Ancestor responds in their voice.

import { useState, useRef, useEffect } from 'react'
import { useVault } from '../../hooks/useVault'
import { useTokenStore } from '../../hooks/useTokenStore'

// Map free-text feelings to the closest trigger ID
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
    if (entry.keywords.some(k => lower.includes(k))) return entry.trigger
  }
  return 'anxiety-overwhelm' // default fallback
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

  const ancestorName = passportInfo?.contributor || passportInfo?.familyName || 'Your ancestor'

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading || !passportId) return

    // Get stored token
    const stored = getTokenForPassport(passportId)
    if (!stored) {
      setNoToken(true)
      return
    }
    setNoToken(false)

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setLoading(true)

    // Detect trigger from free text
    const trigger = detectTrigger(text)

    // Request wisdom
    const result = await vault.triggerWisdom(passportId, trigger, stored.token)

    if (result.error) {
      setMessages(prev => [...prev, { role: 'error', text: result.error }])
    } else if (result.data) {
      setMessages(prev => [...prev, {
        role: 'ancestor',
        text: result.data.wisdom,
        trigger: result.data.trigger,
        memoriesUsed: result.data.memoriesUsed || [],
      }])
      // Highlight matched memories on the globe
      if (result.data.memoriesUsed?.length > 0 && onMemoryHighlight) {
        onMemoryHighlight(result.data.memoriesUsed.map(m => m.memoryId))
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
        <p className="text-xs text-white/30 uppercase tracking-widest">Speak with</p>
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
              Tell {ancestorName} how you're feeling...
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {['I feel anxious about my future', 'I failed at something important', 'I feel lost and confused'].map(prompt => (
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
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-indigo-600/80 text-white rounded-br-sm'
                : msg.role === 'error'
                ? 'bg-rose-900/40 text-rose-300 border border-rose-700/30 rounded-bl-sm'
                : 'bg-amber-900/20 border border-amber-700/20 text-amber-100/90 rounded-bl-sm'
            }`}>
              {msg.role === 'ancestor' && (
                <p className="text-[10px] text-amber-500/60 uppercase tracking-wider mb-1.5 font-medium">
                  {ancestorName}
                </p>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              {msg.memoriesUsed?.length > 0 && (
                <p className="text-[10px] text-amber-500/40 mt-2">
                  Grounded in {msg.memoriesUsed.length} memor{msg.memoriesUsed.length === 1 ? 'y' : 'ies'}
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
            No consent token found. Go to <span className="font-medium text-rose-200">Consent</span> and grant access first.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={`How are you feeling today?`}
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
```

**Step 2: Commit**

```bash
git add dashboard/src/components/globe/WisdomChat.jsx
git commit -m "feat: add conversational WisdomChat pane for ancestor dialogue"
```

---

## Task 4: Create the GlobeExperience Split-Pane Layout

**Files:**
- Create: `dashboard/src/screens/GlobeExperience.jsx`

**Step 1: Build the split-pane screen**

This replaces the old GlobeView. Left pane = WisdomChat. Right pane = Globe. Ancestor dropdown at top.

```jsx
// GlobeExperience.jsx — The primary Katha experience.
// Split pane: conversational wisdom (left) + 3D globe (right).

import { useState, useEffect } from 'react'
import { useVault } from '../hooks/useVault'
import useGlobeData from '../components/globe/useGlobeData'
import Globe from '../components/globe/Globe'
import WisdomChat from '../components/globe/WisdomChat'

export default function GlobeExperience() {
  const vault = useVault()
  const [passports, setPassports] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const result = await vault.getPassports()
      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      const list = result.data?.passports || []
      setPassports(list)
      if (list.length > 0) setSelectedId(list[0].passportId)
      setLoading(false)
    }
    load()
  }, [])

  const passportInfo = passports.find(p => p.passportId === selectedId) || null

  // Fetch ALL memories (not just approved) — show the full globe
  const { memories, loading: memLoading, error: memError } = useGlobeData(selectedId)

  const [highlightedIds, setHighlightedIds] = useState([])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3 text-white/40">
          <Spinner />
          <span>Loading passports...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="bg-rose-900/50 border border-rose-700 rounded-lg p-6 max-w-md">
          <p className="text-rose-200 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (passports.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-white/50 font-medium">No passports yet</p>
          <p className="text-white/30 text-sm mt-1">Ingest ancestor data to begin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Top bar — ancestor selector */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-slate-950/90 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-white/90 tracking-tight">KATHA</h1>
          <span className="text-white/20">|</span>
          <span className="text-sm text-white/50">Living Memory Globe</span>
        </div>
        {passports.length > 1 && (
          <select
            value={selectedId || ''}
            onChange={e => setSelectedId(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-white/70 border border-white/10 focus:ring-1 focus:ring-amber-500/50"
          >
            {passports.map(p => (
              <option key={p.passportId} value={p.passportId}>
                {p.familyName || p.contributor}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Split pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Conversational Wisdom */}
        <div className="w-[380px] flex-shrink-0 border-r border-white/5">
          <WisdomChat
            passportId={selectedId}
            passportInfo={passportInfo}
            onMemoryHighlight={setHighlightedIds}
          />
        </div>

        {/* Right: Globe */}
        <div className="flex-1 relative">
          {memLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Spinner />
            </div>
          )}
          {memError && (
            <div className="absolute top-4 left-4 right-4 z-10 bg-rose-900/50 border border-rose-700 rounded-lg p-3">
              <p className="text-rose-200 text-xs">{memError}</p>
            </div>
          )}
          <Globe memories={memories} />

          {/* Memory count badge */}
          {memories.length > 0 && (
            <div className="absolute bottom-4 right-4 z-10">
              <span className="text-xs text-white/30 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                {memories.length} memories
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-amber-400/60" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
```

**Step 2: Commit**

```bash
git add dashboard/src/screens/GlobeExperience.jsx
git commit -m "feat: add GlobeExperience split-pane screen"
```

---

## Task 5: Update App.jsx — Globe as Default Route

**Files:**
- Modify: `dashboard/src/App.jsx`

**Step 1: Rewire routes**

- Import `GlobeExperience`
- Make Globe the default route (`/`)
- Move Ingest to `/ingest`
- Remove separate `/wisdom` route (merged into Globe)
- Reorder nav: Globe first, then Ingest, Memories, Consent, Audit, Export

Changes to `App.jsx`:
```jsx
// Add import
import GlobeExperience from './screens/GlobeExperience'

// Update NAV_ITEMS — Globe first, Wisdom removed
const NAV_ITEMS = [
  { to: '/', label: 'Globe', icon: GlobeIcon },
  { to: '/ingest', label: 'Ingest', icon: UploadIcon },
  { to: '/memories', label: 'Memories', icon: BrainIcon },
  { to: '/consent', label: 'Consent', icon: ShieldIcon },
  { to: '/audit', label: 'Audit Log', icon: ListIcon },
  { to: '/export', label: 'Export', icon: DownloadIcon },
]

// Update Routes
<Routes>
  <Route path="/" element={<GlobeExperience />} />
  <Route path="/ingest" element={<IngestTrigger />} />
  <Route path="/memories" element={<MemoryApproval />} />
  <Route path="/consent" element={<ConsentGrant />} />
  <Route path="/audit" element={<AuditLog />} />
  <Route path="/export" element={<PassportExport />} />
</Routes>
```

Remove the WisdomDelivery and old GlobeView imports (keep files for reference but remove from routes).

**Step 2: Commit**

```bash
git add dashboard/src/App.jsx
git commit -m "feat: make Globe the default route, merge wisdom into globe experience"
```

---

## Task 6: Fix useGlobeData to Use Correct Base URL

**Files:**
- Modify: `dashboard/src/components/globe/useGlobeData.js:12`

**Step 1: Fix hardcoded base URL**

The hook hardcodes `const VAULT_BASE = '/api'` but production uses `VITE_VAULT_URL=/katha/api`. Fix:

```js
const VAULT_BASE = import.meta.env.VITE_VAULT_URL || '/api'
```

**Step 2: Show all memories, not just approved**

In `GlobeExperience` we already pass all memories (not filtering by `approvedBy`). The old `GlobeView` filtered — the new one doesn't. No change needed in the hook itself.

**Step 3: Commit**

```bash
git add dashboard/src/components/globe/useGlobeData.js
git commit -m "fix: use VITE_VAULT_URL env var in useGlobeData hook"
```

---

## Task 7: Build and Test Locally

**Step 1: Run dev server**

```bash
cd C:/Github/Katha/dashboard
npm run dev
```

**Step 2: Verify**

- Default route shows the Globe Experience split pane
- Left pane shows "Speak with [ancestor name]" header
- Suggested prompts appear when no messages
- Typing and sending a message triggers wisdom delivery
- Globe renders on the right
- Ancestor selector dropdown works (if multiple passports)
- Consent page stores tokens to localStorage
- Nav sidebar shows Globe first

**Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete Globe UX redesign for hackathon demo"
```

---

## Task 8: Deploy to Production

**Step 1: Push to GitHub**

```bash
cd C:/Github/Katha
git push origin main
```

**Step 2: Rebuild Cloudflare Pages**

The dashboard auto-deploys via Cloudflare Pages on push. Verify at https://murailabs.com/katha/

**Step 3: Verify prod**

- Globe loads as default view
- Wisdom chat works end-to-end
- No 522 errors (if vault has data)

---

## Summary of Changes

| File | Action | Purpose |
|------|--------|---------|
| `hooks/useTokenStore.js` | Create | localStorage token persistence |
| `screens/ConsentGrant.jsx` | Modify | Store tokens on grant/revoke |
| `components/globe/WisdomChat.jsx` | Create | Conversational wisdom pane |
| `screens/GlobeExperience.jsx` | Create | Split-pane primary experience |
| `App.jsx` | Modify | Globe as default route, remove wisdom route |
| `components/globe/useGlobeData.js` | Modify | Fix VITE_VAULT_URL usage |

**Old files kept but removed from routes:** `GlobeView.jsx`, `WisdomDelivery.jsx`
