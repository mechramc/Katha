/**
 * IngestTrigger.jsx — Upload JSONL files and manage passports.
 *
 * Provides a drag-and-drop file upload interface for ingesting persona data,
 * displays existing passports with memory counts, and allows deleting duplicates.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useVault } from '../hooks/useVault'

export default function IngestTrigger() {
  const vault = useVault()
  const [passports, setPassports] = useState([])
  const [memoryCounts, setMemoryCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Upload state
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null) // null | 'uploading' | 'processing' | 'done' | 'error'
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // Delete state
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const fetchData = useCallback(async () => {
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

    const counts = {}
    for (const p of list) {
      const memResult = await vault.getMemories(p.passportId, 1, 1)
      counts[p.passportId] = memResult.data?.total || 0
    }
    setMemoryCounts(counts)

    setError(null)
    setLoading(false)
    setRefreshing(false)
  }, [vault])

  useEffect(() => {
    fetchData()
  }, [])

  // --- File handling ---

  const handleFiles = (fileList) => {
    const jsonlFiles = Array.from(fileList).filter(
      (f) => f.name.endsWith('.jsonl') || f.name.endsWith('.json')
    )
    if (jsonlFiles.length === 0) return
    setSelectedFiles(jsonlFiles)
    setUploadResult(null)
    setUploadError(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleFileInput = (e) => {
    handleFiles(e.target.files)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    setUploading(true)
    setUploadProgress('uploading')
    setUploadResult(null)
    setUploadError(null)

    setUploadProgress('processing')
    const result = await vault.uploadPersona(selectedFiles)

    if (result.error) {
      setUploadProgress('error')
      setUploadError(result.error)
      setUploading(false)
      return
    }

    setUploadProgress('done')
    setUploadResult(result.data)
    setUploading(false)
    setSelectedFiles([])
    // Refresh passport list
    fetchData()
  }

  // --- Delete ---

  const handleDelete = async (passportId) => {
    setDeletingId(passportId)
    const result = await vault.deletePassport(passportId)
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    // Refresh
    fetchData()
  }

  const hasPassports = passports.length > 0

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Ingestion Pipeline</h2>
      <p className="text-slate-500 mb-8">
        Upload persona JSONL files to extract Living Memory Objects and create a Cultural Memory Passport.
      </p>

      {/* Upload Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6 ${
          dragOver
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jsonl,.json"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div>
            <p className="text-slate-700 font-medium">
              Drop JSONL files here or click to browse
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Accepts .jsonl and .json files from persona data directories
            </p>
          </div>
        </div>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-700">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            </p>
            <button
              onClick={() => { setSelectedFiles([]); setUploadResult(null); setUploadError(null) }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          </div>
          <ul className="space-y-1 text-sm text-slate-600 mb-4">
            {selectedFiles.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-400 rounded-full flex-shrink-0" />
                <span className="font-mono text-xs">{f.name}</span>
                <span className="text-slate-400 text-xs">({(f.size / 1024).toFixed(1)} KB)</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Ingesting...' : 'Start Ingestion'}
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress && uploadProgress !== 'done' && uploadProgress !== 'error' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <Spinner />
            <div>
              <p className="text-indigo-800 font-medium">
                {uploadProgress === 'uploading' && 'Uploading files...'}
                {uploadProgress === 'processing' && 'Running ingestion pipeline...'}
              </p>
              <p className="text-indigo-600 text-sm mt-1">
                {uploadProgress === 'processing' && 'Extracting wisdom via Claude API. This may take a couple of minutes.'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {['Upload', 'Extract', 'Classify', 'Assemble', 'Store'].map((step, i) => {
              const activeIdx = uploadProgress === 'uploading' ? 0 : 1
              return (
                <div key={step} className="flex-1">
                  <div className={`h-1.5 rounded-full ${i <= activeIdx ? 'bg-indigo-500' : 'bg-indigo-200'}`} />
                  <p className={`text-xs mt-1 text-center ${i <= activeIdx ? 'text-indigo-700 font-medium' : 'text-indigo-300'}`}>{step}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upload Success */}
      {uploadProgress === 'done' && uploadResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-emerald-800 font-semibold">Ingestion Complete</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-emerald-600">Records</p>
              <p className="text-emerald-900 font-bold text-lg">{uploadResult.totalRecords}</p>
            </div>
            <div>
              <p className="text-emerald-600">Wisdom Signals</p>
              <p className="text-emerald-900 font-bold text-lg">{uploadResult.wisdomSignals}</p>
            </div>
            <div>
              <p className="text-emerald-600">LMOs Created</p>
              <p className="text-emerald-900 font-bold text-lg">{uploadResult.lmosAfterGate}</p>
            </div>
            <div>
              <p className="text-emerald-600">Time</p>
              <p className="text-emerald-900 font-bold text-lg">{uploadResult.elapsedSeconds}s</p>
            </div>
          </div>
          <p className="text-emerald-600 text-xs mt-3 font-mono">
            Passport: {uploadResult.passportId}
          </p>
        </div>
      )}

      {/* Upload Error */}
      {uploadProgress === 'error' && uploadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6">
          <p className="text-rose-700 text-sm font-medium">Ingestion failed</p>
          <p className="text-rose-600 text-sm mt-1">{uploadError}</p>
        </div>
      )}

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
            Upload JSONL files above to create a Cultural Memory Passport.
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
                <div className="flex items-center gap-2">
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
                {/* Delete Button */}
                {confirmDeleteId === p.passportId ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(p.passportId)}
                      disabled={deletingId === p.passportId}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
                    >
                      {deletingId === p.passportId ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(p.passportId)}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                  >
                    Delete
                  </button>
                )}
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
