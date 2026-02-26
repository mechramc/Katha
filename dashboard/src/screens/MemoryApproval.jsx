/**
 * MemoryApproval.jsx — Parent approval flow for LMOs.
 *
 * Displays extracted memories for parent review.
 * Parent must approve each LMO individually before it enters the passport.
 * This is a HARD GATE — no LMO bypasses parent approval.
 *
 * Must visually distinguish recorded vs reconstructed memories.
 */

import { useState, useEffect } from 'react'
import { useVault } from '../hooks/useVault'

const APPROVER_NAME = 'Parent (Demo)'

export default function MemoryApproval() {
  const vault = useVault()
  const [passportId, setPassportId] = useState(null)
  const [passports, setPassports] = useState([])
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [approvingId, setApprovingId] = useState(null)

  // Load passports on mount
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
        setPassportId(list[0].passportId)
      }
      setLoading(false)
    }
    load()
  }, [])

  // Load memories when passportId changes
  useEffect(() => {
    if (!passportId) return
    async function loadMemories() {
      setLoading(true)
      const result = await vault.getMemories(passportId)
      if (result.error) {
        setError(result.error)
      } else {
        setMemories(result.data?.memories || [])
        setError(null)
      }
      setLoading(false)
    }
    loadMemories()
  }, [passportId])

  const handleApprove = async (memoryId) => {
    setApprovingId(memoryId)
    const result = await vault.approveMemory(memoryId, APPROVER_NAME)
    if (result.error) {
      setError(result.error)
    } else {
      // Update local state
      setMemories((prev) =>
        prev.map((m) =>
          m.memoryId === memoryId
            ? { ...m, approvedBy: APPROVER_NAME, approvedAt: new Date().toISOString() }
            : m
        )
      )
    }
    setApprovingId(null)
  }

  const unapproved = memories.filter((m) => !m.approvedBy)
  const approved = memories.filter((m) => m.approvedBy)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Memory Approval</h2>
      <p className="text-slate-500 mb-6">
        Review each extracted memory. Only approved memories enter the Cultural Memory Passport.
      </p>

      {/* Passport selector */}
      {passports.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Passport</label>
          <select
            value={passportId || ''}
            onChange={(e) => setPassportId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {passports.map((p) => (
              <option key={p.passportId} value={p.passportId}>
                {p.familyName} ({p.contributor})
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6">
          <p className="text-rose-700 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-slate-500 py-12 justify-center">
          <Spinner />
          <span>Loading memories...</span>
        </div>
      )}

      {!loading && memories.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-600 font-medium">No memories found</p>
          <p className="text-slate-400 text-sm mt-1">
            Run the ingestion pipeline first to extract Living Memory Objects.
          </p>
        </div>
      )}

      {/* Pending Approval */}
      {unapproved.length > 0 && (
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-400 rounded-full" />
            Pending Approval
            <span className="text-sm font-normal text-slate-500">({unapproved.length})</span>
          </h3>
          <div className="space-y-4">
            {unapproved.map((memory) => (
              <MemoryCard
                key={memory.memoryId}
                memory={memory}
                onApprove={handleApprove}
                approving={approvingId === memory.memoryId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-emerald-500 rounded-full" />
            Approved
            <span className="text-sm font-normal text-slate-500">({approved.length})</span>
          </h3>
          <div className="space-y-4">
            {approved.map((memory) => (
              <MemoryCard key={memory.memoryId} memory={memory} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function MemoryCard({ memory, onApprove, approving }) {
  const isRecorded = memory.memoryType === 'recorded'
  const isApproved = !!memory.approvedBy

  return (
    <div
      className={`bg-white border rounded-xl p-5 shadow-sm transition-colors ${
        isApproved ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Memory type badge */}
          {isRecorded ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
              Recorded
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-dashed border-orange-300">
              Reconstructed — family testimony
            </span>
          )}

          {/* Life theme */}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {memory.lifeTheme}
          </span>
        </div>

        {/* Emotional weight */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-500">Weight</span>
          <EmotionalWeightBar value={memory.emotionalWeight} />
          <span className="text-sm font-bold text-slate-700 w-5 text-right">
            {memory.emotionalWeight}
          </span>
        </div>
      </div>

      {/* Memory text */}
      <p className="text-slate-800 text-sm leading-relaxed mb-3">{memory.text}</p>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
        <span>Source: {memory.sourceRef}</span>
        <span>Contributor: {memory.contributorName}</span>
      </div>

      {/* Situational tags */}
      {memory.situationalTags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {memory.situationalTags.map((tag) => (
            <span
              key={tag}
              className="inline-block px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600 font-mono"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-xs font-mono text-slate-400">{memory.memoryId}</span>
        {isApproved ? (
          <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
            <CheckIcon className="w-4 h-4" />
            Approved by {memory.approvedBy}
          </span>
        ) : onApprove ? (
          <button
            onClick={() => onApprove(memory.memoryId)}
            disabled={approving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {approving ? 'Approving...' : 'Approve Memory'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function EmotionalWeightBar({ value }) {
  const width = (value / 10) * 100
  const color =
    value >= 8 ? 'bg-rose-500' : value >= 6 ? 'bg-amber-500' : 'bg-slate-300'

  return (
    <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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
