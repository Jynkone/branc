"use client";

import {
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultToolbar,
  DefaultToolbarContent,
  TLComponents,
  TLUiOverrides,
  DefaultMainMenu,
  TLUiAssetUrlOverrides,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
  defaultShapeUtils,
  Editor, // Import Editor type
} from "tldraw";
import { useSync } from '@tldraw/sync';
import { useMemo, useState, useRef } from 'react';
import "tldraw/tldraw.css";
import { chatTool } from "@/tools/ChatTool"; // Reverted to alias path
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil"; // Reverted to alias path
import { multiplayerAssetStore } from "@/lib/multiplayerAssetStore"; // Reverted to alias path
// Removed
// Removed useRouter, useSearchParams, now handled by useBoardManager
// Removed Pencil, Check, Plus, now handled by PageSelector
// Removed

// Import Hooks (relative paths are correct here)
import { useBoardManager } from './hooks/useBoardManager';
import { usePageSelector } from './hooks/usePageSelector';
import { useShareDialog } from './hooks/useShareDialog';
import { useDynamicPositioning } from './hooks/useDynamicPositioning';

// Import Components (relative path is correct here)
import { CanvasUI } from './CanvasUI';
// Import RoomData type for props
import type { RoomData } from './hooks/useBoardManager';


const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "https://branc.ajeenkya29.workers.dev";
// console.log("WORKER_URL in production:", WORKER_URL); // Keep console logs minimal if possible

// Helper function to create the WebSocket URL
const getWebSocketUrl = (baseUrl: string | undefined, roomId: string | null): string | undefined => {
  if (!baseUrl || !roomId) {
    return undefined; // Return undefined if base URL or room ID is missing
  }
  try {
    // Construct the base URL object
    const url = new URL(baseUrl);
    // Determine protocol: wss for https, ws for http
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    // Construct the WebSocket URL
    return `${wsProtocol}//${url.host}/connect/${roomId}`;
  } catch (e) {
    console.error("Invalid WORKER_URL:", baseUrl, e);
    return undefined; // Return undefined if base URL is invalid
  }
};


const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.chat = {
      id: "chat",
      icon: "chat-icon",
      label: "Chat",
      kbd: "c",
      onSelect: () => editor.setCurrentTool("chat"),
    };
    return tools;
  },
};

const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const isChatSelected = useIsToolSelected(tools["chat"]);
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...tools["chat"]} isSelected={isChatSelected} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    );
  },
  KeyboardShortcutsDialog: (props) => {
    const tools = useTools();
    return (
      <DefaultKeyboardShortcutsDialog {...props}>
        <DefaultKeyboardShortcutsDialogContent />
        <TldrawUiMenuItem {...tools["chat"]} />
      </DefaultKeyboardShortcutsDialog>
    );
  },
  PageMenu: null,
  MainMenu: DefaultMainMenu,
  DebugPanel: null,
};

const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    "chat-icon": "/BranchBox.svg",
  },
};

const customTools = [chatTool];

// Removed RoomData interface and board helper functions (now in useBoardManager)

export function Canvas({ userId }: { userId: string }) {
  // --- Instantiate Hooks ---
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

  // State for editor instance (still needed for onMount)
  const [editor, setEditor] = useState<Editor | null>(null);

  // --- Tldraw Setup ---
  const customShapeUtils = useMemo(() => {
    return [ChatShapeUtil, ...defaultShapeUtils] as any;
  }, []);

  // --- Loading State ---
  // Render loading indicator *before* calling useSync if data isn't ready
  if (isLoading || !currentRoom) {
    return <div className="flex items-center justify-center h-screen">Loading Canvas...</div>;
  }

  // --- Render Synced Content ---
  // Only render the component that uses useSync once we have a valid currentRoom
  return (
    <SyncedCanvasContent
      userId={userId}
      currentRoom={currentRoom} // Pass the validated currentRoom
      customShapeUtils={customShapeUtils}
      // Pass down other necessary props/hooks
      boardManager={boardManager}
      pageSelectorHook={pageSelectorHook}
      shareDialogHook={shareDialogHook}
      tldrawContainerRef={tldrawContainerRef}
      selectorPosition={selectorPosition}
      editor={editor}
      setEditor={setEditor}
      // Pass down tldraw specific props
      tools={customTools}
      overrides={uiOverrides}
      components={components}
      assetUrls={customAssetUrls}
    />
  );
}

// Define the inner component that uses useSync
interface SyncedCanvasContentProps {
  userId: string;
  currentRoom: RoomData; // Non-null assertion here, as it's checked before rendering
  customShapeUtils: any[]; // Adjust type if needed
  boardManager: ReturnType<typeof useBoardManager>;
  pageSelectorHook: ReturnType<typeof usePageSelector>;
  shareDialogHook: ReturnType<typeof useShareDialog>;
  tldrawContainerRef: React.RefObject<HTMLDivElement>;
  selectorPosition: number; // Reverted back to number type
  editor: Editor | null;
  setEditor: React.Dispatch<React.SetStateAction<Editor | null>>;
  // Tldraw specific props
  tools: any[]; // Adjust type if needed
  overrides: TLUiOverrides;
  components: TLComponents;
  assetUrls: TLUiAssetUrlOverrides;
}

function SyncedCanvasContent({
  userId,
  currentRoom,
  customShapeUtils,
  boardManager,
  pageSelectorHook,
  shareDialogHook,
  tldrawContainerRef,
  selectorPosition,
  editor,
  setEditor,
  tools,
  overrides,
  components,
  assetUrls,
}: SyncedCanvasContentProps) {

  // useSync is now called only when currentRoom is guaranteed to be valid
  const webSocketUri = getWebSocketUrl(WORKER_URL, currentRoom.id);

  // Add this log:
  console.log('Attempting to connect WebSocket with URI:', webSocketUri);

  // Ensure we have a valid websocket URI before initializing useSync
  if (!webSocketUri) {
     // Handle the case where WORKER_URL might be invalid or missing, even if currentRoom exists
     console.error("Cannot initialize sync: Invalid WebSocket URI derived from WORKER_URL.");
     // Render an error state or return null, preventing useSync call with invalid URI
     return <div>Error: Cannot connect to sync service. Invalid configuration.</div>;
     // Or return null; depending on desired behavior
  }

  const store = useSync({
    uri: webSocketUri, // Pass the validated string URI directly
    assets: multiplayerAssetStore,
    shapeUtils: customShapeUtils,
  });

  // Render the actual UI, passing the store from useSync
  return (
    <CanvasUI
      userId={userId}
      store={store}
      shapeUtils={customShapeUtils}
      tools={tools}
      overrides={overrides}
      components={components}
      assetUrls={assetUrls}
      editor={editor}
      onEditorMount={(editorInstance: Editor) => {
        console.log("SyncedCanvasContent: onEditorMount called, setting editor instance.");
        setEditor(editorInstance);
      }}
      tldrawContainerRef={tldrawContainerRef}
      selectorPosition={selectorPosition} // Pass the number directly
      boardManager={boardManager}
      pageSelectorHook={pageSelectorHook}
      shareDialogHook={shareDialogHook}
    />
  );
}
