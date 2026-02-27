/**
 * useVault.js — Single hook for ALL vault API calls.
 *
 * All vault communication goes through this hook.
 * No direct fetch() in components — ever.
 */

import { useState, useCallback } from 'react'

const VAULT_BASE = '/api'
const ENGINE_BASE = 'http://localhost:3002'

/**
 * Generic request helper.
 * Returns { data, error } — never throws.
 */
async function request(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    })
    const json = await res.json()
    if (!res.ok || json.success === false) {
      return { data: null, error: json.error || `HTTP ${res.status}` }
    }
    return { data: json.data, error: null }
  } catch (err) {
    return { data: null, error: err.message || 'Network error' }
  }
}

/**
 * Hook that wraps an async vault call with loading/error state.
 */
function useAsyncAction(fn) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const execute = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    const result = await fn(...args)
    setData(result.data)
    setError(result.error)
    setLoading(false)
    return result
  }, [fn])

  return { data, error, loading, execute }
}

/**
 * useVault — Exposes every vault + engine operation.
 *
 * Usage:
 *   const vault = useVault()
 *   const { data, error } = await vault.getPassports()
 */
export function useVault() {
  // --- Passports ---

  const getPassports = useCallback(async (page = 1, limit = 20) => {
    return request(`${VAULT_BASE}/passports?page=${page}&limit=${limit}`)
  }, [])

  const getPassport = useCallback(async (passportId, token) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    return request(`${VAULT_BASE}/passport/${passportId}`, { headers })
  }, [])

  // --- Memories ---

  const getMemories = useCallback(async (passportId, page = 1, limit = 50) => {
    return request(`${VAULT_BASE}/passport/${passportId}/memories?page=${page}&limit=${limit}`)
  }, [])

  const getMemory = useCallback(async (memoryId) => {
    return request(`${VAULT_BASE}/memories/${memoryId}`)
  }, [])

  const approveMemory = useCallback(async (memoryId, approvedBy) => {
    return request(`${VAULT_BASE}/memories/${memoryId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ approvedBy }),
    })
  }, [])

  // --- Consent ---

  const grantConsent = useCallback(async (passportId, scopes) => {
    return request(`${VAULT_BASE}/consent/grant`, {
      method: 'POST',
      body: JSON.stringify({ passportId, scopes, actor: 'parent' }),
    })
  }, [])

  const revokeConsent = useCallback(async (jti) => {
    return request(`${VAULT_BASE}/consent/revoke`, {
      method: 'POST',
      body: JSON.stringify({ jti, actor: 'parent' }),
    })
  }, [])

  const checkConsentStatus = useCallback(async (token) => {
    return request(`${VAULT_BASE}/consent/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }, [])

  // --- Audit ---

  const getAuditLog = useCallback(async (page = 1, limit = 20) => {
    return request(`${VAULT_BASE}/audit?page=${page}&limit=${limit}`)
  }, [])

  const getAuditLogForPassport = useCallback(async (passportId, page = 1, limit = 50) => {
    return request(`${VAULT_BASE}/audit/${passportId}?page=${page}&limit=${limit}`)
  }, [])

  // --- Export ---

  const exportPassport = useCallback(async (passportId) => {
    return request(`${VAULT_BASE}/passport/export`, {
      method: 'POST',
      body: JSON.stringify({ passportId, actor: 'parent' }),
    })
  }, [])

  // --- Engine (Wisdom Delivery) ---

  const triggerWisdom = useCallback(async (passportId, trigger, token) => {
    return request(`${ENGINE_BASE}/trigger`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ passportId, trigger }),
    })
  }, [])

  const getTriggers = useCallback(async () => {
    return request(`${ENGINE_BASE}/triggers`)
  }, [])

  // --- Delete Passport ---

  const deletePassport = useCallback(async (passportId) => {
    return request(`${VAULT_BASE}/passport/${passportId}`, {
      method: 'DELETE',
    })
  }, [])

  // --- Upload / Ingest ---

  const uploadPersona = useCallback(async (fileList) => {
    const formData = new FormData()
    for (const file of fileList) {
      formData.append('files', file)
    }
    try {
      const res = await fetch(`${ENGINE_BASE}/ingest`, {
        method: 'POST',
        body: formData,
        // No Content-Type header — browser sets multipart boundary automatically
      })
      const json = await res.json()
      if (!res.ok || json.success === false) {
        return { data: null, error: json.error || `HTTP ${res.status}` }
      }
      return { data: json.data, error: null }
    } catch (err) {
      return { data: null, error: err.message || 'Network error' }
    }
  }, [])

  const startIngest = useCallback(async (personaPath) => {
    return request(`${VAULT_BASE}/passports`)
  }, [])

  return {
    getPassports,
    getPassport,
    getMemories,
    getMemory,
    approveMemory,
    grantConsent,
    revokeConsent,
    checkConsentStatus,
    getAuditLog,
    getAuditLogForPassport,
    exportPassport,
    triggerWisdom,
    getTriggers,
    startIngest,
    deletePassport,
    uploadPersona,
  }
}

/**
 * useVaultAction — convenience wrapper for single vault calls with loading state.
 *
 * Usage:
 *   const { data, error, loading, execute } = useVaultAction(vault.getPassports)
 */
export function useVaultAction(fn) {
  return useAsyncAction(fn)
}

export default useVault
