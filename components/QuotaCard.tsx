// QuotaCard.tsx
import React, { useEffect, useState } from "react";
import { getUserPromptCount } from "@/lib/quotaService";
import { useAuth } from "@clerk/nextjs";

export type QuotaData = {
  count: number;
  limit: number;
};

export function QuotaCard() {
  const { userId, isLoaded } = useAuth();
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch quota from API
  const fetchQuota = async () => {
    if (!userId) return;
    
    setIsLoading(true);
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
  };

  useEffect(() => {
    if (isLoaded && userId) {
      fetchQuota();
      const interval = setInterval(fetchQuota, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [userId, isLoaded]);

  // If there's an error and no quota data, show error.
  if (error && !quota) {
    return <div style={{ color: "red" }}>{error}</div>;
  }
  
  // If no quota data at all, show loading (only on initial load)
  if (!quota) {
    return <div>Loading quota...</div>;
  }

  // Once quota is available, always display it regardless of isLoading.
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