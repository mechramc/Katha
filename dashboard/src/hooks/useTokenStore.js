/**
 * useTokenStore.js — Persist consent tokens in localStorage.
 *
 * On consent grant, store { passportId, token, jti, scopes, grantedAt }.
 * On wisdom request, retrieve the latest valid token for a passport.
 * No direct fetch() — this is pure client-side state.
 */

import { useState, useCallback } from 'react'

const STORAGE_KEY = 'katha_consent_tokens'

function readTokens() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function writeTokens(tokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

export function useTokenStore() {
  const [tokens, setTokens] = useState(readTokens)

  const storeToken = useCallback((passportId, token, jti, scopes) => {
    const entry = { passportId, token, jti, scopes, grantedAt: new Date().toISOString() }
    const updated = [entry, ...readTokens().filter((t) => t.jti !== jti)]
    writeTokens(updated)
    setTokens(updated)
    return entry
  }, [])

  const getTokenForPassport = useCallback((passportId) => {
    const all = readTokens()
    return all.find((t) => t.passportId === passportId) || null
  }, [])

  const removeToken = useCallback((jti) => {
    const updated = readTokens().filter((t) => t.jti !== jti)
    writeTokens(updated)
    setTokens(updated)
  }, [])

  return { tokens, storeToken, getTokenForPassport, removeToken }
}
