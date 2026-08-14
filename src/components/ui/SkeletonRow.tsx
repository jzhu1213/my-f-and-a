"use client"

/**
 * Skeleton placeholder row that matches transaction row dimensions.
 * Shows animated shimmer bars while real content is loading during fast scroll.
 * Uses the existing `.skeleton` class from globals.css for the shimmer animation.
 */
export function SkeletonRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 16px 14px 36px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        position: 'relative',
      }}
      aria-hidden="true"
    >
      {/* Timeline dot placeholder */}
      <span
        style={{
          position: 'absolute',
          left: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'rgba(129, 140, 248, 0.15)',
        }}
      />
      {/* Left: text placeholders */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="skeleton"
          style={{
            width: '60%',
            height: 14,
            borderRadius: 6,
            marginBottom: 6,
          }}
        />
        <div
          className="skeleton"
          style={{
            width: '35%',
            height: 10,
            borderRadius: 4,
          }}
        />
      </div>
      {/* Right: amount placeholder */}
      <div
        className="skeleton"
        style={{
          width: 56,
          height: 14,
          borderRadius: 6,
          flexShrink: 0,
        }}
      />
    </div>
  )
}

/**
 * A group of skeleton rows to fill visible space during fast scrolling.
 */
export function SkeletonGroup({ count = 5 }: { count?: number }) {
  return (
    <div aria-label="Loading transactions" role="status">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}
