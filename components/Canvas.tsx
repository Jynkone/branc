"use client";

import {
  Tldraw,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultToolbar,
  DefaultToolbarContent,
  TLComponents,
  TLUiOverrides,
  TLUiAssetUrlOverrides,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
  defaultShapeUtils,
} from "tldraw";
import { useSync } from '@tldraw/sync';
import { useMemo } from 'react';
import "tldraw/tldraw.css";
import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "./ui/button";
import { getBookmarkPreview } from "@/lib/getBookmarkPreview";
import { multiplayerAssetStore } from "@/lib/multiplayerAssetStore";

// Import the unified QuotaCard component
import { QuotaCard } from "@/components/QuotaCard";

// Replace this with your actual worker URL
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:5172";

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
  MainMenu: null,
  DebugPanel: null,
};

const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    "chat-icon": "/BranchBox.svg",
  },
};

const customTools = [chatTool];

export function Canvas() {
  // We'll create a unique room ID based on the current user
  // For a proper implementation, you might want to use a room ID from URL or elsewhere
  const roomId = "branc-room-1"; // You can change this or make it dynamic
  
  // Set up the sync store with our custom shape
  const customShapeUtils = useMemo(() => [ChatShapeUtil, ...defaultShapeUtils], []);
  
  // Create a store connected to multiplayer
  const store = useSync({
    uri: `${WORKER_URL}/connect/${roomId}`,
    assets: multiplayerAssetStore,
    shapeUtils: customShapeUtils,
  });

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {/* QuotaCard at the Top Center */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 3000,
        }}
      >
        <QuotaCard />
      </div>

      <Tldraw
        store={store}
        shapeUtils={[ChatShapeUtil]}
        hideUi={false}
        tools={customTools}
        initialState="select"
        overrides={uiOverrides}
        components={components}
        assetUrls={customAssetUrls}
        onMount={(editor) => {
          // Register bookmark handler
          editor.registerExternalAssetHandler('url', getBookmarkPreview);
        }}
      />

      <div className="absolute top-1 right-1 flex gap-1" style={{ zIndex: 2000 }}>
        <SignOutButton>
          <Button size="sm" variant="default">
            Sign Out
          </Button>
        </SignOutButton>
      </div>

      <style jsx global>{`
        .tldraw-style-panel,
        .tlui-style-panel {
          top: 35px !important;
        }
      `}</style>
    </div>
  );
}