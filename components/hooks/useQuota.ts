// hooks/useQuota.ts
import { useEffect, useState, useCallback } from "react";

export type QuotaData = {
  count: number;
  limit: number;
};

export function useQuota() {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchQuota();
    const interval = setInterval(fetchQuota, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchQuota]);

  return { quota, isLoading, error, refetch: fetchQuota };
}
