/**
 * PassportExport.jsx — Passport export UI.
 *
 * Exports the Cultural Memory Passport as valid JSON-LD.
 * Shows passport summary, memory count, triggers populated.
 * Downloads as .json file.
 */

import { useState, useEffect } from 'react'
import { useVault } from '../hooks/useVault'

export default function PassportExport() {
  const vault = useVault()
  const [passports, setPassports] = useState([])
  const [selectedPassport, setSelectedPassport] = useState(null)
  const [exportedData, setExportedData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)
  const [validationResult, setValidationResult] = useState(null)

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
      if (list.length > 0) {
        setSelectedPassport(list[0].passportId)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleExport = async () => {
    if (!selectedPassport) return
    setExporting(true)
    setError(null)
    setValidationResult(null)

    const result = await vault.exportPassport(selectedPassport)
    if (result.error) {
      setError(result.error)
      setExporting(false)
      return
    }

    setExportedData(result.data)
    validatePassport(result.data)
    setExporting(false)
  }

  const validatePassport = (data) => {
    const checks = []

    // Check required JSON-LD fields
    checks.push({
      label: '@context present',
      pass: !!data['@context'],
    })
    checks.push({
      label: '@type is CulturalMemoryPassport',
      pass: data['@type'] === 'CulturalMemoryPassport',
    })
    checks.push({
      label: 'Heritage information present',
      pass: !!data.heritage,
    })
    checks.push({
      label: 'Memories array present',
      pass: Array.isArray(data.memories),
    })
    checks.push({
      label: 'Has at least one memory',
      pass: Array.isArray(data.memories) && data.memories.length > 0,
    })
    checks.push({
      label: 'Situational index present',
      pass: !!data.situationalIndex && typeof data.situationalIndex === 'object',
    })
    checks.push({
      label: 'All memories have memoryType',
      pass: Array.isArray(data.memories) && data.memories.every((m) => m.memoryType),
    })
    checks.push({
      label: 'All memories have emotionalWeight',
      pass: Array.isArray(data.memories) && data.memories.every((m) => typeof m.emotionalWeight === 'number'),
    })

    setValidationResult(checks)
  }

  const handleDownload = () => {
    if (!exportedData) return
    const json = JSON.stringify(exportedData, null, 2)
    const blob = new Blob([json], { type: 'application/ld+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const familyName = exportedData.heritage?.familyName || 'passport'
    a.download = `katha-${familyName.toLowerCase().replace(/\s+/g, '-')}-passport.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const triggerCount = exportedData?.situationalIndex
    ? Object.keys(exportedData.situationalIndex).length
    : 0

  const allPassing = validationResult?.every((c) => c.pass)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Passport Export</h2>
      <p className="text-slate-500 mb-8">
        Export the Cultural Memory Passport as a portable JSON-LD document.
      </p>

      {loading && (
        <div className="flex items-center gap-3 text-slate-500 py-12 justify-center">
          <Spinner />
          <span>Loading...</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6">
          <p className="text-rose-700 text-sm">{error}</p>
        </div>
      )}

      {!loading && passports.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-600 font-medium">No passports found</p>
          <p className="text-slate-400 text-sm mt-1">Ingest data first to create a passport.</p>
        </div>
      )}

      {!loading && passports.length > 0 && (
        <>
          {/* Passport selector + export button */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Passport</label>
                <select
                  value={selectedPassport || ''}
                  onChange={(e) => {
                    setSelectedPassport(e.target.value)
                    setExportedData(null)
                    setValidationResult(null)
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {passports.map((p) => (
                    <option key={p.passportId} value={p.passportId}>
                      {p.familyName} — {p.contributor}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting || !selectedPassport}
                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {exporting ? 'Exporting...' : 'Generate Export'}
              </button>
            </div>
          </div>

          {/* Export Results */}
          {exportedData && (
            <>
              {/* Summary */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Passport Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryCard
                    label="Family"
                    value={exportedData.heritage?.familyName || '—'}
                  />
                  <SummaryCard
                    label="Memories"
                    value={exportedData.memories?.length || 0}
                  />
                  <SummaryCard
                    label="Triggers Populated"
                    value={triggerCount}
                  />
                  <SummaryCard
                    label="Version"
                    value={exportedData.meta?.version || '1.0'}
                  />
                </div>

                {/* Trigger list */}
                {triggerCount > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">
                      Situational Triggers
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(exportedData.situationalIndex).map(([trigger, ids]) => (
                        <span
                          key={trigger}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600 font-mono"
                        >
                          {trigger}
                          <span className="ml-1.5 bg-indigo-100 text-indigo-500 px-1 rounded">
                            {ids.length}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Validation */}
              {validationResult && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Schema Validation</h3>
                    {allPassing ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                        <CheckCircleIcon className="w-5 h-5" />
                        All checks passing
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-rose-600">
                        <XCircleIcon className="w-5 h-5" />
                        Some checks failing
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {validationResult.map((check, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {check.pass ? (
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">
                            &#10003;
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs">
                            &#10007;
                          </span>
                        )}
                        <span className={check.pass ? 'text-slate-600' : 'text-rose-700 font-medium'}>
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download */}
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Download JSON-LD
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(exportedData, null, 2))
                  }}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Copy to Clipboard
                </button>
              </div>

              {/* JSON Preview */}
              <div className="mt-6">
                <details>
                  <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700 font-medium">
                    View raw JSON-LD
                  </summary>
                  <pre className="mt-3 bg-slate-900 text-slate-200 rounded-xl p-4 text-xs overflow-auto max-h-96 font-mono">
                    {JSON.stringify(exportedData, null, 2)}
                  </pre>
                </details>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-1">{value}</p>
    </div>
  )
}

function CheckCircleIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function XCircleIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
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
