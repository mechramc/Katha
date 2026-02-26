/**
 * MemoryCard.jsx — Floating card overlay for hovered/selected memory dots.
 *
 * Displays contributor name, wisdom text, emotional weight, life theme,
 * memory type badge, source reference, and situational tags.
 * Positioned near the cursor with a semi-transparent backdrop blur.
 */

import React from 'react';

/**
 * Render emotional weight as a row of filled/empty dots.
 * @param {number} weight - Emotional weight 1-10.
 * @returns {JSX.Element}
 */
function EmotionalWeightDots({ weight }) {
  const maxDots = 10;
  const filled = Math.max(0, Math.min(maxDots, Math.round(weight)));
  return (
    <div className="flex items-center gap-0.5" aria-label={`Emotional weight: ${weight} out of 10`}>
      {Array.from({ length: maxDots }, (_, i) => (
        <span
          key={i}
          className={`inline-block w-2 h-2 rounded-full ${
            i < filled
              ? 'bg-amber-400'
              : 'bg-gray-600'
          }`}
        />
      ))}
      <span className="ml-1.5 text-xs text-gray-400">{weight}/10</span>
    </div>
  );
}

/**
 * Memory type badge — visually distinguishes recorded vs reconstructed.
 * @param {string} memoryType - "recorded" or "reconstructed"
 */
function MemoryTypeBadge({ memoryType }) {
  const isRecorded = memoryType === 'recorded';
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
        isRecorded
          ? 'bg-blue-900/60 text-blue-300 border border-blue-500/40'
          : 'bg-orange-900/40 text-orange-300 border border-dashed border-orange-500/50'
      }`}
    >
      {isRecorded ? 'Recorded' : 'Reconstructed \u2014 family testimony'}
    </span>
  );
}

/**
 * Life theme badge with colored indicator.
 * @param {string} theme - Life theme string.
 * @param {string} color - Hex color for the theme.
 */
function ThemeBadge({ theme, color }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-white/5 text-gray-300">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {theme}
    </span>
  );
}

/**
 * MemoryCard — Floating overlay card for a hovered or selected memory dot.
 *
 * @param {Object} props
 * @param {Object} props.memory - Globe-ready memory object.
 * @param {{ x: number, y: number }} props.position - Screen position for the card.
 * @param {boolean} props.visible - Whether the card is visible.
 * @param {boolean} props.pinned - Whether the card is pinned (clicked).
 */
export default function MemoryCard({ memory, position, visible, pinned }) {
  if (!memory || !visible) return null;

  const cardStyle = {
    position: 'absolute',
    left: `${position.x + 16}px`,
    top: `${position.y - 12}px`,
    zIndex: 100,
    maxWidth: '360px',
    minWidth: '280px',
    pointerEvents: pinned ? 'auto' : 'none',
  };

  return (
    <div
      style={cardStyle}
      className={`
        rounded-xl border border-white/10
        bg-gray-900/80 backdrop-blur-xl
        shadow-2xl shadow-black/40
        p-4 text-white
        transition-opacity duration-200
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      {/* Header: contributor + type badge */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-gray-100 leading-tight">
          {memory.contributorName}
        </h3>
        <MemoryTypeBadge memoryType={memory.memoryType} />
      </div>

      {/* Wisdom text */}
      <p className="text-sm text-gray-300 leading-relaxed mb-3 line-clamp-4">
        &ldquo;{memory.text}&rdquo;
      </p>

      {/* Source reference */}
      {memory.sourceRef && (
        <p className="text-xs text-gray-500 mb-2 italic truncate">
          Source: {memory.sourceRef}
        </p>
      )}

      {/* Emotional weight */}
      <div className="mb-2">
        <EmotionalWeightDots weight={memory.emotionalWeight} />
      </div>

      {/* Theme badge */}
      <div className="mb-2">
        <ThemeBadge theme={memory.lifeTheme} color={memory.color} />
      </div>

      {/* Situational tags */}
      {memory.situationalTags && memory.situationalTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {memory.situationalTags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-gray-400 border border-white/5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Pinned indicator */}
      {pinned && (
        <p className="mt-2 text-[10px] text-gray-500 text-center">
          Click elsewhere to dismiss
        </p>
      )}
    </div>
  );
}
