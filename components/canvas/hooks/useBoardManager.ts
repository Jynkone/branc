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
  const [isLoading, setIsLoading] = useState(true); // Start true
  const [error, setError] = useState<string | null>(null);
  const [isCreatingDefaultBoard, setIsCreatingDefaultBoard] = useState(false); // New state

  const BOARDS_API_BASE_URL = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";
    if (!url) {
      console.error("[useBoardManager] CRITICAL: NEXT_PUBLIC_WORKER_URL is not set!");
      return "http://localhost:8787"; // Should be configured for prod
    }
    return url.startsWith("http") ? url : `https://${url}`;
  }, []);

  // Define createNewBoard before the main useEffect so it can be called
  const createNewBoard = useCallback(async (isDefaultBoardCreation = false) => {
    const effectiveUserId = (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && userId) ? userId : "anonymous-user";
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
        setError("Cannot create board: User not signed in.");
        console.warn("[useBoardManager] createNewBoard: Auth required, but user not signed in.");
        return null;
    }
    if (!effectiveUserId) {
        setError("Cannot create board: User ID is missing.");
        console.warn("[useBoardManager] createNewBoard: User ID is missing.");
        return null;
    }

    // Use a more generic default name, or a specific one for the auto-created default
    const boardName = isDefaultBoardCreation ? "My First Board" : `Page ${availableRooms.filter(b => b.owner === effectiveUserId).length + 1}`;

    console.log(`[useBoardManager] Attempting to create new board with name: "${boardName}" for user: ${effectiveUserId}`);
    if (isDefaultBoardCreation) setIsCreatingDefaultBoard(true);
    else setIsLoading(true); // General loading for user-initiated creation
    setError(null);

    try {
      let token: string | null = null;
      if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) {
          token = await getToken();
           if (!token) throw new Error('User is authenticated but failed to retrieve token for creating board.');
      }
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${BOARDS_API_BASE_URL}/api/boards`, { method: 'POST', headers, body: JSON.stringify({ name: boardName }) });

      if (!response.ok) {
        const errorBodyText = await response.text();
        let errorDetail = errorBodyText; try { const errorJson = JSON.parse(errorBodyText); errorDetail = errorJson.error || errorJson.message || errorBodyText; } catch (e) {}
        console.error("[useBoardManager] Failed to create board response:", response.status, errorBodyText);
        throw new Error(`Failed to create board: ${response.status} - ${errorDetail}`);
      }
      const newBoard: RoomData = await response.json();
      console.log("[useBoardManager] Successfully created board via API:", newBoard);

      setAvailableRooms(prevRooms => [...prevRooms, newBoard]);
      // Select the new board (this will also update currentRoom and URL via selectBoard's logic)
      // Ensure selectBoard is defined when createNewBoard is called
      // We will call selectBoard from the effect after this promise resolves.
      return newBoard;
    } catch (err: any) {
      console.error("[useBoardManager] Error creating board:", err);
      setError(err.message || 'Failed to create board.');
      return null;
    } finally {
      if (isDefaultBoardCreation) setIsCreatingDefaultBoard(false);
      else setIsLoading(false);
    }
  }, [userId, availableRooms, getToken, BOARDS_API_BASE_URL, isSignedIn]); // Removed selectBoard from here


  const selectBoard = useCallback((boardId: string) => {
    const selectedRoom = availableRooms.find(room => room && room.id === boardId);
    if (selectedRoom) {
      console.log("[useBoardManager] Selecting board:", selectedRoom.id, "Name:", selectedRoom.name);
      setCurrentRoom(selectedRoom);
      const actualUserIdForDefaults = userId || "anonymous-user";
      const newPath = (selectedRoom.isShared && selectedRoom.id !== getDefaultBoardId(actualUserIdForDefaults))
                       ? `/?board=${selectedRoom.id}`
                       : '/';
      if (typeof window !== "undefined" && (window.location.pathname + window.location.search !== newPath)) {
        router.push(newPath, { scroll: false });
      }
    } else {
      console.warn("[useBoardManager] Attempted to select non-existent or non-available board:", boardId, "Available rooms:", availableRooms.map(r=>r.id));
      // If boardId is not in availableRooms, it could be a new board just created, or invalid.
      // If it was just created, the availableRooms state might not have updated yet for this call.
      // Consider re-fetching or ensuring state update before select.
      // For now, setCurrentRoom(null) if board not found to avoid inconsistent state.
      // setCurrentRoom(null);
      // router.push('/', { scroll: false });
    }
  }, [availableRooms, router, userId]);


  useEffect(() => {
    console.log(`[useBoardManager] Main effect. userId: ${userId}, isLoaded: ${isLoaded}, isSignedIn: ${isSignedIn}, URL boardId: ${sharedBoardIdFromUrl}`);

    if (!isLoaded) {
      console.log("[useBoardManager] Clerk not loaded. Waiting...");
      setIsLoading(true); return;
    }
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
      console.log("[useBoardManager] Auth required, user not signed in.");
      setAvailableRooms([]); setCurrentRoom(null); setError("User not authenticated."); setIsLoading(false); return;
    }
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && !userId) {
      console.warn("[useBoardManager] Clerk signed in, but userId prop is null. Waiting.");
      setIsLoading(true); return;
    }

    const effectiveUserIdForApi = process.env.NEXT_PUBLIC_USE_AUTH === 'true' ? userId : "anonymous-user";
    if (!effectiveUserIdForApi && process.env.NEXT_PUBLIC_USE_AUTH === 'true') {
        console.error("[useBoardManager] Auth required, but no effective user ID for API call.");
        setError("Authentication error: User ID missing."); setIsLoading(false); return;
    }

    let isMounted = true;
    setIsLoading(true); setError(null);

    const fetchAndProcessBoards = async () => {
      try {
        let token: string | null = null;
        if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) {
            token = await getToken();
            console.log("[useBoardManager] Token for fetchBoards:", token ? "Retrieved" : "Not retrieved");
            if (!token) throw new Error('Auth token could not be retrieved.');
        }
        const headers: HeadersInit = {}; if (token) headers['Authorization'] = `Bearer ${token}`;

        console.log(`[useBoardManager] Fetching boards from: ${BOARDS_API_BASE_URL}/api/boards. Auth: ${token ? 'Yes' : 'No'}`);
        const response = await fetch(`${BOARDS_API_BASE_URL}/api/boards`, { headers });

        if (!response.ok) { /* ... error handling as before ... */ 
            const errorBodyText = await response.text();
            let errorDetail = errorBodyText; try { const errorJson = JSON.parse(errorBodyText); errorDetail = errorJson.error || errorJson.message || errorBodyText; } catch (e) {}
            console.error(`[useBoardManager] Failed to fetch boards. Status: ${response.status}. Body: ${errorBodyText}`);
            throw new Error(`Failed to fetch boards: ${response.status} - ${errorDetail}`);
        }
        let fetchedBoards: RoomData[] = await response.json();
        if (!isMounted) return;
        console.log("[useBoardManager] Fetched boards:", fetchedBoards.map(b => ({id: b.id, name: b.name})));
        setAvailableRooms(fetchedBoards);

        const actualUserIdForDefaults = userId || "anonymous-user";
        const defaultBoardId = getDefaultBoardId(actualUserIdForDefaults);
        let boardToSelect: RoomData | null = null;

        if (sharedBoardIdFromUrl) {
          boardToSelect = fetchedBoards.find(b => b.id === sharedBoardIdFromUrl) || null;
          if (!boardToSelect) console.warn(`[useBoardManager] Shared board ${sharedBoardIdFromUrl} not found in fetched list.`);
        }
        
        if (!boardToSelect) { // If no shared board in URL or not found
            boardToSelect = fetchedBoards.find(b => b.id === defaultBoardId) || null;
            if (!boardToSelect && fetchedBoards.length > 0) {
                boardToSelect = fetchedBoards[0]; // Fallback to first board if default not found
                console.log("[useBoardManager] Default board not found, falling back to first available board:", boardToSelect.id);
            }
        }

        if (boardToSelect) {
          console.log("[useBoardManager] Will attempt to select board:", boardToSelect.id);
          selectBoard(boardToSelect.id);
        } else if (fetchedBoards.length === 0 && !sharedBoardIdFromUrl && effectiveUserIdForApi) {
          // No boards exist, not trying to load a shared one, and we have a user context
          console.log(`[useBoardManager] No boards found for user ${effectiveUserIdForApi}. Attempting to create a default board.`);
          const newDefaultBoard = await createNewBoard(true); // Pass flag for default creation
          if (newDefaultBoard && isMounted) {
            console.log("[useBoardManager] Default board created, selecting it:", newDefaultBoard.id);
            selectBoard(newDefaultBoard.id); // This will set currentRoom and update URL
          } else if (isMounted) {
            console.error("[useBoardManager] Failed to create or select a new default board.");
            setError("Could not create or load a default board.");
            setCurrentRoom(null); // Ensure no room is selected
          }
        } else {
            console.log("[useBoardManager] No board to select (currentRoom will be null). Frontend should handle this.");
            setCurrentRoom(null);
        }

      } catch (err: any) {
        console.error("[useBoardManager] Error in fetchAndProcessBoards:", err.message);
        if (isMounted) setError(err.message || 'Failed to load or initialize boards.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (isLoaded) { // Ensure Clerk is loaded
        if (process.env.NEXT_PUBLIC_USE_AUTH !== 'true' || (isSignedIn && userId)) {
            fetchAndProcessBoards();
        } else if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
            setIsLoading(false);
            // setError("User not signed in."); // Already handled
        }
    }

    return () => { isMounted = false; };
  }, [userId, sharedBoardIdFromUrl, getToken, BOARDS_API_BASE_URL, isLoaded, isSignedIn, router, createNewBoard, selectBoard]);
  // Added createNewBoard and selectBoard to dependency array of the main effect.

  // renameBoard and ensureBoardIsShareable remain largely the same
  // but ensure they use BOARDS_API_BASE_URL and correct auth logic.
  // (Code for renameBoard and ensureBoardIsShareable from previous correct version)

    const renameBoard = useCallback(async (boardId: string, newName: string) => {
        const effectiveUserId = (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && userId) ? userId : "anonymous-user";
        if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
            setError("Cannot rename board: User not signed in.");
            return;
        }
        if (!effectiveUserId) {
             setError("Cannot rename board: User ID is missing."); return;
        }
        if (!newName.trim()) return;

        const trimmedName = newName.trim();
        const originalRoomIndex = availableRooms.findIndex(r => r.id === boardId);
        if (originalRoomIndex === -1) {
            console.error("[useBoardManager] Cannot rename: board not found locally", boardId);
            setError("Cannot rename: board not found locally."); return;
        }
        const originalRoom = { ...availableRooms[originalRoomIndex] };

        // Optimistic Update
        setAvailableRooms(prevRooms => prevRooms.map(room => room.id === boardId ? { ...room, name: trimmedName } : room));
        if (currentRoom?.id === boardId) setCurrentRoom(prev => prev ? { ...prev, name: trimmedName } : null);
        setError(null);

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
                // Rollback optimistic update
                setAvailableRooms(prevRooms => { const rooms = [...prevRooms]; rooms[originalRoomIndex] = originalRoom; return rooms; });
                if (currentRoom?.id === boardId) setCurrentRoom(originalRoom);

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
            // Ensure rollback on any error
            setAvailableRooms(prevRooms => { const rooms = [...prevRooms]; rooms[originalRoomIndex] = originalRoom; return rooms; });
            if (currentRoom?.id === boardId) setCurrentRoom(originalRoom);
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
        // All boards are shareable by ID, default board also.
        return `${origin}/?board=${room.id}`;
      }, [availableRooms, userId]);

  // Expose isLoading and isCreatingDefaultBoard if UI needs to differentiate
  return {
    isLoading: isLoading || isCreatingDefaultBoard, 
    error,
    currentRoom,
    availableRooms,
    selectBoard,
    createNewBoard, // Expose the general createNewBoard
    renameBoard,
    ensureBoardIsShareable,
    getDefaultBoardId: userId ? () => getDefaultBoardId(userId) : () => getDefaultBoardId("anonymous-user"),
  };
}
