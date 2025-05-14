// File: Jynkone/branc/branc-35acf07df2bc3fdbf1d7d97ee2c139d0fcf9291a/components/canvas/hooks/useBoardManager.ts
import { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo
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

// No need for generateShareableBoardId here as worker handles it

export function useBoardManager(userId: string | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sharedBoardIdFromUrl = searchParams.get('board');
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const BOARDS_API_BASE_URL = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_WORKER_URL;
    if (!url) {
      console.error("[useBoardManager] CRITICAL: NEXT_PUBLIC_WORKER_URL is not set!");
      // Fallback to a non-functional placeholder or throw an error for production
      // For now, let's assume it will be set in production.
      // For local, if you run worker on 8787 and Next on 3000, this needs to be http://localhost:8787
      return "http://localhost:8787"; // This should be your worker's local URL if testing locally
    }
    return url.startsWith("http") ? url : `https://${url}`;
  }, []);

  useEffect(() => {
    console.log(`[useBoardManager] Hook init/deps changed. userId: ${userId}, isLoaded: ${isLoaded}, isSignedIn: ${isSignedIn}, BOARDS_API_BASE_URL: ${BOARDS_API_BASE_URL}`);

    if (!isLoaded) {
      console.log("[useBoardManager] Clerk not loaded. Waiting...");
      setIsLoading(true);
      return;
    }

    // If auth is required and user is not signed in (and Clerk is loaded)
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
      console.log("[useBoardManager] Auth required, but user not signed in.");
      setAvailableRooms([]);
      setCurrentRoom(null);
      setError("User not authenticated. Please sign in.");
      setIsLoading(false);
      return;
    }

    // If auth is required, user is signed in, but userId prop isn't available yet (transient state)
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && !userId) {
      console.warn("[useBoardManager] Clerk signed in, but userId prop is null/undefined. Waiting for userId.");
      setIsLoading(true); // Keep loading until userId is available
      return;
    }

    // Determine the effective user ID for API calls (real or anonymous for dev)
    const effectiveUserIdForApi = process.env.NEXT_PUBLIC_USE_AUTH === 'true' ? userId : "anonymous-user";
    if (!effectiveUserIdForApi && process.env.NEXT_PUBLIC_USE_AUTH === 'true') {
        console.error("[useBoardManager] Auth required, but no effective user ID for API call.");
        setError("Authentication error: User ID missing.");
        setIsLoading(false);
        return;
    }


    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchBoards = async () => {
      if (!effectiveUserIdForApi && process.env.NEXT_PUBLIC_USE_AUTH === 'true') {
        // This check is a bit redundant due to above but good for safety
        setError("Cannot fetch boards without a user ID when authentication is enabled.");
        setIsLoading(false);
        return;
      }
      try {
        let token: string | null = null;
        if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) { // Ensure isSignedIn and actual userId
            token = await getToken();
            console.log("[useBoardManager] Clerk Token for fetchBoards:", token ? `Retrieved (first 20: ${token.substring(0,20)}...)` : "getToken() returned null/undefined");
            if (!token) {
                // This could happen if session exists but token generation fails for some reason
                throw new Error('Authentication token could not be retrieved even though user is signed in.');
            }
        }

        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        console.log(`[useBoardManager] Fetching boards from: ${BOARDS_API_BASE_URL}/api/boards. Auth header ${token ? 'present' : 'absent'}.`);
        const response = await fetch(`${BOARDS_API_BASE_URL}/api/boards`, { headers });

        if (!response.ok) {
          const errorBodyText = await response.text();
          let errorDetail = errorBodyText;
          try { const errorJson = JSON.parse(errorBodyText); errorDetail = errorJson.error || errorJson.message || errorBodyText; } catch (e) {}
          console.error(`[useBoardManager] Failed to fetch boards. Status: ${response.status}. URI: ${response.url}. Body: ${errorBodyText}`);
          throw new Error(`Failed to fetch boards: ${response.status} - ${errorDetail}`);
        }
        let fetchedBoards: RoomData[] = await response.json();

        if (!isMounted) return;

        const actualUserIdForDefaults = userId || "anonymous-user"; // Use the prop userId for default board logic
        const defaultBoardId = getDefaultBoardId(actualUserIdForDefaults);
        let defaultBoard = fetchedBoards.find(board => board.id === defaultBoardId);

        if (!defaultBoard) {
            console.warn(`[useBoardManager] Default board (ID: ${defaultBoardId}) not found in fetched list for user: ${actualUserIdForDefaults}.`);
        }

        let roomToSelect: RoomData | null = null;
        if (sharedBoardIdFromUrl) {
          roomToSelect = fetchedBoards.find(board => board.id === sharedBoardIdFromUrl) || null;
          if (!roomToSelect) {
            console.warn(`[useBoardManager] Shared board ${sharedBoardIdFromUrl} not in fetched list. Falling back.`);
            roomToSelect = defaultBoard || (fetchedBoards.length > 0 ? fetchedBoards[0] : null);
          }
        } else {
          roomToSelect = defaultBoard || (fetchedBoards.length > 0 ? fetchedBoards[0] : null);
        }

        setAvailableRooms(fetchedBoards);
        setCurrentRoom(roomToSelect);

        if (roomToSelect) {
            console.log("[useBoardManager] Initially selected board:", roomToSelect.id, "Name:", roomToSelect.name);
        } else {
            console.log("[useBoardManager] No board initially selected (no default, no valid shared in URL, or no boards exist for user).");
        }

      } catch (err: any) {
        console.error("[useBoardManager] Error in fetchBoards logic:", err.message, err.stack);
        if (isMounted) setError(err.message || 'Failed to load boards.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchBoards();

    return () => { isMounted = false; };

  }, [userId, sharedBoardIdFromUrl, getToken, BOARDS_API_BASE_URL, isLoaded, isSignedIn]);


  const selectBoard = useCallback((boardId: string) => { // selectBoard is defined here
    const selectedRoom = availableRooms.find(room => room && room.id === boardId);
    if (selectedRoom) {
      setCurrentRoom(selectedRoom);
      const actualUserIdForDefaults = userId || "anonymous-user";
      const newPath = (selectedRoom.isShared && selectedRoom.id !== getDefaultBoardId(actualUserIdForDefaults))
                       ? `/?board=${selectedRoom.id}`
                       : '/';
      if (typeof window !== "undefined" && (window.location.pathname + window.location.search !== newPath)) {
        router.push(newPath, { scroll: false });
      }
      console.log("[useBoardManager] Selected board:", selectedRoom.id);
    } else {
      console.warn("[useBoardManager] Attempted to select non-existent board:", boardId);
    }
  }, [availableRooms, router, userId]);

  const createNewBoard = useCallback(async () => {
    const effectiveUserId = (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && userId) ? userId : "anonymous-user";
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
        setError("Cannot create board: User not signed in.");
        return null;
    }

    const boardNumber = availableRooms.filter(b => b.owner === effectiveUserId).length + 1;
    const suggestedName = `Page ${boardNumber}`;

    setIsLoading(true); setError(null);
    try {
      let token: string | null = null;
      if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) {
          token = await getToken();
           if (!token) throw new Error('User is authenticated but failed to retrieve token for creating board.');
      }
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      console.log(`[useBoardManager] Creating new board via: ${BOARDS_API_BASE_URL}/api/boards. Auth: ${token ? 'Yes' : 'No'}`);
      const response = await fetch(`${BOARDS_API_BASE_URL}/api/boards`, { method: 'POST', headers, body: JSON.stringify({ name: suggestedName }) });

      if (!response.ok) {
        const errorBodyText = await response.text();
        let errorDetail = errorBodyText; try { const errorJson = JSON.parse(errorBodyText); errorDetail = errorJson.error || errorJson.message || errorBodyText; } catch (e) {}
        console.error("[useBoardManager] Failed to create board response:", response.status, errorBodyText);
        throw new Error(`Failed to create board: ${response.status} - ${errorDetail}`);
      }
      const newBoard: RoomData = await response.json();
      setAvailableRooms(prevRooms => [...prevRooms, newBoard]);
      selectBoard(newBoard.id); // Use selectBoard to set current and navigate
      console.log("[useBoardManager] Created new board via API:", newBoard.id);
      return newBoard;
    } catch (err: any) {
      console.error("[useBoardManager] Error creating board:", err);
      setError(err.message || 'Failed to create board.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userId, availableRooms, getToken, BOARDS_API_BASE_URL, selectBoard, isSignedIn]);

  const renameBoard = useCallback(async (boardId: string, newName: string) => {
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
        setError("Cannot rename board: User not signed in.");
        return;
    }
    if (!newName.trim()) return;

    const trimmedName = newName.trim();
    const originalRoomIndex = availableRooms.findIndex(r => r.id === boardId);
    if (originalRoomIndex === -1) {
        console.error("[useBoardManager] Cannot rename: board not found locally", boardId);
        setError("Cannot rename: board not found locally."); return;
    }
    const originalRoom = { ...availableRooms[originalRoomIndex] };

    const optimisticUpdate = (isRollback = false) => { /* ... */ }; // Keep your optimistic update logic
    optimisticUpdate(); setError(null);

    try {
      let token: string | null = null;
      if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) {
          token = await getToken();
          if (!token) throw new Error('User is authenticated but failed to retrieve token for renaming board.');
      }
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      console.log(`[useBoardManager] Renaming board ${boardId} via: ${BOARDS_API_BASE_URL}/api/boards/${boardId}. Auth: ${token ? 'Yes' : 'No'}`);
      const response = await fetch(`${BOARDS_API_BASE_URL}/api/boards/${boardId}`, { method: 'PUT', headers, body: JSON.stringify({ name: trimmedName }) });

      if (!response.ok) {
        optimisticUpdate(true);
        const errorBodyText = await response.text();
        let errorDetail = errorBodyText; try { const errorJson = JSON.parse(errorBodyText); errorDetail = errorJson.error || errorJson.message || errorBodyText; } catch (e) {}
        console.error("[useBoardManager] Failed to rename board response:", response.status, errorBodyText);
        throw new Error(`Failed to rename board: ${response.status} - ${errorDetail}`);
      }
      const updatedBoardFromServer: RoomData = await response.json();
      setAvailableRooms(prevRooms => prevRooms.map(room => room.id === boardId ? updatedBoardFromServer : room));
      if (currentRoom?.id === boardId) setCurrentRoom(updatedBoardFromServer);
      console.log("[useBoardManager] Renamed board via API:", boardId, "to", trimmedName);
    } catch (err: any) {
      console.error("[useBoardManager] Error renaming board:", err);
      setError(err.message || 'Failed to rename board.');
      optimisticUpdate(true);
    }
  }, [userId, availableRooms, currentRoom, getToken, BOARDS_API_BASE_URL, isSignedIn]);

  const ensureBoardIsShareable = useCallback((boardId: string): string | null => {
    const room = availableRooms.find(r => r.id === boardId);
    if (!room) {
        console.warn(`[useBoardManager] ensureBoardIsShareable: Room ${boardId} not found.`);
        return null;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const actualUserIdForDefaults = userId || "anonymous-user";
    if (room.id.startsWith('shared-board-') || room.id === getDefaultBoardId(actualUserIdForDefaults)) {
        return `${origin}/?board=${room.id}`;
    }
    return `${origin}/?board=${room.id}`; // Fallback
  }, [availableRooms, userId]);

  return {
    isLoading,
    error,
    currentRoom,
    availableRooms,
    selectBoard, // ensure this is returned
    createNewBoard,
    renameBoard,
    ensureBoardIsShareable,
    getDefaultBoardId: userId ? () => getDefaultBoardId(userId) : () => 'user-anonymous-user-default-board', // Provide a fallback for anonymous
  };
}