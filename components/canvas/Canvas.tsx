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


const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "https://branc.ajeenkya29.workers.dev";
// console.log("WORKER_URL in production:", WORKER_URL); // Keep console logs minimal if possible


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

  const store = useSync({
    uri: currentRoom && WORKER_URL ? `${WORKER_URL}/connect/${currentRoom.id}` : '',
    assets: multiplayerAssetStore,
    shapeUtils: customShapeUtils,
    // connectStatus is not a valid option here, useSync handles connection based on uri
  });

  // --- Loading State ---
  if (isLoading || !currentRoom) {
    // Show loading indicator while board manager is initializing or if no room is selected
    return <div className="flex items-center justify-center h-screen">Loading Canvas...</div>;
  }

  // --- Render ---
  // Render the CanvasUI component and pass down all necessary props
  return (
    <CanvasUI
      userId={userId}
      store={store}
      shapeUtils={customShapeUtils}
      tools={customTools}
      overrides={uiOverrides}
      components={components}
      assetUrls={customAssetUrls}
      editor={editor} // Pass the editor instance state
      onEditorMount={(editorInstance: Editor) => { // Wrap the setter to add logging
        console.log("Canvas.tsx: onEditorMount called, setting editor instance.");
        setEditor(editorInstance);
      }}
      tldrawContainerRef={tldrawContainerRef} // Pass the ref
      selectorPosition={selectorPosition} // Pass the calculated position
      boardManager={boardManager} // Pass the whole boardManager object
      pageSelectorHook={pageSelectorHook} // Pass the whole pageSelectorHook object
      shareDialogHook={shareDialogHook} // Pass the whole shareDialogHook object
    />
    // Removed the <style jsx global> block as it's now in CanvasUI.tsx
  );
}
