/**
 * IngestTrigger.jsx — UI to show ingestion pipeline status.
 *
 * For the hackathon demo, ingestion is run via CLI:
 *   cd ingest && python demo_flow.py
 *
 * This screen shows the resulting passport and memory count from the vault,
 * and provides a link to Memory Approval once ingestion is complete.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useVault } from '../hooks/useVault'

const PERSONA_NAME = 'Sunita Rajan'
const PERSONA_PATH = '../data/persona_p04/'

export default function IngestTrigger() {
  const vault = useVault()
  const [passports, setPassports] = useState([])
  const [memoryCounts, setMemoryCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    setRefreshing(true)
    const result = await vault.getPassports()
    if (result.error) {
      setError(result.error)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const list = result.data?.passports || []
    setPassports(list)

    // Fetch memory counts per passport
    const counts = {}
    for (const p of list) {
      const memResult = await vault.getMemories(p.passportId, 1, 1)
      counts[p.passportId] = memResult.data?.total || 0
    }
    setMemoryCounts(counts)

    setError(null)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const hasPassports = passports.length > 0

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Ingestion Pipeline</h2>
      <p className="text-slate-500 mb-8">
        Run the ingestion pipeline to extract Living Memory Objects from personal data.
      </p>

      {/* CLI Instructions Card */}
      <div className="bg-slate-900 rounded-xl p-6 mb-8 text-sm font-mono text-slate-200">
        <p className="text-slate-400 mb-3 font-sans text-xs uppercase tracking-wide font-semibold">
          Run in terminal
        </p>
        <div className="space-y-1">
          <p className="text-emerald-400">$ cd ingest</p>
          <p className="text-emerald-400">$ python demo_flow.py --persona {PERSONA_PATH}</p>
        </div>
        <p className="text-slate-500 mt-4 font-sans text-xs">
          Target: &lt; 90 seconds for {PERSONA_NAME} persona
        </p>
      </div>

      {/* Status Section */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">Vault Status</h3>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-slate-500">
          <Spinner />
          <span>Connecting to vault...</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6">
          <p className="text-rose-700 text-sm font-medium">Vault connection error</p>
          <p className="text-rose-600 text-sm mt-1">{error}</p>
          <p className="text-rose-500 text-xs mt-2">
            Make sure the vault is running: <code className="bg-rose-100 px-1 rounded">cd vault && npm start</code>
          </p>
        </div>
      )}

      {!loading && !error && !hasPassports && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium mb-1">No passports found</p>
          <p className="text-amber-600 text-sm">
            Run the ingestion pipeline above to create a Cultural Memory Passport.
          </p>
        </div>
      )}

      {!loading && !error && hasPassports && (
        <div className="space-y-4">
          {passports.map((p) => (
            <div
              key={p.passportId}
              className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">{p.familyName}</h4>
                  <p className="text-sm text-slate-500 mt-1">
                    Contributor: {p.contributor}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    ID: {p.passportId}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                    Ingested
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-6 text-sm text-slate-600">
                <div>
                  <span className="font-semibold text-slate-900 text-lg">
                    {memoryCounts[p.passportId] ?? '...'}
                  </span>{' '}
                  memories
                </div>
                <div className="text-slate-400">|</div>
                <div>
                  Created {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <Link
                  to="/memories"
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  Review Memories
                </Link>
                <Link
                  to="/globe"
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  View Globe
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
