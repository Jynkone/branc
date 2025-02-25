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
import { useMemo, useState, useEffect } from 'react';
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

// Type for our room data
interface RoomData {
  id: string;
  name: string;
  isShared: boolean;
  owner: string;
  editors: string[];
  viewers: string[];
}

// A simple function to get a user's boards from local storage
const getUserBoards = (userId: string): RoomData[] => {
  const storageKey = `branc-user-boards-${userId}`;
  const storedBoards = localStorage.getItem(storageKey);
  if (!storedBoards) return [];
  
  try {
    return JSON.parse(storedBoards);
  } catch (err) {
    console.error("Error parsing stored boards:", err);
    return [];
  }
};

// Save boards to local storage
const saveUserBoards = (userId: string, boards: RoomData[]) => {
  const storageKey = `branc-user-boards-${userId}`;
  localStorage.setItem(storageKey, JSON.stringify(boards));
};

export function Canvas({ userId }: { userId: string }) {
  // State for the current room and all available rooms
  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomData[]>([]);
  
  // State for sharing dialog
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('editor');
  
  // Set up user's boards on first render
  useEffect(() => {
    if (!userId) return;
    
    const boards = getUserBoards(userId);
    
    // If user has no boards, create a default one
    if (boards.length === 0) {
      const defaultBoard: RoomData = {
        id: `user-${userId}-board-${Date.now()}`,
        name: "My First Board",
        isShared: false,
        owner: userId,
        editors: [],
        viewers: []
      };
      
      const newBoards = [defaultBoard];
      saveUserBoards(userId, newBoards);
      setAvailableRooms(newBoards);
      setCurrentRoom(defaultBoard);
    } else {
      setAvailableRooms(boards);
      setCurrentRoom(boards[0]);
    }
  }, [userId]);
  
  // Function to handle room change
  const handleRoomChange = (roomId: string) => {
    const selectedRoom = availableRooms.find(room => room.id === roomId);
    if (selectedRoom) {
      setCurrentRoom(selectedRoom);
    }
  };
  
  // Function to create a new board
  const createNewBoard = () => {
    if (!userId) return;
    
    const newBoard: RoomData = {
      id: `user-${userId}-board-${Date.now()}`,
      name: `Board ${availableRooms.length + 1}`,
      isShared: false,
      owner: userId,
      editors: [],
      viewers: []
    };
    
    const updatedRooms = [...availableRooms, newBoard];
    saveUserBoards(userId, updatedRooms);
    setAvailableRooms(updatedRooms);
    setCurrentRoom(newBoard);
  };
  
  // Function to handle sharing a board
  const handleShareBoard = () => {
    if (!currentRoom || !shareEmail || !userId) {
      setIsShareDialogOpen(false);
      return;
    }
    
    // In a real app, you would send an invite via email or store this in a database
    // For now, we'll just update the local state
    const updatedRoom = { ...currentRoom, isShared: true };
    
    if (sharePermission === 'editor') {
      updatedRoom.editors = [...updatedRoom.editors, shareEmail];
    } else {
      updatedRoom.viewers = [...updatedRoom.viewers, shareEmail];
    }
    
    const updatedRooms = availableRooms.map(room => 
      room.id === currentRoom.id ? updatedRoom : room
    );
    
    saveUserBoards(userId, updatedRooms);
    setAvailableRooms(updatedRooms);
    setCurrentRoom(updatedRoom);
    setIsShareDialogOpen(false);
    setShareEmail('');
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
    return <div>Loading...</div>;
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

      {/* Board selector and controls */}
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
        
        <Button size="sm" variant="outline" onClick={createNewBoard}>
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
        }}
      />

      <div className="absolute top-1 right-1 flex gap-1" style={{ zIndex: 2000 }}>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setIsShareDialogOpen(true)}
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                placeholder="colleague@example.com"
                className="col-span-3"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="permission" className="text-right">
                Permission
              </Label>
              <Select 
                value={sharePermission} 
                onValueChange={(value) => setSharePermission(value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select permission" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Can edit</SelectItem>
                  <SelectItem value="viewer">Can view</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleShareBoard}>Share</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .tldraw-style-panel,
        .tlui-style-panel {
          top: 35px !important;
        }
      `}</style>
    </div>
  );
}