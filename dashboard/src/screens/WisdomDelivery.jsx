/**
 * WisdomDelivery.jsx — Deliver ancestor wisdom based on situational triggers.
 *
 * Core demo screen: descendant selects a trigger, pastes a consent JWT,
 * and receives grounded ancestor wisdom from the engine.
 */

import { useState, useEffect, useCallback } from 'react'
import { useVault } from '../hooks/useVault'

export default function WisdomDelivery() {
  const vault = useVault()

  // Form state
  const [passports, setPassports] = useState([])
  const [triggers, setTriggers] = useState([])
  const [selectedPassport, setSelectedPassport] = useState('')
  const [selectedTrigger, setSelectedTrigger] = useState('')
  const [token, setToken] = useState('')

  // Request state
  const [loading, setLoading] = useState(false)
  const [wisdom, setWisdom] = useState(null)
  const [error, setError] = useState(null)

  // Initial data loading
  const [initLoading, setInitLoading] = useState(true)
  const [initError, setInitError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      const [passportRes, triggerRes] = await Promise.all([
        vault.getPassports(),
        vault.getTriggers(),
      ])
      if (cancelled) return

      if (passportRes.error) {
        setInitError(passportRes.error)
        setInitLoading(false)
        return
      }
      if (triggerRes.error) {
        setInitError(triggerRes.error)
        setInitLoading(false)
        return
      }

      const list = passportRes.data?.passports || []
      setPassports(list)
      if (list.length > 0) setSelectedPassport(list[0].passportId)

      const trigList = triggerRes.data?.triggers || []
      setTriggers(trigList)
      if (trigList.length > 0) setSelectedTrigger(trigList[0].id)

      setInitLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [])

  const handleRequest = useCallback(async () => {
    if (!selectedPassport || !selectedTrigger || !token.trim()) return

    setLoading(true)
    setWisdom(null)
    setError(null)

    const result = await vault.triggerWisdom(selectedPassport, selectedTrigger, token.trim())

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setWisdom(result.data)
    }
    setLoading(false)
  }, [vault, selectedPassport, selectedTrigger, token])

  const canSubmit = selectedPassport && selectedTrigger && token.trim() && !loading

  const selectedTriggerInfo = triggers.find((t) => t.id === selectedTrigger)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Wisdom Delivery</h2>
      <p className="text-slate-500 mb-8">
        Receive ancestor wisdom grounded in real memories, delivered at the right moment.
      </p>

      {/* Init loading / error */}
      {initLoading && (
        <div className="flex items-center gap-3 text-slate-500">
          <Spinner />
          <span>Loading passports and triggers...</span>
        </div>
      )}

      {initError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6">
          <p className="text-rose-700 text-sm font-medium">Connection error</p>
          <p className="text-rose-600 text-sm mt-1">{initError}</p>
          <p className="text-rose-500 text-xs mt-2">
            Make sure vault (<code className="bg-rose-100 px-1 rounded">port 3001</code>) and engine (<code className="bg-rose-100 px-1 rounded">port 3002</code>) are running.
          </p>
        </div>
      )}

      {!initLoading && !initError && (
        <>
          {/* Request Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Passport selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Passport</label>
                <select
                  value={selectedPassport}
                  onChange={(e) => setSelectedPassport(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {passports.length === 0 && <option value="">No passports found</option>}
                  {passports.map((p) => (
                    <option key={p.passportId} value={p.passportId}>
                      {p.familyName || p.contributor} — {p.passportId.slice(0, 8)}...
                    </option>
                  ))}
                </select>
              </div>

              {/* Trigger selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Situational Trigger</label>
                <select
                  value={selectedTrigger}
                  onChange={(e) => setSelectedTrigger(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {triggers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Trigger description */}
            {selectedTriggerInfo && (
              <p className="text-xs text-slate-400 mb-4 italic">
                {selectedTriggerInfo.description}
              </p>
            )}

            {/* Token input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Consent Token (JWT)</label>
              <textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                rows={3}
                placeholder="Paste a consent JWT from the Consent screen (grant with katha:read:memories scope)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400"
              />
              <p className="text-xs text-slate-400 mt-1">
                Go to Consent → grant access with <code className="bg-slate-100 px-1 rounded">katha:read:memories</code> scope → copy the token.
              </p>
            </div>

            {/* Submit */}
            <button
              onClick={handleRequest}
              disabled={!canSubmit}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner light />
                  Requesting wisdom...
                </span>
              ) : (
                'Request Ancestor Wisdom'
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-rose-700 font-semibold">Wisdom Delivery Failed</p>
              </div>
              <p className="text-rose-600 text-sm">{error}</p>
              {(error.includes('revoked') || error.includes('401') || error.includes('Invalid')) && (
                <p className="text-rose-500 text-xs mt-2">
                  The consent token may have been revoked or expired. Grant a new token on the Consent screen.
                </p>
              )}
            </div>
          )}

          {/* Wisdom Response */}
          {wisdom && (
            <div className="space-y-4">
              {/* Wisdom text */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-amber-900">Ancestor Wisdom</h3>
                  <span className="ml-auto text-xs text-amber-500 font-mono">{wisdom.trigger}</span>
                </div>
                <p className="text-amber-900 leading-relaxed whitespace-pre-wrap">{wisdom.wisdom}</p>
              </div>

              {/* Grounding: memories used */}
              {wisdom.memoriesUsed && wisdom.memoriesUsed.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Grounding — {wisdom.memoriesUsed.length} memor{wisdom.memoriesUsed.length === 1 ? 'y' : 'ies'} used
                  </h4>
                  <div className="space-y-3">
                    {wisdom.memoriesUsed.map((m) => (
                      <div
                        key={m.memoryId}
                        className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                      >
                        {/* Type badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5 ${
                            m.memoryType === 'recorded'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-violet-100 text-violet-700'
                          }`}
                        >
                          {m.memoryType}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">{m.contributorName}</span>
                            <span className="text-xs text-slate-400">|</span>
                            <span className="text-xs text-slate-500">{m.lifeTheme}</span>
                            <span className="text-xs text-slate-400">|</span>
                            <span className="text-xs text-slate-500">match: {m.matchType}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full max-w-[80px]">
                              <div
                                className="h-1.5 bg-amber-500 rounded-full"
                                style={{ width: `${m.emotionalWeight * 10}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400">weight {m.emotionalWeight}/10</span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-1">{m.memoryId}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No memories matched */}
              {wisdom.memoriesUsed && wisdom.memoriesUsed.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-slate-500 text-sm">
                    No specific memories matched this trigger. The response is a general message.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Spinner({ light }) {
  return (
    <svg
      className={`animate-spin h-5 w-5 ${light ? 'text-white' : 'text-indigo-500'}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
