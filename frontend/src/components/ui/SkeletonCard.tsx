import "./skeleton-card.css";

type SkeletonCardProps = {
  "aria-label": string;
  lines?: number;
};

export function SkeletonCard({ "aria-label": ariaLabel, lines = 2 }: SkeletonCardProps) {
  return (
    <div className="skeleton-card" aria-label={ariaLabel} aria-live="polite">
      <div className="skeleton-card__icon" />
      <div className="skeleton-card__line skeleton-card__line--strong" />
      {Array.from({ length: lines }).map((_, index) => (
        <div className="skeleton-card__line" key={index} />
      ))}
    </div>
  );
}
