// File: Jynkone/branc/branc-35acf07df2bc3fdbf1d7d97ee2c139d0fcf9291a/components/canvas/hooks/useBoardManager.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

export function useBoardManager(userId: string | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `sharedBoardIdFromUrl` needs to be defined at the hook's top level to be accessible throughout
  const sharedBoardIdFromUrl = searchParams.get('board');
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State to track if the initial board processing/creation has been done for this session/user load
  const initialBoardProcessedRef = useRef(false);
  // State to track if currently in the process of creating a default board to avoid race conditions
  const isAutoCreatingBoardRef = useRef(false);


  const BOARDS_API_BASE_URL = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_WORKER_URL;
    if (!url) {
      console.error("[useBoardManager] CRITICAL: NEXT_PUBLIC_WORKER_URL is not set! Defaulting to localhost for dev.");
      return "http://localhost:8787";
    }
    return url.startsWith("http") ? url : `https://${url}`;
  }, []);

  // Stable selectBoard function - its main job is to set currentRoom and navigate
  const selectBoard = useCallback((boardId: string) => {
    // availableRooms will be read from state at the time this function is *called*
    // or, if called from within the effect that sets it, we need to ensure it has the latest.
    // For robustness, let's assume availableRooms state is the source of truth when this is called externally.
    const roomToSelect = availableRooms.find((room: RoomData) => room.id === boardId);

    if (roomToSelect) {
      console.log(`[useBoardManager] selectBoard: Selecting board ID="${roomToSelect.id}", Name="${roomToSelect.name}"`);
      setCurrentRoom(roomToSelect);
      const actualUserIdForDefaults = userId || "anonymous-user";
      const newPath = (roomToSelect.isShared && roomToSelect.id !== getDefaultBoardId(actualUserIdForDefaults))
                       ? `/?board=${roomToSelect.id}`
                       : '/';
      if (typeof window !== "undefined" && (window.location.pathname + window.location.search !== newPath)) {
        router.push(newPath, { scroll: false });
      }
    } else {
      console.warn(`[useBoardManager] selectBoard: Board ID "${boardId}" not found in current availableRooms. Available:`, availableRooms.map((r: RoomData) => r.id));
      // If a board is not found (e.g., after deletion or error), clear currentRoom
      // setCurrentRoom(null); // This might cause issues if it's a timing problem
      // router.push('/', { scroll: false }); // Navigate to base if board is invalid
    }
  }, [availableRooms, router, userId]); // `availableRooms` is a valid dependency here

  const createNewBoard = useCallback(async (isDefaultBoardCreation = false) => {
    const effectiveUserId = (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && userId) ? userId : "anonymous-user";
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
        setError("Cannot create board: User not signed in."); return null;
    }
    if (!effectiveUserId) {
        setError("Cannot create board: User ID is missing."); return null;
    }

    // Read availableRooms from state for naming to get the most current count
    const boardName = isDefaultBoardCreation ? "My First Board" : `Page ${availableRooms.filter((b: RoomData) => b.owner === effectiveUserId).length + 1}`;

    console.log(`[useBoardManager] createNewBoard: Attempting to create new board: "${boardName}" for user: ${effectiveUserId}`);
    if (isDefaultBoardCreation) isAutoCreatingBoardRef.current = true;
    setIsLoading(true); setError(null);

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
        throw new Error(`Failed to create board: ${response.status} - ${errorDetail}`);
      }
      const newBoard: RoomData = await response.json();
      console.log("[useBoardManager] createNewBoard: Successfully created board via API:", newBoard);
      
      // Update availableRooms state immediately
      setAvailableRooms(prevRooms => [...prevRooms, newBoard]);
      return newBoard;
    } catch (err: any) {
      console.error("[useBoardManager] createNewBoard: Error creating board:", err);
      setError(err.message || 'Failed to create board.');
      return null;
    } finally {
      if (isDefaultBoardCreation) isAutoCreatingBoardRef.current = false;
      // setIsLoading(false); // Let the main effect handle overall loading state
    }
  }, [userId, getToken, BOARDS_API_BASE_URL, isSignedIn, availableRooms]); // `availableRooms` for naming


  useEffect(() => {
    console.log(`[useBoardManager] Main effect. userId: ${userId}, Clerk Loaded: ${isLoaded}, SignedIn: ${isSignedIn}, URL boardId: ${sharedBoardIdFromUrl}, InitialProcessed: ${initialBoardProcessedRef.current}`);

    if (!isLoaded) { console.log("[useBoardManager] Clerk not yet loaded."); return; }

    if (initialBoardProcessedRef.current && !sharedBoardIdFromUrl) {
        // If we've already processed initial boards and there's no NEW sharedBoardId in the URL to handle,
        // and we already have a currentRoom, we can often skip re-processing.
        // However, if userId changes, we MUST reprocess.
        // The dependency array handles userId changes.
        // console.log("[useBoardManager] Initial processing done, no new shared board in URL.");
        // If currentRoom is already set, no need to set isLoading to true again.
        if (currentRoom) setIsLoading(false);
        return;
    }
    
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true') {
        if (!isSignedIn) {
            console.log("[useBoardManager] Auth required, user not signed in. Clearing state.");
            setAvailableRooms([]); setCurrentRoom(null); setError("User not authenticated."); setIsLoading(false);
            initialBoardProcessedRef.current = true; // Mark as processed to prevent loop on auth pages
            return;
        }
        if (!userId) {
            console.warn("[useBoardManager] Auth required, Clerk signed in, but userId prop is null. Waiting.");
            setIsLoading(true); // Wait for userId prop
            return;
        }
    }

    let isMounted = true;
    setIsLoading(true); setError(null);

    const fetchAndInitializeBoards = async () => {
      console.log("[useBoardManager] fetchAndInitializeBoards: Starting.");
      try {
        let token: string | null = null;
        if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) { // Check userId here too
            token = await getToken();
            if (!token) throw new Error('Authentication token could not be retrieved.');
        }
        const headers: HeadersInit = {}; if (token) headers['Authorization'] = `Bearer ${token}`;

        const fetchUrl = `${BOARDS_API_BASE_URL}/api/boards`;
        console.log(`[useBoardManager] fetchAndInitializeBoards: Fetching from ${fetchUrl}. Auth: ${token ? 'Yes' : 'No'}`);
        const response = await fetch(fetchUrl, { headers });

        if (!response.ok) { throw new Error(`Failed to fetch boards: ${response.status}`); }
        
        const fetchedBoards: RoomData[] = await response.json();
        if (!isMounted) return;
        console.log("[useBoardManager] fetchAndInitializeBoards: Fetched boards count:", fetchedBoards.length);
        setAvailableRooms(fetchedBoards); // Set available rooms first

        const actualUserIdForDefaults = userId || "anonymous-user";
        const defaultBoardId = getDefaultBoardId(actualUserIdForDefaults);
        let boardToSelect: RoomData | null = null;

        const currentUrlBoardId = searchParams.get('board'); // Re-get in case it changed

        if (currentUrlBoardId) {
          boardToSelect = fetchedBoards.find((b: RoomData) => b.id === currentUrlBoardId) || null;
          if (boardToSelect) console.log(`[useBoardManager] fetchAndInitializeBoards: Found board from URL: ${currentUrlBoardId}`);
          else console.warn(`[useBoardManager] fetchAndInitializeBoards: Board from URL ${currentUrlBoardId} not in fetched list.`);
        }
        
        if (!boardToSelect) {
            boardToSelect = fetchedBoards.find((b: RoomData) => b.id === defaultBoardId) || null;
            if (boardToSelect) console.log(`[useBoardManager] fetchAndInitializeBoards: Found default board: ${defaultBoardId}`);
            else if (fetchedBoards.length > 0) {
                boardToSelect = fetchedBoards[0];
                console.log(`[useBoardManager] fetchAndInitializeBoards: Default not found, selected first available: ${boardToSelect.id}`);
            }
        }

        if (boardToSelect) {
          if (isMounted) {
            console.log(`[useBoardManager] fetchAndInitializeBoards: Selecting existing/found board: ${boardToSelect.id}`);
            selectBoard(boardToSelect.id); // selectBoard will set currentRoom and navigate
          }
        } else if (fetchedBoards.length === 0 && !currentUrlBoardId && !isAutoCreatingBoardRef.current) {
          // Only create if no boards, no URL board, and not already in process of creating one
          console.log(`[useBoardManager] fetchAndInitializeBoards: No boards for user ${actualUserIdForDefaults}. Creating default.`);
          const newDefaultBoard = await createNewBoard(true); // createNewBoard now sets isAutoCreatingBoardRef
          if (newDefaultBoard && isMounted) {
            console.log("[useBoardManager] fetchAndInitializeBoards: Default board created, selecting it:", newDefaultBoard.id);
            // createNewBoard already updates availableRooms. selectBoard will use the updated state.
            selectBoard(newDefaultBoard.id);
          } else if (isMounted) {
            setError("Could not create or load a default board."); setCurrentRoom(null);
          }
        } else {
          if (isMounted) {
            console.log("[useBoardManager] fetchAndInitializeBoards: No specific board to select, currentRoom will be null.");
            setCurrentRoom(null); // Explicitly set to null if no board is chosen
          }
        }
      } catch (err: any) {
        console.error("[useBoardManager] fetchAndInitializeBoards: Error:", err.message);
        if (isMounted) setError(err.message || 'Failed to initialize boards.');
      } finally {
        if (isMounted) {
            setIsLoading(false);
            if (!sharedBoardIdFromUrl) { // Only mark as processed if not trying to load a specific shared board initially
                initialBoardProcessedRef.current = true;
            }
        }
      }
    };

    // Conditions to run the main initialization logic
    if (isLoaded && (process.env.NEXT_PUBLIC_USE_AUTH !== 'true' || (isSignedIn && userId))) {
        // Only run if not already processed for this userId or if a new sharedBoardIdFromUrl is present
        if (!initialBoardProcessedRef.current || (sharedBoardIdFromUrl && currentRoom?.id !== sharedBoardIdFromUrl)) {
            fetchAndInitializeBoards();
        } else {
             setIsLoading(false); // Already processed, ensure loading is off
        }
    } else if (isLoaded && process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
        setIsLoading(false); // Not signed in, stop loading
    }
    
    return () => { isMounted = false; };
  }, [userId, sharedBoardIdFromUrl, getToken, BOARDS_API_BASE_URL, isLoaded, isSignedIn, router, createNewBoard, selectBoard, searchParams, currentRoom]);
  // Added searchParams and currentRoom to main useEffect deps


  const renameBoard = useCallback(async (boardId: string, newName: string) => {
    // ... (Implementation from the previous correct version, using availableRooms state or ref) ...
    const effectiveUserId = (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && userId) ? userId : "anonymous-user";
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
        setError("Cannot rename board: User not signed in."); return;
    }
    if (!effectiveUserId) { setError("Cannot rename board: User ID is missing."); return; }
    if (!newName.trim()) return;

    const trimmedName = newName.trim();
    // Use state directly here as availableRooms is a dependency
    const originalRoomIndex = availableRooms.findIndex((r: RoomData) => r.id === boardId);
    if (originalRoomIndex === -1) {
        setError("Cannot rename: board not found locally."); return;
    }
    const originalRoom = { ...availableRooms[originalRoomIndex] };

    setAvailableRooms(prevRooms => prevRooms.map((room: RoomData) => room.id === boardId ? { ...room, name: trimmedName } : room));
    if (currentRoom?.id === boardId) setCurrentRoom(prev => prev ? { ...prev, name: trimmedName } : null);
    setError(null);

    try {
        let token: string | null = null;
        if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) {
            token = await getToken(); if (!token) throw new Error('Auth token failed for renaming.');
        }
        const headers: HeadersInit = { 'Content-Type': 'application/json' }; if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`${BOARDS_API_BASE_URL}/api/boards/${boardId}`, { method: 'PUT', headers, body: JSON.stringify({ name: trimmedName }) });
        if (!response.ok) {
            setAvailableRooms(prevRooms => { const rooms = [...prevRooms]; rooms[originalRoomIndex] = originalRoom; return rooms; });
            if (currentRoom?.id === boardId) setCurrentRoom(originalRoom);
            const errTxt = await response.text(); throw new Error(`Rename failed: ${response.status} - ${errTxt}`);
        }
        const updatedBoardFromServer: RoomData = await response.json();
        setAvailableRooms(prevRooms => prevRooms.map((room: RoomData) => room.id === boardId ? updatedBoardFromServer : room));
        if (currentRoom?.id === boardId) setCurrentRoom(updatedBoardFromServer);
    } catch (err: any) { setError(err.message || 'Failed to rename.'); 
        setAvailableRooms(prevRooms => { const rooms = [...prevRooms]; rooms[originalRoomIndex] = originalRoom; return rooms; });
        if (currentRoom?.id === boardId) setCurrentRoom(originalRoom);
    }
  }, [userId, currentRoom, getToken, BOARDS_API_BASE_URL, isSignedIn, availableRooms]); // Added availableRooms

  const ensureBoardIsShareable = useCallback((boardId: string): string | null => {
    const room = availableRooms.find((r: RoomData) => r.id === boardId); // Use state
    if (!room) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/?board=${room.id}`;
  }, [userId, availableRooms]); // Added availableRooms

  // `isCreatingDefaultBoard` for the return value.
  const isProcessingInitial = isLoading || isAutoCreatingBoardRef.current;

  return {
    isLoading: isProcessingInitial, 
    error,
    currentRoom,
    availableRooms,
    selectBoard, // This is now stable due to useCallback and careful deps
    createNewBoard,
    renameBoard,
    ensureBoardIsShareable,
    getDefaultBoardId: userId ? () => getDefaultBoardId(userId) : () => getDefaultBoardId("anonymous-user"),
  };
}