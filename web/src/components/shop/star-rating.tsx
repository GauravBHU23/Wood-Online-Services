// Ported from Views/Shared/_StarRating.cshtml — same markup/classes (.stars, .star-filled, etc.)
const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

export function StarRating({
  value,
  count = 0,
  showCount = true,
  showValue = true,
  size = "1rem",
}: {
  value: number;
  count?: number;
  showCount?: boolean;
  showValue?: boolean;
  size?: string;
}) {
  const rounded = Math.round(value * 2) / 2;
  const gradientSuffix = `${value.toFixed(1).replace(".", "")}`;

  return (
    <span className="rating-line">
      <span className="stars" style={{ fontSize: size }} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((i) => {
          if (rounded >= i) {
            return (
              <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
                <path className="star-filled" d={STAR_PATH} />
              </svg>
            );
          }
          if (rounded >= i - 0.5) {
            const gradientId = `half-${i}-${gradientSuffix}`;
            return (
              <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
                <defs>
                  <linearGradient id={gradientId}>
                    <stop offset="50%" stopColor="var(--gold)" />
                    <stop offset="50%" stopColor="var(--wood-200)" />
                  </linearGradient>
                </defs>
                <path fill={`url(#${gradientId})`} d={STAR_PATH} />
              </svg>
            );
          }
          return (
            <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
              <path className="star-empty" d={STAR_PATH} />
            </svg>
          );
        })}
      </span>

      {showValue && value > 0 && <span className="rating-value">{value.toFixed(1)}</span>}

      {showCount && (
        <span className="rating-count">{count > 0 ? `(${count} ${count === 1 ? "review" : "reviews"})` : "No reviews yet"}</span>
      )}
    </span>
  );
}
