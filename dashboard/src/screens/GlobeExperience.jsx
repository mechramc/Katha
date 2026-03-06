/**
 * GlobeExperience.jsx — The primary Katha experience.
 *
 * Split pane: conversational wisdom (left) + 3D Living Memory Globe (right).
 * Ancestor selector at top. Globe component is embedded untouched.
 */

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

  const passportInfo = passports.find((p) => p.passportId === selectedId) || null
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
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-slate-950/90 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-white/90 tracking-tight">KATHA</h1>
          <span className="text-white/20">|</span>
          <span className="text-sm text-white/50">Living Memory Globe</span>
        </div>
        {passports.length > 1 && (
          <select
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-white/70 border border-white/10 focus:ring-1 focus:ring-amber-500/50"
          >
            {passports.map((p) => (
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
            <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
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
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
