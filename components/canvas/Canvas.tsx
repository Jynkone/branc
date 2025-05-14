// File: Jynkone/branc/branc-35acf07df2bc3fdbf1d7d97ee2c139d0fcf9291a/components/canvas/Canvas.tsx
"use client";

import { Editor } from "tldraw";
import { useMemo, useState, useRef, useEffect, useCallback } from 'react'; // Added useCallback
import "tldraw/tldraw.css";

// Import Hooks
import { useBoardManager } from './hooks/useBoardManager';
import { usePageSelector } from './hooks/usePageSelector';
import { useShareDialog } from './hooks/useShareDialog';
import { useDynamicPositioning } from './hooks/useDynamicPositioning';

// Import Components
import { SyncedTldrawCanvas } from './SyncedTldrawCanvas';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const getFormattedWorkerUrl = () => {
  const url = process.env.NEXT_PUBLIC_WORKER_URL || "branc.ajeenkya29.workers.dev";
  return url.startsWith("http") ? url : `https://${url}`;
};

const WORKER_URL = getFormattedWorkerUrl();

const getFormattedBoardId = (boardId: string) => {
  if (!boardId) return '';
  return boardId.replace(/^(user-)+/, 'user-');
};

export function Canvas({ userId }: { userId: string }) {
  const boardManager = useBoardManager(userId);
  const { isLoading, currentRoom, availableRooms, selectBoard, createNewBoard, renameBoard, ensureBoardIsShareable, error: boardManagerError } = boardManager;

  const pageSelectorHook = usePageSelector({
    currentRoom,
    availableRooms,
    selectBoard,
    createNewBoard,
    renameBoard,
  });

  const shareDialogHook = useShareDialog({
    currentRoom,
    ensureBoardIsShareable,
  });

  const tldrawContainerRef = useRef<HTMLDivElement>(null);
  const { selectorPosition } = useDynamicPositioning(tldrawContainerRef);

  const [editor, setEditor] = useState<Editor | null>(null);

  const syncUri = useMemo(() => {
    if (!currentRoom || !currentRoom.id) return '';
    const formattedId = getFormattedBoardId(currentRoom.id);
    const generatedUri = `${WORKER_URL}/connect/${formattedId}`;
    console.log(`[Canvas.tsx] Calculated syncUri: ${generatedUri} for room: ${currentRoom.id}`);
    return generatedUri;
  }, [currentRoom]);

  useEffect(() => {
    // Log WORKER_URL once on component mount for easier debugging of environment variables
    console.log("[Canvas.tsx] Effective WORKER_URL:", WORKER_URL);
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading Canvas...</div>;
  }

  if (boardManagerError) {
     return (
      <div className="flex items-center justify-center h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error Loading Boards</AlertTitle>
          <AlertDescription>
            Could not load board data: {boardManagerError}
            <br />
            Please ensure your network connection is stable and try again.
          </AlertDescription>
           <Button onClick={() => window.location.reload()} className="mt-4">Reload Page</Button>
        </Alert>
      </div>
    );
  }

  if (!currentRoom || !syncUri) {
    console.error("[Canvas.tsx] Critical state: currentRoom or syncUri is invalid before rendering SyncedTldrawCanvas.", { currentRoom, syncUri, isLoading });
    return (
      <div className="flex items-center justify-center h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Initialization Error</AlertTitle>
          <AlertDescription>
            Could not initialize the board. There might be an issue with board selection or configuration.
          </AlertDescription>
          <Button onClick={() => window.location.reload()} className="mt-4">Reload Page</Button>
        </Alert>
      </div>
    );
  }
  
  console.log(`[Canvas.tsx] Rendering SyncedTldrawCanvas with userId: ${userId}, syncUri: ${syncUri}`);

  return (
    <SyncedTldrawCanvas
      // Use currentRoom.id as key to force re-mount of SyncedTldrawCanvas when room changes.
      // This ensures useSync gets the new URI from a fresh state.
      key={currentRoom.id}
      userId={userId}
      syncUri={syncUri}
      initialCurrentRoom={currentRoom}
      boardManager={boardManager}
      pageSelectorHook={pageSelectorHook}
      shareDialogHook={shareDialogHook}
      tldrawContainerRef={tldrawContainerRef}
      selectorPosition={selectorPosition}
      editorInstance={editor}
      onEditorMount={setEditor}
    />
  );
}