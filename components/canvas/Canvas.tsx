// File: Jynkone/branc/branc-35acf07df2bc3fdbf1d7d97ee2c139d0fcf9291a/components/canvas/Canvas.tsx
"use client";

import {
  Editor,
} from "tldraw"; // Keep necessary tldraw imports if any are directly used here, otherwise move to SyncedTldrawCanvas
import { useMemo, useState, useRef, useEffect, useCallback } // Added useCallback
  from 'react';
import "tldraw/tldraw.css";

// Import Hooks
import { useBoardManager } from './hooks/useBoardManager';
import { usePageSelector } from './hooks/usePageSelector';
import { useShareDialog } from './hooks/useShareDialog';
import { useDynamicPositioning } from './hooks/useDynamicPositioning';

// Import Components
import { SyncedTldrawCanvas } from './SyncedTldrawCanvas'; // We will create this new component
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'; // Reverted to alias path
import { Button } from '@/components/ui/button'; // Reverted to alias path

// Ensure WORKER_URL has a valid protocol and is properly formatted
const getFormattedWorkerUrl = () => {
  const url = process.env.NEXT_PUBLIC_WORKER_URL || "branc.ajeenkya29.workers.dev";
  return url.startsWith("http") ? url : `https://${url}`;
};

const WORKER_URL = getFormattedWorkerUrl();

// Define getFormattedBoardId here as it's used to construct syncUri
const getFormattedBoardId = (boardId: string) => {
  if (!boardId) return '';
  return boardId.replace(/^(user-)+/, 'user-');
};

export function Canvas({ userId }: { userId: string }) {
  const boardManager = useBoardManager(userId);
  const { isLoading, currentRoom, availableRooms, selectBoard, createNewBoard, renameBoard, ensureBoardIsShareable } = boardManager;

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

  const [editor, setEditor] = useState<Editor | null>(null); // Keep editor state if CanvasUI needs it directly, or move to SyncedTldrawCanvas

  // Construct connection URI - memoize it based on currentRoom
  const syncUri = useMemo(() => {
    if (!currentRoom || !currentRoom.id) return ''; // Return empty if no currentRoom or id
    const formattedId = getFormattedBoardId(currentRoom.id);
    console.log(`[Canvas.tsx] Calculated syncUri: ${WORKER_URL}/connect/${formattedId} for room: ${currentRoom.id}`);
    return `${WORKER_URL}/connect/${formattedId}`;
  }, [currentRoom]);


  // Loading State
  if (isLoading) { // Simplified loading check, currentRoom check will happen before rendering SyncedTldrawCanvas
    return <div className="flex items-center justify-center h-screen">Loading Canvas...</div>;
  }

  // If there's no current room after loading, it might be an error or initial state.
  // This also handles the case where syncUri would be empty.
  if (!currentRoom || !syncUri) {
    // This state could occur if board fetching fails or no default board is established.
    // You might want a more specific error message or a button to create/select a board.
    return (
      <div className="flex items-center justify-center h-screen">
        <div>
          <p>No board selected or available. Please try again or create a new board.</p>
          {/* Optionally add a button to try creating a default board or selecting one */}
        </div>
      </div>
    );
  }

  // Render SyncedTldrawCanvas only when syncUri is valid and currentRoom is available
  return (
    <SyncedTldrawCanvas
      userId={userId}
      syncUri={syncUri} // Pass the validated syncUri
      initialCurrentRoom={currentRoom} // Pass currentRoom for initial setup if needed by SyncedTldrawCanvas or its children
      boardManager={boardManager}
      pageSelectorHook={pageSelectorHook}
      shareDialogHook={shareDialogHook}
      tldrawContainerRef={tldrawContainerRef}
      selectorPosition={selectorPosition}
      editorInstance={editor} // Pass editor instance
      onEditorMount={setEditor} // Pass setEditor
    />
  );
}