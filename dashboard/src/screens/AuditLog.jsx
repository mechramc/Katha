/**
 * AuditLog.jsx — Audit log viewer.
 *
 * Displays the immutable audit trail.
 * Read-only — no editing or deletion allowed.
 * Color-coded by action type, paginated, newest first.
 */

import { useState, useEffect } from 'react'
import { useVault } from '../hooks/useVault'

const ACTION_STYLES = {
  'consent.grant': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'consent.revoke': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  'passport.read': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'passport.create': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  'passport.update': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  'passport.export': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  'memory.store': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'memory.approve': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
}

const DEFAULT_STYLE = { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' }

function getActionStyle(action) {
  return ACTION_STYLES[action] || DEFAULT_STYLE
}

export default function AuditLog() {
  const vault = useVault()
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const limit = 20

  const fetchEntries = async (pageNum) => {
    setLoading(true)
    const result = await vault.getAuditLog(pageNum, limit)
    if (result.error) {
      setError(result.error)
    } else {
      setEntries(result.data?.entries || result.data?.logs || [])
      setTotal(result.data?.total || 0)
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchEntries(page)
  }, [page])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Audit Log</h2>
          <p className="text-slate-500 text-sm">
            Immutable record of all vault operations. {total > 0 && `${total} entries total.`}
          </p>
        </div>
        <button
          onClick={() => fetchEntries(page)}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6">
          <p className="text-rose-700 text-sm">{error}</p>
        </div>
      )}

      {loading && entries.length === 0 && (
        <div className="flex items-center gap-3 text-slate-500 py-12 justify-center">
          <Spinner />
          <span>Loading audit log...</span>
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-600 font-medium">No audit entries yet</p>
          <p className="text-slate-400 text-sm mt-1">
            Vault operations will appear here as they occur.
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <>
          {/* Timeline feed */}
          <div className="space-y-3">
            {entries.map((entry, idx) => {
              const style = getActionStyle(entry.action)
              let details = entry.details
              if (typeof details === 'string') {
                try {
                  details = JSON.parse(details)
                } catch {
                  // keep as string
                }
              }

              return (
                <div
                  key={entry.id || idx}
                  className={`${style.bg} border ${style.border} rounded-lg p-4`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${style.dot} flex-shrink-0 mt-0.5`} />
                      <div>
                        <p className={`text-sm font-semibold ${style.text}`}>
                          {entry.action}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Actor: {entry.actor || 'system'}
                          {entry.passportId && (
                            <span className="ml-3">
                              Passport: <span className="font-mono">{entry.passportId.slice(0, 8)}...</span>
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <time className="text-xs text-slate-400 flex-shrink-0">
                      {entry.timestamp
                        ? new Date(entry.timestamp).toLocaleString()
                        : entry.createdAt
                          ? new Date(entry.createdAt).toLocaleString()
                          : '—'}
                    </time>
                  </div>

                  {details && typeof details === 'object' && Object.keys(details).length > 0 && (
                    <div className="mt-2 ml-5.5 pl-3 border-l-2 border-slate-200">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {Object.entries(details).map(([key, value]) => (
                          <span key={key} className="text-xs text-slate-500">
                            <span className="font-medium text-slate-600">{key}:</span>{' '}
                            <span className="font-mono">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {details && typeof details === 'string' && (
                    <p className="mt-2 ml-5.5 text-xs text-slate-500 font-mono">{details}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
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
