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
import { QuotaCard } from "@/components/QuotaCard";
import { getUserBoards, createBoard, renameBoard, userHasAccessToBoard, BoardData } from "@/lib/boardService";

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

// Function to generate user's default board ID
// This is deterministic - will always create the same ID for the same user
const getDefaultBoardId = (userId: string) => {
  return `user-${userId}-default-board`;
};

export function Canvas({ userId }: { userId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get the board ID from the URL if available
  const sharedBoardId = searchParams.get('board');
  
  // State for the current room and all available rooms
  const [currentRoom, setCurrentRoom] = useState<BoardData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<BoardData[]>([]);
  
  // State for dialogs
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isNewBoardDialogOpen, setIsNewBoardDialogOpen] = useState(false);
  const [isRenamingBoard, setIsRenamingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('New Board');
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ref for the rename input
  const renameInputRef = useRef<HTMLInputElement>(null);
  
  // Effect to initialize rooms
  useEffect(() => {
    if (!userId) return;
    
    // Use a ref to track if we're in the middle of a board change to prevent double creation
    const isChangingRef = useRef(false);
    
    if (isChangingRef.current) return;
    
    setIsLoading(true);
    isChangingRef.current = true;
    
    // Rest of the function unchanged
    
    const initializeRooms = async () => {
      try {
        const boards = await getUserBoards(userId);
        
        // Rest of the code unchanged
        
      } catch (err) {
        console.error("Error initializing boards:", err);
        setAvailableRooms([]);
        setCurrentRoom(null);
      } finally {
        setIsLoading(false);
        isChangingRef.current = false;
      }
    };
    
    initializeRooms();
  }, [userId, sharedBoardId, router]);
    
  // Function to handle room change
  const handleRoomChange = (roomId: string) => {
    const selectedRoom = availableRooms.find(room => room.id === roomId);
    if (selectedRoom) {
      setCurrentRoom(selectedRoom);
      // Update the URL to reflect the current board
      if (selectedRoom.isShared || !selectedRoom.id.startsWith('user-')) {
        router.push(`/?board=${selectedRoom.id}`);
      } else {
        router.push('/');
      }
    }
  };
  
  // Function to create a new board
  const handleCreateNewBoard = async () => {
    if (!userId || !newBoardName.trim()) {
      setIsNewBoardDialogOpen(false);
      return;
    }
    
    try {
      // Create the board in Supabase
      const newBoard = await createBoard(userId, newBoardName);
      
      const updatedRooms = [...availableRooms, newBoard];
      setAvailableRooms(updatedRooms);
      setCurrentRoom(newBoard);
      
      // Update URL for the new shared board
      router.push(`/?board=${newBoard.id}`);
    } catch (err) {
      console.error("Error creating new board:", err);
    } finally {
      setIsNewBoardDialogOpen(false);
      setNewBoardName('New Board');
    }
  };
  
  // Function to handle renaming a board
  const handleRenameBoard = async () => {
    if (!currentRoom || !newBoardName.trim() || !userId) {
      setIsRenamingBoard(false);
      return;
    }
    
    try {
      // Update the board name in Supabase
      await renameBoard(userId, currentRoom.id, newBoardName);
      
      const updatedRoom = { ...currentRoom, name: newBoardName };
      const updatedRooms = availableRooms.map(room => 
        room.id === currentRoom.id ? updatedRoom : room
      );
      
      setAvailableRooms(updatedRooms);
      setCurrentRoom(updatedRoom);
    } catch (err) {
      console.error("Error renaming board:", err);
    } finally {
      setIsRenamingBoard(false);
    }
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

  // Show a loading state while initializing
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading your boards...</div>;
  }

  // Only render the full UI if we have a current room
  if (!currentRoom) {
    return <div className="flex items-center justify-center h-screen">Unable to load board. Please try again.</div>;
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