/**
 * Cloudflare Worker — Reverse proxy for KATHA.
 *
 * Routes:
 *   /katha/api/*    → Vault (Railway)
 *   /katha/engine/* → Wisdom Engine (Railway)
 *   /katha/*        → Dashboard SPA (Cloudflare Pages)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // Strip /katha prefix for routing
    if (!path.startsWith('/katha')) {
      return new Response('Not Found', { status: 404 })
    }

    const subPath = path.slice('/katha'.length) // e.g. "/api/health" or "/engine/triggers"

    let targetUrl
    let stripPrefix

    if (subPath.startsWith('/api')) {
      // Vault: /katha/api/* → VAULT_ORIGIN/*
      targetUrl = env.VAULT_ORIGIN + subPath.slice('/api'.length) + url.search
      stripPrefix = '/api'
    } else if (subPath.startsWith('/engine')) {
      // Engine: /katha/engine/* → ENGINE_ORIGIN/*
      targetUrl = env.ENGINE_ORIGIN + subPath.slice('/engine'.length) + url.search
      stripPrefix = '/engine'
    } else {
      // Dashboard SPA: /katha/* → PAGES_ORIGIN/*
      // For SPA routing, serve index.html for non-asset paths
      const assetExtensions = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json)$/
      if (subPath === '' || subPath === '/' || !assetExtensions.test(subPath)) {
        targetUrl = env.PAGES_ORIGIN + '/index.html'
      } else {
        targetUrl = env.PAGES_ORIGIN + subPath
      }
    }

    // Build upstream request
    const upstreamUrl = new URL(targetUrl)
    const upstreamHeaders = new Headers(request.headers)
    upstreamHeaders.set('Host', upstreamUrl.hostname)
    upstreamHeaders.set('X-Forwarded-Host', url.hostname)
    upstreamHeaders.set('X-Forwarded-Proto', 'https')
    // Remove CF-specific headers that shouldn't be forwarded
    upstreamHeaders.delete('cf-connecting-ip')
    upstreamHeaders.delete('cf-ray')

    const upstreamRequest = new Request(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'follow',
    })

    try {
      const response = await fetch(upstreamRequest)

      // Clone response to add CORS headers
      const responseHeaders = new Headers(response.headers)
      responseHeaders.set('Access-Control-Allow-Origin', '*')
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: responseHeaders,
        })
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: 'Upstream service unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
}
