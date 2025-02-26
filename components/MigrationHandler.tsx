// components/MigrationHandler.tsx
"use client";

import { useEffect, useState } from "react";
import { migrateUserDataToSupabase } from "@/lib/migrationUtils";
import { useAuth } from "@clerk/nextjs";

export function MigrationHandler() {
  const { userId, isLoaded } = useAuth();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  
  useEffect(() => {
    if (!isLoaded || !userId || typeof window === "undefined") return;
    
    // Check if migration is needed
    const isMigrated = localStorage.getItem(`branc-migration-complete-${userId}`);
    if (isMigrated === "true") {
      setMigrationComplete(true);
      return;
    }
    
    const runMigration = async () => {
      setIsMigrating(true);
      try {
        await migrateUserDataToSupabase(userId);
        localStorage.setItem(`branc-migration-complete-${userId}`, "true");
        setMigrationComplete(true);
      } catch (error) {
        console.error("Migration failed:", error);
      } finally {
        setIsMigrating(false);
      }
    };
    
    runMigration();
  }, [userId, isLoaded]);
  
  // This component doesn't render anything visible
  return null;
}