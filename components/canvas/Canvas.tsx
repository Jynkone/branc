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
  Editor,
} from "tldraw";
import { useSync } from '@tldraw/sync';
import { useMemo, useState, useRef, useEffect } from 'react';
import "tldraw/tldraw.css";
import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";
import { multiplayerAssetStore } from "@/lib/multiplayerAssetStore";

// Import Hooks
import { useBoardManager } from './hooks/useBoardManager';
import { usePageSelector } from './hooks/usePageSelector';
import { useShareDialog } from './hooks/useShareDialog';
import { useDynamicPositioning } from './hooks/useDynamicPositioning';

// Import Components
import { CanvasUI } from './CanvasUI';
import { Alert } from '@/components/ui/alert';
import { AlertTitle } from '@/components/ui/alert';
import { AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

// Ensure WORKER_URL has a valid protocol and is properly formatted
const getFormattedWorkerUrl = () => {
  const url = process.env.NEXT_PUBLIC_WORKER_URL || "branc.ajeenkya29.workers.dev";
  // Add https:// if no protocol is specified
  return url.startsWith("http") ? url : `https://${url}`;
};

const WORKER_URL = getFormattedWorkerUrl();
console.log("Using worker URL:", WORKER_URL);

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

  // State for editor instance and connection status
  const [editor, setEditor] = useState<Editor | null>(null);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const maxRetries = 3;

  // Format board ID to avoid duplicate prefixes that could cause URL issues
  const getFormattedBoardId = (boardId: string) => {
    if (!boardId) return '';
    // Make sure we don't have duplicated user- prefixes by removing any existing ones
    return boardId.replace(/^(user-)+/, 'user-');
  };

  // Construct connection URI
  const getSyncUri = () => {
    if (!currentRoom) return '';
    const formattedId = getFormattedBoardId(currentRoom.id);
    return `${WORKER_URL}/connect/${formattedId}`;
  };

  const syncUri = getSyncUri();
  console.log("Connecting to:", syncUri);

  // --- Tldraw Setup ---
  const customShapeUtils = useMemo(() => {
    return [ChatShapeUtil, ...defaultShapeUtils] as any;
  }, []);

  // Initialize sync without onError (since it's not in the type definition)
  const store = useSync({
    uri: syncUri,
    assets: multiplayerAssetStore,
    shapeUtils: customShapeUtils,
  });

  // Use effect to detect WebSocket connection issues via store status
  useEffect(() => {
    if (store.status === 'error' && connectionRetries < maxRetries) {
      console.error("Sync connection error detected");
      setConnectionFailed(true);
      
      const timer = setTimeout(() => {
        console.log(`Attempting reconnection (${connectionRetries + 1}/${maxRetries})...`);
        setConnectionFailed(false);
        setConnectionRetries(prev => prev + 1);
        // Force a re-render to attempt reconnection
        // We can't directly reconnect the store, but we can change the component state
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [store.status, connectionRetries, maxRetries]);

  // --- Loading State ---
  if (isLoading || !currentRoom) {
    return <div className="flex items-center justify-center h-screen">Loading Canvas...</div>;
  }

  // --- Connection Error UI ---
  if (connectionFailed && connectionRetries >= maxRetries) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-full max-w-md p-6">
          <Alert variant="destructive">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription className="mt-2">
              Unable to connect to the collaboration server. You can still use the app in offline mode,
              but your changes won't be synchronized with others.
            </AlertDescription>
            <div className="mt-4 flex justify-end space-x-2">
              <Button 
                variant="destructive"
                onClick={() => {
                  setConnectionFailed(false);
                  setConnectionRetries(0);
                }}
              >
                Try Again
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  // Force reload the page
                  window.location.reload();
                }}
              >
                Reload Page
              </Button>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  // --- Render ---
  return (
    <CanvasUI
      userId={userId}
      store={store}
      shapeUtils={customShapeUtils}
      tools={customTools}
      overrides={uiOverrides}
      components={components}
      assetUrls={customAssetUrls}
      editor={editor}
      onEditorMount={(editorInstance: Editor) => {
        console.log("Canvas.tsx: onEditorMount called, setting editor instance.");
        setEditor(editorInstance);
      }}
      tldrawContainerRef={tldrawContainerRef}
      selectorPosition={selectorPosition}
      boardManager={boardManager}
      pageSelectorHook={pageSelectorHook}
      shareDialogHook={shareDialogHook}
    />
  );
}