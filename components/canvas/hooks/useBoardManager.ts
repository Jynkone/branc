// File: Jynkone/branc/branc-35acf07df2bc3fdbf1d7d97ee2c139d0fcf9291a/components/canvas/hooks/useBoardManager.ts
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

export interface RoomData {
  id: string;
  name: string;
  isShared: boolean;
  owner: string;
  createdAt: number;
}

const getDefaultBoardId = (userId: string): string => {
  const cleanUserId = userId.replace(/^user[_-]+/, "");
  return `user-${cleanUserId}-default-board`;
};

// Use the environment variable for the worker URL for board APIs
const getWorkerApiBaseUrl = () => {
  // For production, NEXT_PUBLIC_WORKER_URL should be set to your deployed worker URL.
  // For local dev, if you run your worker on port 8787, this default is fine.
  const url = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";
  return url.startsWith("http") ? url : `https://${url}`;
};
const BOARDS_API_BASE_URL = getWorkerApiBaseUrl(); // Use this for /api/boards

export function useBoardManager(userId: string | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sharedBoardIdFromUrl = searchParams.get('board');
  const { getToken } = useAuth();

  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Log the determined API base URL for boards when the hook initializes or userId changes
    console.log(`[useBoardManager] BOARDS_API_BASE_URL set to: ${BOARDS_API_BASE_URL}`);

    if (!userId) {
      setAvailableRooms([]);
      setCurrentRoom(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchBoards = async () => {
      try {
        const token = await getToken();
        // Only require token if auth is supposed to be used (as per your frontend flag)
        if (!token && process.env.NEXT_PUBLIC_USE_AUTH === 'true') {
            throw new Error('User is not authenticated for fetching boards.');
        }

        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        console.log(`[useBoardManager] Fetching boards from: ${BOARDS_API_BASE_URL}/api/boards`);
        const response = await fetch(`${BOARDS_API_BASE_URL}/api/boards`, {
            headers
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error("[useBoardManager] Failed to fetch boards response:", response.status, errorBody);
          if (response.status === 401) {
             throw new Error('Unauthorized: Please log in to fetch boards.');
          }
          throw new Error(`Failed to fetch boards: ${response.status} ${response.statusText}`);
        }
        let fetchedBoards: RoomData[] = await response.json();

        if (!isMounted) return;

        const defaultBoardId = getDefaultBoardId(userId);
        let defaultBoard = fetchedBoards.find(board => board.id === defaultBoardId);

        if (!defaultBoard && fetchedBoards.length > 0) {
            // If no explicit default board, but other boards exist, pick the first one.
            // defaultBoard = fetchedBoards[0];
            console.warn("[useBoardManager] Default board not found. Will select shared board or first available if no shared board in URL.");
        } else if (!defaultBoard && fetchedBoards.length === 0) {
            console.log("[useBoardManager] No boards found for user, including default.");
        }


        let roomToSelect: RoomData | null = null;

        if (sharedBoardIdFromUrl) {
          roomToSelect = fetchedBoards.find(board => board.id === sharedBoardIdFromUrl) || null;
          if (!roomToSelect) {
            console.warn(`[useBoardManager] Board ${sharedBoardIdFromUrl} from URL not found in user's fetched list.`);
            // Fallback to default or first available if shared board isn't in the list
            roomToSelect = defaultBoard || (fetchedBoards.length > 0 ? fetchedBoards[0] : null);
          }
        } else {
          roomToSelect = defaultBoard || (fetchedBoards.length > 0 ? fetchedBoards[0] : null);
        }

        setAvailableRooms(fetchedBoards);
        setCurrentRoom(roomToSelect);

        if (roomToSelect) {
            console.log("[useBoardManager] Initially selected board:", roomToSelect.id);
        } else {
            console.log("[useBoardManager] No board initially selected (no default, no shared in URL, or no boards exist).");
        }

      } catch (err: any) {
        console.error("[useBoardManager] Error in fetchBoards:", err.message, err.stack);
        if (isMounted) setError(err.message || 'Failed to load boards.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchBoards();

    return () => { isMounted = false; };

  }, [userId, sharedBoardIdFromUrl, getToken]);


  const selectBoard = useCallback((boardId: string) => {
    const selectedRoom = availableRooms.find(room => room && room.id === boardId);
    if (selectedRoom) {
      setCurrentRoom(selectedRoom);
      const newPath = (selectedRoom.isShared && userId && selectedRoom.id !== getDefaultBoardId(userId))
                       ? `/?board=${selectedRoom.id}`
                       : '/';
      if ((typeof window !== "undefined") && (window.location.pathname + window.location.search !== newPath)) {
        router.push(newPath, { scroll: false });
      }
      console.log("[useBoardManager] Selected board:", selectedRoom.id);
    } else {
      console.warn("[useBoardManager] Attempted to select non-existent board:", boardId);
    }
  }, [availableRooms, router, userId]);

  const createNewBoard = useCallback(async () => {
    if (!userId) return null;

    const boardNumber = availableRooms.filter(b => b.owner === userId).length + 1;
    const suggestedName = `Page ${boardNumber}`;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token && process.env.NEXT_PUBLIC_USE_AUTH === 'true') {
            throw new Error('User is not authenticated for creating board.');
      }
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log(`[useBoardManager] Creating new board via: ${BOARDS_API_BASE_URL}/api/boards`);
      const response = await fetch(`${BOARDS_API_BASE_URL}/api/boards`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: suggestedName }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[useBoardManager] Failed to create board response:", response.status, errorBody);
        if (response.status === 401) {
           throw new Error('Unauthorized: Could not create board.');
        }
        throw new Error(`Failed to create board: ${response.status} ${response.statusText}`);
      }

      const newBoard: RoomData = await response.json();
      setAvailableRooms(prevRooms => [...prevRooms, newBoard]);
      // setCurrentRoom(newBoard); // SelectBoard will handle setting currentRoom and URL
      selectBoard(newBoard.id); // Use selectBoard to update currentRoom and URL
      console.log("[useBoardManager] Created new board via API:", newBoard.id);
      setIsLoading(false);
      return newBoard;

    } catch (err: any) {
      console.error("[useBoardManager] Error creating board:", err);
      setError(err.message || 'Failed to create board.');
      setIsLoading(false);
      return null;
    }
  }, [userId, availableRooms, getToken, selectBoard]); // Added selectBoard

  const renameBoard = useCallback(async (boardId: string, newName: string) => {
    if (!userId || !newName.trim()) return;

    const trimmedName = newName.trim();
    const originalRoomIndex = availableRooms.findIndex(r => r.id === boardId);
    if (originalRoomIndex === -1) {
        console.error("[useBoardManager] Cannot rename: board not found locally", boardId);
        setError("Cannot rename: board not found locally.");
        return;
    }
    const originalRoom = { ...availableRooms[originalRoomIndex] };

    setAvailableRooms(prevRooms =>
        prevRooms.map(room =>
            room.id === boardId ? { ...room, name: trimmedName } : room
        )
    );
    if (currentRoom?.id === boardId) {
        setCurrentRoom(prev => prev ? { ...prev, name: trimmedName } : null);
    }
    setError(null);

    try {
      const token = await getToken();
      if (!token && process.env.NEXT_PUBLIC_USE_AUTH === 'true') {
            throw new Error('User is not authenticated for renaming board.');
      }
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log(`[useBoardManager] Renaming board ${boardId} via: ${BOARDS_API_BASE_URL}/api/boards/${boardId}`);
      const response = await fetch(`${BOARDS_API_BASE_URL}/api/boards/${boardId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
         setAvailableRooms(prevRooms => {
            const rooms = [...prevRooms];
            rooms[originalRoomIndex] = originalRoom; // Rollback
            return rooms;
         });
         if (currentRoom?.id === boardId) {
             setCurrentRoom(originalRoom); // Rollback
         }
        const errorBody = await response.text();
        console.error("[useBoardManager] Failed to rename board response:", response.status, errorBody);
        if (response.status === 401) throw new Error('Unauthorized: Could not rename board.');
        if (response.status === 403) throw new Error('Forbidden: You do not own this board.');
        if (response.status === 404) throw new Error('Board not found on server for renaming.');
        throw new Error(`Failed to rename board: ${response.status} ${response.statusText}`);
      }

      const updatedBoardFromServer: RoomData = await response.json();
      setAvailableRooms(prevRooms => prevRooms.map(room =>
        room.id === boardId ? updatedBoardFromServer : room
      ));
       if (currentRoom?.id === boardId) {
           setCurrentRoom(updatedBoardFromServer);
       }
      console.log("[useBoardManager] Renamed board via API:", boardId, "to", trimmedName);

    } catch (err: any) {
      console.error("[useBoardManager] Error renaming board:", err);
      setError(err.message || 'Failed to rename board.');
       setAvailableRooms(prevRooms => { // Ensure rollback on any error
            const rooms = [...prevRooms];
            rooms[originalRoomIndex] = originalRoom;
            return rooms;
         });
       if (currentRoom?.id === boardId) {
           setCurrentRoom(originalRoom);
       }
    }
  }, [userId, availableRooms, currentRoom, getToken]);

  const ensureBoardIsShareable = useCallback((boardId: string): string | null => {
     const room = availableRooms.find(r => r.id === boardId);
     if (!room) {
        console.warn(`[useBoardManager] ensureBoardIsShareable: Room ${boardId} not found in available rooms.`);
        return null;
     }

     const origin = typeof window !== 'undefined' ? window.location.origin : '';
     // All boards created by the worker are shareable by ID format.
     // The default board also needs a shareable link.
     if (room.id.startsWith('shared-board-') || (userId && room.id === getDefaultBoardId(userId))) {
         return `${origin}/?board=${room.id}`;
     }
     // This case should ideally not be hit if all board IDs are generated correctly by the worker
     console.warn("[useBoardManager] Board ID format not recognized as directly shareable or not default:", boardId);
     return `${origin}/?board=${room.id}`; // Fallback to generate link anyway, server will handle auth
  }, [availableRooms, userId]);

  return {
    isLoading,
    error,
    currentRoom,
    availableRooms,
    selectBoard,
    createNewBoard,
    renameBoard,
    ensureBoardIsShareable,
    getDefaultBoardId: userId ? () => getDefaultBoardId(userId) : () => '',
  };
}