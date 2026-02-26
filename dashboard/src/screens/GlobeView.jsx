/**
 * GlobeView.jsx — Wrapper that renders the Globe component.
 *
 * Fetches passport data via useVault, transforms it through useGlobeData,
 * and passes the globe-ready memories to the Globe component.
 *
 * The Globe component manages its own MemoryCard overlay internally.
 */

import { useState, useEffect } from 'react'
import { useVault } from '../hooks/useVault'
import useGlobeData from '../components/globe/useGlobeData'
import Globe from '../components/globe/Globe'

export default function GlobeView() {
  const vault = useVault()
  const [passportId, setPassportId] = useState(null)
  const [passportInfo, setPassportInfo] = useState(null)
  const [loadingPassport, setLoadingPassport] = useState(true)
  const [passportError, setPassportError] = useState(null)

  // Fetch passport list to get the first passport ID
  useEffect(() => {
    async function load() {
      const result = await vault.getPassports()
      if (result.error) {
        setPassportError(result.error)
        setLoadingPassport(false)
        return
      }

      const passports = result.data?.passports || []
      if (passports.length > 0) {
        setPassportId(passports[0].passportId)
        setPassportInfo(passports[0])
      }
      setLoadingPassport(false)
    }
    load()
  }, [])

  // useGlobeData fetches and transforms memories for the globe
  const { memories, loading: loadingMemories, error: memoriesError } = useGlobeData(passportId)

  const loading = loadingPassport || loadingMemories
  const error = passportError || memoriesError

  // Filter to approved memories only
  const approvedMemories = memories.filter((m) => m.approvedBy)

  return (
    <div className="relative h-full w-full bg-slate-950 overflow-hidden">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6 pointer-events-none">
        <h2 className="text-xl font-bold text-white/90">Living Memory Globe</h2>
        {passportInfo && (
          <p className="text-sm text-white/50 mt-1">
            {passportInfo.familyName} — {approvedMemories.length} approved memories
          </p>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="flex items-center gap-3 text-white/60">
            <Spinner />
            <span>Loading memories...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute top-20 left-6 right-6 z-20">
          <div className="bg-rose-900/50 border border-rose-700 rounded-lg p-4">
            <p className="text-rose-200 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && approvedMemories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-center">
            <p className="text-white/60 font-medium">No approved memories to display</p>
            <p className="text-white/40 text-sm mt-1">
              Approve memories in the Memory Approval screen first.
            </p>
          </div>
        </div>
      )}

      {/* Globe — manages its own MemoryCard overlay internally */}
      {!loading && approvedMemories.length > 0 && (
        <Globe memories={approvedMemories} />
      )}

      {/* Legend */}
      {!loading && approvedMemories.length > 0 && (
        <div className="absolute bottom-6 left-6 z-10 bg-slate-900/80 border border-slate-700 rounded-lg p-4 pointer-events-none">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">Legend</p>
          <div className="space-y-1.5 text-xs text-white/70">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-400" />
              Recorded memory (pulsing)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-400 border border-dashed border-orange-300" />
              Reconstructed memory (ringed)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white/40" />
              <span className="w-4 h-4 rounded-full bg-white/40" />
              Size = emotional weight
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-indigo-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
