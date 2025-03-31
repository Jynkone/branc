"use client";

import {
  Tldraw,
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
} from "tldraw";
import { useSync } from '@tldraw/sync';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import "tldraw/tldraw.css";
import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "./ui/button";
import { getBookmarkPreview } from "@/lib/getBookmarkPreview";
import { multiplayerAssetStore } from "@/lib/multiplayerAssetStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Input } from "./ui/input";
import { useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Check, Plus } from "lucide-react";
import { rebuildEntireLayout } from '@/lib/dagreLayoutManager';
import { LayoutGridIcon } from 'lucide-react';


const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "https://branc.ajeenkya29.workers.dev";
console.log("WORKER_URL in production:", WORKER_URL);


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

// Type for our room data
interface RoomData {
  id: string;
  name: string;
  isShared: boolean;
  owner: string;
  createdAt: number;
}

// Function to generate user's default board ID
// This is deterministic - will always create the same ID for the same user
const getDefaultBoardId = (userId: string) => {
  return `user-${userId}-default-board`;
};

// Generate a shareable board ID that can be accessed by anyone with the link
const generateShareableBoardId = () => {
  return `shared-board-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Create a new board
const createNewBoard = (userId: string, name: string) => {
  return {
    id: generateShareableBoardId(),
    name,
    isShared: true,
    owner: userId,
    createdAt: Date.now(),
  };
};

export function Canvas({ userId }: { userId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get the board ID from the URL if available
  const sharedBoardId = searchParams.get('board');
  
  // State for the current room and all available rooms
  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomData[]>([]);
  
  // State for UI elements
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  
  // State for dynamic positioning
  const [selectorPosition, setSelectorPosition] = useState(230); // Default fallback position
  
  // Refs for DOM elements
  const menuRef = useRef<HTMLDivElement>(null);
  const boardNameInputRef = useRef<HTMLInputElement>(null);
  const boardButtonRef = useRef<HTMLButtonElement>(null);
  const tldrawContainerRef = useRef<HTMLDivElement>(null);
  
  // Function to calculate and update the selector position
  const updateSelectorPosition = useCallback(() => {
    if (!tldrawContainerRef.current) return;
    
    // Look for the action menu (the top menu with undo/redo/etc)
    // This could be one of several selectors depending on tldraw's implementation
    const actionMenu = tldrawContainerRef.current.querySelector('.tlui-menu-zone, .tlui-action-panel, .tlui-actions, .tlui-actions-menu');
    
    if (actionMenu) {
      const menuRect = actionMenu.getBoundingClientRect();
      // Position is the right edge of the menu + 20px
      setSelectorPosition(menuRect.right + 5);
    }
  }, []);
  
  // Set up a resize observer to recalculate position when layout changes
  useEffect(() => {
    updateSelectorPosition();
    
    const resizeObserver = new ResizeObserver(() => {
      updateSelectorPosition();
    });
    
    // We need to check for changes to the DOM as well as window resizing
    const mutationObserver = new MutationObserver(() => {
      updateSelectorPosition();
    });
    
    // Add a slight delay to ensure tldraw is fully rendered
    const timeoutId = setTimeout(() => {
      updateSelectorPosition();
      if (tldrawContainerRef.current) {
        resizeObserver.observe(document.body);
        mutationObserver.observe(document.body, { 
          childList: true, 
          subtree: true 
        });
      }
    }, 500);
    
    // Listen for window resizing
    window.addEventListener('resize', updateSelectorPosition);
    
    // Clean up
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateSelectorPosition);
    };
  }, [updateSelectorPosition]);
  
  // Effect to initialize rooms
  useEffect(() => {
    if (!userId) return;
    
    // Handle initialization
    const initializeRooms = async () => {
      const storedBoardsStr = localStorage.getItem(`branc-known-boards-${userId}`);
      let storedBoards: RoomData[] = [];
      
      if (storedBoardsStr) {
        try {
          storedBoards = JSON.parse(storedBoardsStr);
        } catch (err) {
          console.error("Error parsing stored boards:", err);
        }
      }
      
      // Check if default board exists
      const defaultBoardId = getDefaultBoardId(userId);
      let defaultBoard = storedBoards.find(board => board.id === defaultBoardId);
      
      if (!defaultBoard) {
        // Create the default board if it doesn't exist
        defaultBoard = {
          id: defaultBoardId,
          name: "Page 1",
          isShared: false,
          owner: userId,
          createdAt: Date.now(),
        };
        
        storedBoards.push(defaultBoard);
        localStorage.setItem(`branc-known-boards-${userId}`, JSON.stringify(storedBoards));
      }
      
      // If we have a shared board ID in the URL, prioritize that
      if (sharedBoardId) {
        // Check if we already know about this board
        let sharedBoard = storedBoards.find(board => board.id === sharedBoardId);
        
        if (!sharedBoard) {
          // This is a new shared board to us
          sharedBoard = {
            id: sharedBoardId,
            name: `Page 1`,
            isShared: true,
            owner: 'unknown', // We don't know who the owner is
            createdAt: Date.now(),
          };
          
          storedBoards.push(sharedBoard);
          localStorage.setItem(`branc-known-boards-${userId}`, JSON.stringify(storedBoards));
        }
        
        setAvailableRooms(storedBoards);
        setCurrentRoom(sharedBoard);
        console.log("Setting shared board as current:", sharedBoard);
      } else {
        // No shared board ID in URL, use default
        setAvailableRooms(storedBoards);
        setCurrentRoom(defaultBoard);
        console.log("Setting default board as current:", defaultBoard);
      }
    };
    
    initializeRooms();
  }, [userId, sharedBoardId]);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        boardButtonRef.current && 
        !boardButtonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Focus input when editing
  useEffect(() => {
    if (isEditingBoardName && boardNameInputRef.current) {
      boardNameInputRef.current.focus();
      boardNameInputRef.current.select();
    }
  }, [isEditingBoardName]);
  
  // Handle board selection
  const selectBoard = (boardId: string) => {
    const selectedRoom = availableRooms.find(room => room.id === boardId);
    if (selectedRoom) {
      setCurrentRoom(selectedRoom);
      // Update the URL to reflect the current board
      if (selectedRoom.isShared) {
        router.push(`/?board=${selectedRoom.id}`);
      } else {
        router.push('/');
      }
      setIsMenuOpen(false);
    }
  };
  
  // Handle creating a new board
  const createNewBoardHandler = () => {
    if (!userId) return;
    
    const boardNumber = availableRooms.length + 1;
    const newBoard = createNewBoard(userId, `Page ${boardNumber}`);
    
    const updatedRooms = [...availableRooms, newBoard];
    localStorage.setItem(`branc-known-boards-${userId}`, JSON.stringify(updatedRooms));
    
    setAvailableRooms(updatedRooms);
    setCurrentRoom(newBoard);
    
    // Update URL for the new shared board
    router.push(`/?board=${newBoard.id}`);
  };
  
  // Start editing board name
  const startEditingBoardName = () => {
    if (!currentRoom) return;
    setNewBoardName(currentRoom.name);
    setIsEditingBoardName(true);
    setIsMenuOpen(false);
  };
  
  // Save board name
  const saveBoardName = () => {
    if (!currentRoom || !newBoardName.trim()) {
      setIsEditingBoardName(false);
      return;
    }
    
    const updatedRoom = { ...currentRoom, name: newBoardName.trim() };
    const updatedRooms = availableRooms.map(room => 
      room.id === currentRoom.id ? updatedRoom : room
    );
    
    localStorage.setItem(`branc-known-boards-${userId}`, JSON.stringify(updatedRooms));
    setAvailableRooms(updatedRooms);
    setCurrentRoom(updatedRoom);
    setIsEditingBoardName(false);
  };
  
  // Function to generate and show share link
  const handleShareBoard = () => {
    if (!currentRoom) return;
    
    // Always ensure the board is marked as shared
    if (!currentRoom.isShared) {
      const updatedRoom = { ...currentRoom, isShared: true };
      const updatedRooms = availableRooms.map(room => 
        room.id === currentRoom.id ? updatedRoom : room
      );
      
      localStorage.setItem(`branc-known-boards-${userId}`, JSON.stringify(updatedRooms));
      setAvailableRooms(updatedRooms);
      setCurrentRoom(updatedRoom);
    }
    
    // Generate a shareable link for the current board
    const link = `${window.location.origin}/?board=${currentRoom.id}`;
    setShareLink(link);
    setLinkCopied(false);
    setIsShareDialogOpen(true);
  };
  
  // Function to copy the share link to clipboard
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
  
  // Set up the sync store with our custom shape
  const customShapeUtils = useMemo(() => {
    // Explicitly type as TLAnyShapeUtilConstructor[]
    return [ChatShapeUtil, ...defaultShapeUtils] as any;
  }, []);
    
  // Create a store connected to multiplayer only if we have a current room
  const store = useSync({
    // Don't try to modify the protocol - TLDraw handles this internally
    uri: currentRoom && WORKER_URL ? 
      `${WORKER_URL}/connect/${currentRoom.id}` : 
      '',
    assets: multiplayerAssetStore,
    shapeUtils: customShapeUtils,
  });
    
  // Only render the full UI if we have a current room
  if (!currentRoom) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Render the "tldraw-style" page selector
  const renderPageSelector = () => {
    if (isEditingBoardName) {
      return (
        <div className="tldraw-page-selector">
          <input
            ref={boardNameInputRef}
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            onBlur={saveBoardName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveBoardName();
              if (e.key === 'Escape') setIsEditingBoardName(false);
            }}
            className="tldraw-page-name-input"
          />
        </div>
      );
    }
    
    

    return (
      <div className="tldraw-page-selector">
        <button
          ref={boardButtonRef}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="tldraw-page-button"
        >
          {currentRoom.name}
        </button>
        
        

        {isMenuOpen && (
          <div ref={menuRef} className="tldraw-pages-menu">
            <div className="tldraw-pages-menu-header">
              <span>Pages</span>
              <div className="tldraw-pages-menu-actions">
                <button onClick={startEditingBoardName} className="tldraw-icon-button">
                  <Pencil size={14} />
                </button>
                <button onClick={createNewBoardHandler} className="tldraw-icon-button">
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="tldraw-pages-menu-list">
              {availableRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => selectBoard(room.id)}
                  className={`tldraw-page-list-item ${currentRoom.id === room.id ? 'selected' : ''}`}
                >
                  {currentRoom.id === room.id && (
                    <span className="tldraw-check-icon"><Check size={14} /></span>
                  )}
                  <span className="tldraw-page-list-item-handle">

                  </span>
                  {room.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={tldrawContainerRef} style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        store={store}
        shapeUtils={[ChatShapeUtil] as any}
        hideUi={false}
        tools={customTools}
        initialState="select"
        overrides={uiOverrides}
        components={components}
        assetUrls={customAssetUrls}
        onMount={(editor) => {
          // Register bookmark handler
          editor.registerExternalAssetHandler('url', getBookmarkPreview);
          
          // Additional event for when tldraw finishes mounting UI elements
          editor.addListener('mount', () => {
            // Delayed update to ensure UI is fully rendered
            setTimeout(updateSelectorPosition, 100);
          });
          
          // Log store information for debugging
          console.log("TLDraw store initialized with room:", currentRoom);
        }}
      />

      {/* Page Selector with dynamic positioning */}
      <div 
        className="tldraw-page-selector-container"
        style={{ 
          position: "absolute", 
          left: `${selectorPosition}px`, 
          top: "0px", 
          zIndex: 3000 
        }}
      >
        {renderPageSelector()}
      </div>

      <div className="absolute top-1 right-1 flex gap-1" style={{ zIndex: 2000 }}>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleShareBoard}
          className="match-height"
        >
          Share
        </Button>
        <SignOutButton>
          <Button size="sm" variant="default">
            Sign Out
          </Button>
        </SignOutButton>
      </div>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this board</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Anyone with this link can view and edit this board:
            </p>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Input
                value={shareLink}
                readOnly
                className="col-span-3"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button 
                onClick={copyShareLink}
                variant={linkCopied ? "outline" : "default"}
              >
                {linkCopied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        /* TLDraw Style Page Selector */
        .tldraw-page-selector-container {
          font-size: 14px;
        }
        
        .tldraw-page-selector {
          position: relative;
          display: inline-block;
        }
        
        .tldraw-page-button {
          display: inline-block;
          background: transparent;
          border: none;
          padding: 5px 8px;
          font-size: 14px;
          cursor: pointer;
          color: #333;
          font-weight: 500;
          height: 40px; 
        }
        
        .tldraw-page-button:hover {
          background: rgba(144, 144, 144, 0.1);
          border-radius: 4px;
        }
        
        .tldraw-pages-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          background: white;
          border-radius: 10px;
          box-shadow: 15 16px 12px EDF0F2;
          width: 230px;
          z-index: 1000;
          overflow: hidden;
        }
        
        .tldraw-pages-menu-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solidrgb(220, 220, 220);
        }
        
        .tldraw-pages-menu-actions {
          display: flex;
          gap: 10px;
        }
        
        .tldraw-icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          border-radius: 4px;
          width: 24px;
          height: 24px;
          cursor: pointer;
        }
        
        .tldraw-icon-button:hover {
          background:rgb(234, 234, 234);
        }
        
        .tldraw-pages-menu-list {
          max-height: 350px;
          overflow-y: auto;
        }
        
        .tldraw-page-list-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 8px 12px;
          text-align: left;
          background: none;
          border: none;
          cursor: pointer;
          position: relative;
        }
        
        .tldraw-page-list-item:hover {
          background:rgb(234, 234, 234);
        }
        
        
        .tldraw-check-icon {
          margin-right: 4px;
          display: flex;
          align-items: center;
        }
        
        .tldraw-page-list-item-handle {
          margin-right: 8px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          opacity: 0.6;
        }
        
        .tldraw-page-name-input {
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 4px;
          padding: 5px 10px;
          font-size: 14px;
          outline: none;
          width: 180px;
        }
        
        .match-height {
         height: 33px !important; /* or 40px, whichever you need */
         * You can also tweak line-height or padding if needed */
        }


        .tldraw-style-panel,
        .tlui-style-panel {
          top: 45px !important;
        }
      `}</style>
    </div>
  );
}