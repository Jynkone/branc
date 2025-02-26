// components/MigrationHandler.tsx
"use client";

import { useEffect, useState } from "react";
import { migrateUserDataToSupabase } from "@/lib/migrationUtils";
import { useAuth } from "@clerk/nextjs";

// Update components/MigrationHandler.tsx

export function MigrationHandler() {
    const { userId, isLoaded } = useAuth();
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationComplete, setMigrationComplete] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    
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
          console.log(`Starting migration for user ${userId}, attempt ${retryCount + 1}`);
          await migrateUserDataToSupabase(userId);
          
          // Verify migration success by checking user_prompts table
          const res = await fetch("/api/quota");
          const quotaData = await res.json();
          
          if (!quotaData.error) {
            // Mark as complete if we successfully fetched quota
            setMigrationComplete(true);
            console.log("Migration verified successful");
          } else if (retryCount < 3) {
            // Retry migration up to 3 times
            console.warn("Migration verification failed, will retry");
            setRetryCount(prev => prev + 1);
          } else {
            console.error("Migration failed after multiple attempts");
          }
        } catch (error) {
          console.error("Migration failed:", error);
          if (retryCount < 3) {
            setRetryCount(prev => prev + 1);
          }
        } finally {
          setIsMigrating(false);
        }
      };
      
      runMigration();
    }, [userId, isLoaded, retryCount]);
    
    // This component doesn't render anything visible
    return null;
  }