// components/canvas/SyncedTldrawCanvas.tsx
"use client";

import React, { useMemo, useState, useEffect, ReactNode } from 'react';
import { useSync } from '@tldraw/sync';
import "tldraw/tldraw.css"; // Keep tldraw.css import
import { multiplayerAssetStore } from "@/lib/multiplayerAssetStore";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";
import { defaultShapeUtils, Editor, TLStoreWithStatus } from "tldraw";

// Import UI for error display
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { RoomData } from './hooks/useBoardManager';


interface SyncedTldrawCanvasProps {
  syncUri: string;
  initialCurrentRoomName: string; // For error messages
  initialCurrentRoomId: string; // For error messages
  children: (store: TLStoreWithStatus, editor: Editor | null, onEditorMount: (editor: Editor) => void) => ReactNode;
  // Pass down onEditorMount and editor state from parent (Canvas.tsx)
  editorInstance: Editor | null;
  onEditorMount: (editor: Editor) => void;
}

export function SyncedTldrawCanvas({
  syncUri,
  initialCurrentRoomName,
  initialCurrentRoomId,
  children,
  editorInstance, // Receive editor instance from Canvas.tsx
  onEditorMount,  // Receive onEditorMount callback from Canvas.tsx
}: SyncedTldrawCanvasProps) {
  const customShapeUtils = useMemo(() => {
    return [ChatShapeUtil, ...defaultShapeUtils] as any;
  }, []);

  console.log(`[SyncedTldrawCanvas] Initializing useSync with URI: ${syncUri}`);
  const store = useSync({
    uri: syncUri,
    assets: multiplayerAssetStore,
    shapeUtils: customShapeUtils,
  });

  const [connectionFailedPermanently, setConnectionFailedPermanently] = useState(false);
  const [currentConnectionAttempt, setCurrentConnectionAttempt] = useState(0);
  const maxRetries = 3; // Retain retry logic

  // Effect for resetting connection state when syncUri changes
  useEffect(() => {
    console.log(`[SyncedTldrawCanvas] New syncUri detected: ${syncUri}. Resetting connection state.`);
    setConnectionFailedPermanently(false);
    setCurrentConnectionAttempt(0);
  }, [syncUri]);

  // Effect for handling store status and retries (from your existing SyncedTldrawCanvas)
  useEffect(() => {
    const successfullyConnectedStatus = 'synced-remote';
    const currentStatus = store.status;

    if (currentStatus === 'error') {
      if (currentConnectionAttempt < maxRetries) {
        if (connectionFailedPermanently) setConnectionFailedPermanently(false);
        console.error(`[SyncedTldrawCanvas] Sync connection error (Attempt ${currentConnectionAttempt + 1}/${maxRetries}) for URI: ${syncUri}. Will retry.`);
        const retryDelay = 3000 * (currentConnectionAttempt + 1);
        const timer = setTimeout(() => {
          setCurrentConnectionAttempt(prev => prev + 1);
          // Note: Forcing a re-sync might require more direct store manipulation if available,
          // or simply letting useSync try again when dependencies change or on next render cycle.
          // For now, changing state (currentConnectionAttempt) will cause a re-render.
        }, retryDelay);
        return () => clearTimeout(timer);
      } else if (!connectionFailedPermanently) {
        console.error(`[SyncedTldrawCanvas] Max retries (${maxRetries}) reached for URI: ${syncUri}. Marking as permanently failed.`);
        setConnectionFailedPermanently(true);
      }
    } else if (currentStatus === successfullyConnectedStatus) {
      if (currentConnectionAttempt > 0 || connectionFailedPermanently) {
        console.log(`[SyncedTldrawCanvas] Successfully connected to URI: ${syncUri} after ${currentConnectionAttempt} attempt(s).`);
      }
      setConnectionFailedPermanently(false); // Reset on successful connection
      setCurrentConnectionAttempt(0); // Reset retries
    } else {
      if (connectionFailedPermanently) {
        setConnectionFailedPermanently(false);
      }
    }
  }, [store.status, syncUri, currentConnectionAttempt, maxRetries, connectionFailedPermanently]);

  if (connectionFailedPermanently) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-full max-w-md p-6">
          <Alert variant="destructive">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription className="mt-2">
              Failed to connect to board: "{initialCurrentRoomName}" ({initialCurrentRoomId}) after {maxRetries} retries.
              You can try reloading or selecting a different board.
            </AlertDescription>
            <div className="mt-4 flex justify-end space-x-2">
              <Button
                variant="destructive"
                onClick={() => {
                  setConnectionFailedPermanently(false);
                  setCurrentConnectionAttempt(0);
                  // Potentially trigger a re-fetch or re-init in the parent if needed
                }}
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  // Call the children render prop, passing the store, editor instance, and onEditorMount
  return <>{children(store, editorInstance, onEditorMount)}</>;
}