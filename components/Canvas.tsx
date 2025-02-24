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
} from "tldraw";
import "tldraw/tldraw.css";
import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "./ui/button";

// Import the QuotaCard
import { QuotaCard } from "@/components/QuotaCard";

// [1] UI overrides: add the custom chat tool using a string key for the icon.
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.chat = {
      id: "chat",
      icon: "chat-icon", // Use a string key for your asset
      label: "Chat",
      kbd: "c",
      onSelect: () => editor.setCurrentTool("chat"),
    };
    return tools;
  },
};

// [2] Components overrides: insert your chat tool’s menu item into the default Toolbar and KeyboardShortcutsDialog.
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
  // Let Tldraw render its default StylePanel
  PageMenu: null,
  MainMenu: null,
  DebugPanel: null,
};

// [3] Custom asset URLs: point the chat-icon key to /BranchBox.svg
const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    "chat-icon": "/BranchBox.svg",
  },
};

// [4] Register your custom tool.
const customTools = [chatTool];

export function Canvas() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {/* Render QuotaCard at the top center */}
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
        persistenceKey="tlweb1"
        shapeUtils={[ChatShapeUtil]}
        hideUi={false}
        tools={customTools}
        initialState="select"
        overrides={uiOverrides}
        components={components}
        assetUrls={customAssetUrls}
      >
      </Tldraw>

      {/* Sign-out button overlay */}
      <div
        className="absolute top-1 right-1 flex gap-1"
        style={{ zIndex: 2000 }}
      >
        <SignOutButton>
          <Button size="sm" variant="default">
            Sign Out
          </Button>
        </SignOutButton>
      </div>

      {/* Global style override to move the style panel down */}
      <style jsx global>{`
        .tldraw-style-panel,
        .tlui-style-panel {
          top: 35px !important;
        }
      `}</style>
    </div>
  );
}
