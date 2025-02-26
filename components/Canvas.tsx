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
import { useMemo, useState, useEffect, useRef } from 'react';
import "tldraw/tldraw.css";
import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "./ui/button";
import { getBookmarkPreview } from "@/lib/getBookmarkPreview";
import { multiplayerAssetStore } from "@/lib/multiplayerAssetStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useRouter, useSearchParams } from 'next/navigation';
import { Pencil } from "lucide-react";

// Import the unified QuotaCard component
import { QuotaCard } from "@/components/QuotaCard";

// Replace this with your actual worker URL
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "";

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
  
  // State for dialogs
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isNewBoardDialogOpen, setIsNewBoardDialogOpen] = useState(false);
  const [isRenamingBoard, setIsRenamingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('New Board');
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Ref for the rename input
  const renameInputRef = useRef<HTMLInputElement>(null);
  
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
          name: "My First Board",
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
            name: `Shared Board`,
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
  
  // Function to handle room change
  const handleRoomChange = (roomId: string) => {
    const selectedRoom = availableRooms.find(room => room.id === roomId);
    if (selectedRoom) {
      setCurrentRoom(selectedRoom);
      // Update the URL to reflect the current board
      if (selectedRoom.isShared) {
        router.push(`/?board=${selectedRoom.id}`);
      } else {
        router.push('/');
      }
    }
  };
  
  // Function to create a new board
  const handleCreateNewBoard = () => {
    if (!userId || !newBoardName.trim()) {
      setIsNewBoardDialogOpen(false);
      return;
    }
    
    const newBoard = createNewBoard(userId, newBoardName);
    
    const updatedRooms = [...availableRooms, newBoard];
    localStorage.setItem(`branc-known-boards-${userId}`, JSON.stringify(updatedRooms));
    
    setAvailableRooms(updatedRooms);
    setCurrentRoom(newBoard);
    setIsNewBoardDialogOpen(false);
    setNewBoardName('New Board');
    
    // Update URL for the new shared board
    router.push(`/?board=${newBoard.id}`);
  };
  
  // Function to handle renaming a board
  const handleRenameBoard = () => {
    if (!currentRoom || !newBoardName.trim()) {
      setIsRenamingBoard(false);
      return;
    }
    
    const updatedRoom = { ...currentRoom, name: newBoardName };
    const updatedRooms = availableRooms.map(room => 
      room.id === currentRoom.id ? updatedRoom : room
    );
    
    localStorage.setItem(`branc-known-boards-${userId}`, JSON.stringify(updatedRooms));
    setAvailableRooms(updatedRooms);
    setCurrentRoom(updatedRoom);
    setIsRenamingBoard(false);
  };
  
  // Focus the rename input when it becomes visible
  useEffect(() => {
    if (isRenamingBoard && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenamingBoard]);
  
  // Start renaming with current board name
  const startRenaming = () => {
    if (currentRoom) {
      setNewBoardName(currentRoom.name);
      setIsRenamingBoard(true);
    }
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
  const customShapeUtils = useMemo(() => [ChatShapeUtil, ...defaultShapeUtils], []);
  
  // Create a store connected to multiplayer only if we have a current room
  const store = useSync({
    uri: currentRoom ? `${WORKER_URL}/connect/${currentRoom.id}` : '',
    assets: multiplayerAssetStore,
    shapeUtils: customShapeUtils,
  });

  // Only render the full UI if we have a current room
  if (!currentRoom) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

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

      {/* Board selector and controls - Moved higher up */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 3000,
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        {isRenamingBoard ? (
          <div className="flex items-center gap-2">
            <Input
              ref={renameInputRef}
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onBlur={handleRenameBoard}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameBoard();
                if (e.key === 'Escape') setIsRenamingBoard(false);
              }}
              className="w-[180px]"
            />
            <Button size="sm" variant="outline" onClick={handleRenameBoard}>
              Save
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Select value={currentRoom.id} onValueChange={handleRoomChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a board" />
              </SelectTrigger>
              <SelectContent>
                {availableRooms.map(room => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name} {room.isShared && "👥"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={startRenaming}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <Button size="sm" variant="outline" onClick={() => setIsNewBoardDialogOpen(true)}>
          New Board
        </Button>
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
          
          // Log store information for debugging
          console.log("TLDraw store initialized with room:", currentRoom);
        }}
      />

      <div className="absolute top-1 right-1 flex gap-1" style={{ zIndex: 2000 }}>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleShareBoard}
        >
          Share
        </Button>
        <SignOutButton>
          <Button size="sm" variant="default">
            Sign Out
          </Button>
        </SignOutButton>
      </div>

      {/* New Board Dialog */}
      <Dialog open={isNewBoardDialogOpen} onOpenChange={setIsNewBoardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Board</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="boardName" className="text-right">
                Board Name
              </Label>
              <Input
                id="boardName"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewBoardDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewBoard}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        .tldraw-style-panel,
        .tlui-style-panel {
          top: 45px !important;
        }
      `}</style>
    </div>
  );
}