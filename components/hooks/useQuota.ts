// hooks/useQuota.ts
import { useEffect, useState } from "react";

type QuotaData = {
  count: number;
  limit: number;
};

export function useQuota() {
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
    // Set up polling every 5 seconds
    const interval = setInterval(fetchQuota, 5000);
    return () => clearInterval(interval);
  }, []);

  return { quota, isLoading, error };
}
