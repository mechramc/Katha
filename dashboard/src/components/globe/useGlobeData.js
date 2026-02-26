/**
 * useGlobeData.js — Custom hook for fetching and transforming vault memories
 * into globe-ready data structures.
 *
 * Takes a passportId, fetches memories from the vault API, and computes
 * visual properties (color, size, opacity, pulse) for each memory dot.
 */

import { useState, useEffect, useCallback } from 'react';

const VAULT_BASE = '/api';

/**
 * Life theme to hex color mapping.
 * Each theme gets a distinct, vibrant color for the globe visualization.
 */
const THEME_COLORS = {
  'failure-recovery': '#E74C3C',
  'love-as-action': '#C0392B',
  'persistence': '#3498DB',
  'identity': '#9B59B6',
  'letting-go': '#1ABC9C',
  'unconditional-support': '#E67E22',
  'wonder': '#F1C40F',
  'endurance': '#2ECC71',
  'sacrifice': '#FF6B6B',
  'resilience': '#5DADE2',
  'faith': '#AF7AC5',
  'gratitude': '#F39C12',
};

const DEFAULT_COLOR = '#AAAAAA';

/**
 * Map emotionalWeight (6-10) to dot radius (0.03-0.12).
 * @param {number} weight - Emotional weight, 6-10 range.
 * @returns {number} Sphere radius for the memory dot.
 */
function weightToSize(weight) {
  const clamped = Math.max(6, Math.min(10, weight));
  const t = (clamped - 6) / 4;
  return 0.03 + t * 0.09;
}

/**
 * Transform a raw vault memory into a globe-ready object.
 * @param {Object} raw - Raw memory from vault API.
 * @returns {Object} Globe-ready memory with computed visual properties.
 */
function transformMemory(raw) {
  const memoryType = raw.memory_type || raw.memoryType || 'recorded';
  const lifeTheme = raw.lifeTheme || raw.life_theme || 'unknown';
  const emotionalWeight = raw.emotionalWeight || raw.emotional_weight || 6;
  const isRecorded = memoryType === 'recorded';

  return {
    memoryId: raw.memoryId || raw.memory_id || raw.id,
    text: raw.text || raw.wisdom_text || '',
    contributorName: raw.contributor || raw.contributorName || raw.contributor_name || 'Unknown',
    emotionalWeight,
    lifeTheme,
    situationalTags: raw.situationalTags || raw.situational_tags || [],
    memoryType,
    sourceRef: raw.sourceRef || raw.source_ref || '',
    approvedBy: raw.approvedBy || raw.approved_by || null,
    color: THEME_COLORS[lifeTheme] || DEFAULT_COLOR,
    size: weightToSize(emotionalWeight),
    pulseActive: isRecorded,
    opacity: isRecorded ? 1.0 : 0.6,
  };
}

/**
 * useGlobeData — Fetch and transform memories for the Living Memory Globe.
 *
 * @param {string} passportId - The passport ID to fetch memories for.
 * @returns {{ memories: Array, loading: boolean, error: string|null, refetch: Function }}
 */
export default function useGlobeData(passportId) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMemories = useCallback(async () => {
    if (!passportId) {
      setMemories([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${VAULT_BASE}/passport/${encodeURIComponent(passportId)}/memories`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Vault returned ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const payload = json.data || json;
      const rawMemories = Array.isArray(payload) ? payload : (payload.memories || []);
      const transformed = rawMemories.map(transformMemory);
      setMemories(transformed);
    } catch (err) {
      setError(err.message || 'Failed to fetch memories from vault');
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [passportId]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  return { memories, loading, error, refetch: fetchMemories };
}

export { THEME_COLORS, transformMemory };
