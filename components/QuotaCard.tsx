// QuotaCard.tsx
import React, { useEffect, useState } from "react";

/**
 * Represents the quota usage data from /api/quota
 */
type QuotaData = {
  count: number;
  limit: number;
};

/**
 * A single component that:
 * 1) Fetches the user's quota from /api/quota
 * 2) Displays a card-like progress bar with the usage label (e.g., "2/750").
 */
export function QuotaCard() {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuota() {
      try {
        const res = await fetch("/api/quota");
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setQuota({ count: data.count, limit: data.limit });
        }
      } catch (err) {
        setError("Failed to fetch quota");
      } finally {
        setIsLoading(false);
      }
    }

    // Initial fetch
    fetchQuota();

    // Optional: poll every 5 seconds to keep the bar in sync
    const interval = setInterval(fetchQuota, 5000);
    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (isLoading) {
    return <div>Loading quota...</div>;
  }

  // Error state
  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }

  // If no quota data was returned
  if (!quota) {
    return <div>No quota data available.</div>;
  }

  // Calculate percentage fill for the progress bar
  const { count, limit } = quota;
  const percentage = Math.min((count / limit) * 100, 100);

  // Render a simple card with a progress bar and usage text
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#fff",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        padding: "8px 16px",
        minWidth: "200px",
      }}
    >
      {/* Progress Track */}
      <div
        style={{
          position: "relative",
          flex: 1,
          height: "8px",
          background: "#e5e7eb",
          borderRadius: "4px",
          marginRight: "8px",
          overflow: "hidden",
        }}
      >
        {/* Progress Fill */}
        <div
          style={{
            width: `${percentage}%`,
            background: "#6366f1",
            height: "100%",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Used / Limit text */}
      <span style={{ fontSize: "0.875rem", color: "#374151" }}>
        {count}/{limit}
      </span>
    </div>
  );
}
