/**
 * ConsentGrant.jsx — Plain-language scope granting UI.
 *
 * Presents consent options in human-readable language.
 * Maps user choices to JWT scopes.
 * Supports grant, revoke, and re-grant flows.
 */

import { useState, useEffect } from 'react'
import { useVault } from '../hooks/useVault'

const SCOPE_DEFINITIONS = [
  {
    scope: 'katha:read:memories',
    label: 'Read family memories',
    description: 'Access to view extracted Living Memory Objects from the Cultural Memory Passport.',
  },
  {
    scope: 'katha:read:values',
    label: 'Read family values',
    description: 'Access to view family heritage values and cultural context.',
  },
  {
    scope: 'katha:read:passport',
    label: 'Read full passport',
    description: 'Access to view the complete Cultural Memory Passport document.',
  },
  {
    scope: 'katha:trigger:wisdom',
    label: 'Receive situational wisdom',
    description: 'Allow the wisdom engine to deliver ancestor memories at the right moment.',
  },
]

export default function ConsentGrant() {
  const vault = useVault()
  const [passports, setPassports] = useState([])
  const [selectedPassport, setSelectedPassport] = useState(null)
  const [selectedScopes, setSelectedScopes] = useState({})
  const [tokens, setTokens] = useState([])
  const [granting, setGranting] = useState(false)
  const [revokingJti, setRevokingJti] = useState(null)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [loading, setLoading] = useState(true)

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
        setSelectedPassport(list[0].passportId)
      }
      setLoading(false)
    }
    load()
  }, [])

  const toggleScope = (scope) => {
    setSelectedScopes((prev) => ({
      ...prev,
      [scope]: !prev[scope],
    }))
    setSuccessMsg(null)
  }

  const handleGrant = async () => {
    const scopes = Object.entries(selectedScopes)
      .filter(([, enabled]) => enabled)
      .map(([scope]) => scope)

    if (scopes.length === 0) {
      setError('Select at least one scope to grant access.')
      return
    }

    setGranting(true)
    setError(null)
    setSuccessMsg(null)

    const result = await vault.grantConsent(selectedPassport, scopes)
    if (result.error) {
      setError(result.error)
    } else {
      setTokens((prev) => [
        {
          jti: result.data.jti,
          token: result.data.token,
          scopes,
          passportId: selectedPassport,
          grantedAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setSelectedScopes({})
      setSuccessMsg(`Consent granted. Token JTI: ${result.data.jti}`)
    }
    setGranting(false)
  }

  const handleRevoke = async (jti) => {
    setRevokingJti(jti)
    setError(null)
    setSuccessMsg(null)

    const result = await vault.revokeConsent(jti)
    if (result.error) {
      setError(result.error)
    } else {
      setTokens((prev) => prev.filter((t) => t.jti !== jti))
      setSuccessMsg(`Token ${jti} has been revoked.`)
    }
    setRevokingJti(null)
  }

  const activeScopes = Object.entries(selectedScopes).filter(([, v]) => v)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Consent Management</h2>
      <p className="text-slate-500 mb-8">
        Control who can access your family's Cultural Memory Passport. Every grant and revocation is recorded in the audit log.
      </p>

      {loading && (
        <div className="flex items-center gap-3 text-slate-500 py-8 justify-center">
          <Spinner />
          <span>Loading...</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6">
          <p className="text-rose-700 text-sm">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
          <p className="text-emerald-700 text-sm">{successMsg}</p>
        </div>
      )}

      {!loading && passports.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-600 font-medium">No passports found</p>
          <p className="text-slate-400 text-sm mt-1">
            Ingest data first to create a passport.
          </p>
        </div>
      )}

      {!loading && passports.length > 0 && (
        <>
          {/* Passport selector */}
          {passports.length > 1 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Passport</label>
              <select
                value={selectedPassport || ''}
                onChange={(e) => setSelectedPassport(e.target.value)}
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

          {/* Scope Selection */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Grant New Access</h3>
            <div className="space-y-4">
              {SCOPE_DEFINITIONS.map(({ scope, label, description }) => (
                <label
                  key={scope}
                  className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedScopes[scope]
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="pt-0.5">
                    <ToggleSwitch
                      enabled={!!selectedScopes[scope]}
                      onChange={() => toggleScope(scope)}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                    <p className="text-xs font-mono text-slate-400 mt-1">{scope}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {activeScopes.length} scope{activeScopes.length !== 1 ? 's' : ''} selected
              </p>
              <button
                onClick={handleGrant}
                disabled={granting || activeScopes.length === 0}
                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {granting ? 'Granting...' : 'Grant Access'}
              </button>
            </div>
          </div>

          {/* Active Tokens */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Active Tokens
              {tokens.length > 0 && (
                <span className="text-sm font-normal text-slate-500 ml-2">({tokens.length})</span>
              )}
            </h3>

            {tokens.length === 0 ? (
              <p className="text-slate-400 text-sm">No active tokens. Grant access above to create one.</p>
            ) : (
              <div className="space-y-3">
                {tokens.map((t) => (
                  <div
                    key={t.jti}
                    className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-start justify-between"
                  >
                    <div>
                      <p className="text-sm font-mono text-slate-700 mb-1">JTI: {t.jti}</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {t.scopes.map((s) => (
                          <span
                            key={s}
                            className="inline-block px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600 font-mono"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">
                        Granted {new Date(t.grantedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(t.jti)}
                      disabled={revokingJti === t.jti}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      {revokingJti === t.jti ? 'Revoking...' : 'Revoke'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ToggleSwitch({ enabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
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
