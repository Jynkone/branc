// QuotaCard.tsx
import React from "react";
import { useQuota } from "./hooks/useQuota";

export function QuotaCard() {
  const { quota, isLoading, error } = useQuota();

  if (isLoading) return <div>Loading quota...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!quota) return <div>No quota data available.</div>;

  const { count, limit } = quota;
  const percentage = Math.min((count / limit) * 100, 100);

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
      <div
        style={{
          position: "relative",
          flex: 1,
          height: "16px",
          background: "#e5e7eb",
          borderRadius: "4px",
          marginRight: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            background: "#6366f1",
            height: "100%",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "0.875rem", color: "#374151" }}>
        {count}/{limit}
      </span>
    </div>
  );
}
