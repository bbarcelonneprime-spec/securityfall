/**
 * Antigravity-style animated background.
 * Floating aurora orbs + a slowly rotating conic glow + a subtle drifting grid,
 * all on a dark base. Purely decorative (pointer-events: none).
 */
export default function AuroraBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`ag-bg ${className}`} aria-hidden="true">
      <div className="ag-conic" />
      <div className="ag-orb ag-orb-1" />
      <div className="ag-orb ag-orb-2" />
      <div className="ag-orb ag-orb-3" />
      <div className="ag-grid" />
    </div>
  );
}
