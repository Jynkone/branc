import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Type for our room data
export interface RoomData {
  id: string;
  name: string;
  isShared: boolean;
  owner: string; // User ID of the owner, or 'unknown' for boards added via link
  createdAt: number;
}

// Function to generate user's default board ID
// This is deterministic - will always create the same ID for the same user
const getDefaultBoardId = (userId: string): string => {
  return `user-${userId}-default-board`;
};

// Generate a shareable board ID that can be accessed by anyone with the link
const generateShareableBoardId = (): string => {
  return `shared-board-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Create a new board object
const createNewBoardData = (userId: string, name: string): RoomData => {
  return {
    id: generateShareableBoardId(),
    name,
    isShared: true, // New boards are shareable by default now
    owner: userId,
    createdAt: Date.now(),
  };
};

const LOCAL_STORAGE_KEY_PREFIX = 'branc-known-boards-';

export function useBoardManager(userId: string | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sharedBoardId = searchParams.get('board');

  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = userId ? `${LOCAL_STORAGE_KEY_PREFIX}${userId}` : null;

  // Load rooms from localStorage on mount or when userId changes
  useEffect(() => {
    if (!userId || !storageKey) {
      // If no user ID, maybe handle anonymous state or redirect?
      // For now, just clear rooms and stop loading.
      setAvailableRooms([]);
      setCurrentRoom(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const storedBoardsStr = localStorage.getItem(storageKey);
    let storedBoards: RoomData[] = [];

    if (storedBoardsStr) {
      try {
        storedBoards = JSON.parse(storedBoardsStr);
        // Basic validation (optional but good practice)
        if (!Array.isArray(storedBoards)) {
          console.warn("Stored boards data is not an array, resetting.");
          storedBoards = [];
        } else {
          storedBoards = storedBoards.filter(board => board && typeof board.id === 'string');
        }
      } catch (err) {
        console.error("Error parsing stored boards:", err);
        // Potentially corrupted data, reset
        storedBoards = [];
        localStorage.removeItem(storageKey); // Clear corrupted data
      }
    }

    // Ensure default board exists
    const defaultBoardId = getDefaultBoardId(userId);
    let defaultBoard = storedBoards.find(board => board.id === defaultBoardId);

    if (!defaultBoard) {
      defaultBoard = {
        id: defaultBoardId,
        name: "My Board", // Default name
        isShared: false, // Default board is private initially
        owner: userId,
        createdAt: Date.now(),
      };
      storedBoards.push(defaultBoard);
      // Persist immediately if default board was created
      localStorage.setItem(storageKey, JSON.stringify(storedBoards));
    }

    let roomToSelect: RoomData | null = null;

    // Prioritize shared board ID from URL
    if (sharedBoardId) {
      let sharedBoard = storedBoards.find(board => board.id === sharedBoardId);

      if (!sharedBoard) {
        // Board from URL not found locally, add it
        // We need a way to potentially fetch the name if possible,
        // but for now, use a placeholder.
        sharedBoard = {
          id: sharedBoardId,
          name: `Shared Board`, // Placeholder name
          isShared: true,
          owner: 'unknown', // We don't know the owner yet
          createdAt: Date.now(), // Use current time as creation time locally
        };
        storedBoards.push(sharedBoard);
        localStorage.setItem(storageKey, JSON.stringify(storedBoards));
      }
      roomToSelect = sharedBoard;
    } else {
      // No shared board in URL, use the default board
      roomToSelect = defaultBoard;
    }

    setAvailableRooms(storedBoards);
    setCurrentRoom(roomToSelect);
    setIsLoading(false);
    console.log("Board manager initialized. Current room:", roomToSelect?.id);

  }, [userId, sharedBoardId, storageKey]); // Rerun when user or URL changes

  // Function to persist rooms to localStorage
  const persistRooms = useCallback((rooms: RoomData[]) => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(rooms));
    }
  }, [storageKey]);

  // Select a board
  const selectBoard = useCallback((boardId: string) => {
    const selectedRoom = availableRooms.find(room => room.id === boardId);
    if (selectedRoom) {
      setCurrentRoom(selectedRoom);
      // Update URL
      if (selectedRoom.isShared && selectedRoom.id !== getDefaultBoardId(userId!)) {
        router.push(`/?board=${selectedRoom.id}`, { scroll: false });
      } else {
        // If it's the default board or not shared, go to the root URL
        router.push('/', { scroll: false });
      }
      console.log("Selected board:", selectedRoom.id);
    } else {
      console.warn("Attempted to select non-existent board:", boardId);
    }
  }, [availableRooms, router, userId]);

  // Create a new board
  const createNewBoard = useCallback(() => {
    if (!userId) return;

    const boardNumber = availableRooms.filter(b => b.owner === userId).length + 1; // Count only user's boards for naming
    const newBoard = createNewBoardData(userId, `Page ${boardNumber}`);

    const updatedRooms = [...availableRooms, newBoard];
    setAvailableRooms(updatedRooms);
    persistRooms(updatedRooms);
    setCurrentRoom(newBoard); // Select the new board

    // Update URL for the new shared board
    router.push(`/?board=${newBoard.id}`, { scroll: false });
    console.log("Created new board:", newBoard.id);
    return newBoard; // Return the created board object
  }, [userId, availableRooms, persistRooms, router]);

  // Rename a board
  const renameBoard = useCallback((boardId: string, newName: string) => {
    if (!newName.trim()) return; // Ignore empty names

    let updatedRoom: RoomData | null = null;
    const updatedRooms = availableRooms.map(room => {
      if (room.id === boardId) {
        updatedRoom = { ...room, name: newName.trim() };
        return updatedRoom;
      }
      return room;
    });

    if (updatedRoom) {
      setAvailableRooms(updatedRooms);
      persistRooms(updatedRooms);
      // If the renamed board is the current one, update the currentRoom state
      if (currentRoom?.id === boardId) {
        setCurrentRoom(updatedRoom);
      }
      console.log("Renamed board:", boardId, "to", newName.trim());
    }
  }, [availableRooms, currentRoom, persistRooms]);

  // Make a board shareable (if it wasn't already)
  const ensureBoardIsShareable = useCallback((boardId: string): string | null => {
    let boardLink: string | null = null;
    let needsUpdate = false;
    let updatedRoomData: RoomData | null = null;

    const updatedRooms = availableRooms.map(room => {
      if (room.id === boardId) {
        boardLink = `${window.location.origin}/?board=${room.id}`;
        if (!room.isShared) {
          needsUpdate = true;
          updatedRoomData = { ...room, isShared: true };
          return updatedRoomData;
        } else {
          updatedRoomData = room; // Keep track even if no change
        }
      }
      return room;
    });

    if (needsUpdate && updatedRoomData) {
      setAvailableRooms(updatedRooms);
      persistRooms(updatedRooms);
      // Update current room state if it was the one modified
      if (currentRoom?.id === boardId) {
        setCurrentRoom(updatedRoomData);
      }
      console.log("Made board shareable:", boardId);
    }

    return boardLink;
  }, [availableRooms, currentRoom, persistRooms]);


  return {
    isLoading,
    currentRoom,
    availableRooms,
    selectBoard,
    createNewBoard,
    renameBoard,
    ensureBoardIsShareable,
    getDefaultBoardId: userId ? () => getDefaultBoardId(userId) : () => '', // Expose default board ID generator
  };
}
