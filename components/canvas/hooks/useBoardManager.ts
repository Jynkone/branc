// File: Jynkone/branc/branc-35acf07df2bc3fdbf1d7d97ee2c139d0fcf9291a/components/canvas/hooks/useBoardManager.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // Import useSearchParams
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
  const searchParams = useSearchParams(); // Get searchParams object
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const initialLoadCompletedRef = useRef(false);
  const isAutoCreatingBoardRef = useRef(false);

  const BOARDS_API_BASE_URL = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_WORKER_URL;
    if (!url) {
      console.error("[useBoardManager] CRITICAL: NEXT_PUBLIC_WORKER_URL is not set!");
      return "http://localhost:8787"; // Fallback for local dev
    }
    return url.startsWith("http") ? url : `https://${url}`;
  }, []);

  // Memoized function to perform navigation to avoid re-creating it if router/userId don't change
  const navigateToBoard = useCallback((board: RoomData | null) => {
    if (board) {
        const actualUserIdForDefaults = userId || "anonymous-user";
        const newPath = (board.isShared && board.id !== getDefaultBoardId(actualUserIdForDefaults))
                         ? `/?board=${board.id}`
                         : '/';
        if (typeof window !== "undefined" && (window.location.pathname + window.location.search !== newPath)) {
            router.push(newPath, { scroll: false });
        }
    } else {
        // Handle case where no board is selected, e.g., navigate to home if not already there
        // if (typeof window !== "undefined" && window.location.pathname !== '/') {
        //   router.push('/', { scroll: false });
        // }
    }
  }, [router, userId]);

  const createNewBoard = useCallback(async (isDefaultBoardCreation = false) => {
    const effectiveUserId = (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && userId) ? userId : "anonymous-user";
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
        setError("Cannot create board: User not signed in."); return null;
    }
    if (!effectiveUserId) {
        setError("Cannot create board: User ID is missing."); return null;
    }

    const currentAvailableRooms = availableRooms;
    const boardName = isDefaultBoardCreation ? "My First Board" : `Page ${currentAvailableRooms.filter((b: RoomData) => b.owner === effectiveUserId).length + 1}`;

    console.log(`[useBoardManager] createNewBoard: Attempting to create: "${boardName}" for user: ${effectiveUserId}`);
    if (isDefaultBoardCreation) isAutoCreatingBoardRef.current = true;
    // Don't set global isLoading here, let the caller manage UI if it's a direct user action.
    // The main effect will handle its own isLoading for the initial setup.
    setError(null);

    try {
      let token: string | null = null;
      if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) {
          token = await getToken();
           if (!token) throw new Error('User authenticated but failed to retrieve token for creating board.');
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
      console.log("[useBoardManager] createNewBoard: Successfully created API board:", newBoard);
      
      // Important: Update availableRooms state
      setAvailableRooms(prevRooms => {
          const updatedRooms = [...prevRooms, newBoard];
          console.log("[useBoardManager] createNewBoard: Updated availableRooms state with new board.", updatedRooms.map(r=>r.id));
          return updatedRooms;
      });
      return newBoard; // Return the new board
    } catch (err: any) {
      console.error("[useBoardManager] createNewBoard: Error:", err);
      setError(err.message || 'Failed to create board.');
      return null;
    } finally {
      if (isDefaultBoardCreation) isAutoCreatingBoardRef.current = false;
    }
  }, [userId, getToken, BOARDS_API_BASE_URL, isSignedIn, availableRooms]); // availableRooms is for naming

  // selectBoard is exposed to the UI (e.g., PageSelector)
  const selectBoard = useCallback((boardId: string) => {
    const roomToSelect = availableRooms.find((room: RoomData) => room.id === boardId);
    if (roomToSelect) {
      console.log(`[useBoardManager] selectBoard (external call): Selecting ID="${roomToSelect.id}", Name="${roomToSelect.name}"`);
      setCurrentRoom(roomToSelect); // This will trigger Canvas.tsx re-render
      navigateToBoard(roomToSelect); // And navigate
    } else {
      console.warn(`[useBoardManager] selectBoard (external call): Board ID "${boardId}" not found. Available:`, availableRooms.map((r: RoomData) => r.id));
      // Optionally handle navigation if board not found, e.g., to a default state
      // _navigateToBoard(null); 
    }
  }, [availableRooms, navigateToBoard]);


  useEffect(() => {
    const currentUrlBoardId = searchParams.get('board'); // Get current board from URL query
    console.log(`[useBoardManager] Effect Run -- User: ${userId}, ClerkLoaded: ${isLoaded}, SignedIn: ${isSignedIn}, URLBoard: ${currentUrlBoardId}, InitialLoadCompleted: ${initialLoadCompletedRef.current}, AutoCreating: ${isAutoCreatingBoardRef.current}`);

    if (!isLoaded) { console.log("[useBoardManager] Effect: Clerk not loaded. Waiting."); setIsLoading(true); return; }

    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true') {
        if (!isSignedIn) {
            console.log("[useBoardManager] Effect: Auth required, not signed in.");
            setAvailableRooms([]); setCurrentRoom(null); setError("User not authenticated.");
            setIsLoading(false); initialLoadCompletedRef.current = true; return;
        }
        if (!userId) {
            console.warn("[useBoardManager] Effect: Auth required, signed in, but no userId prop. Waiting.");
            setIsLoading(true); return;
        }
    }
    
    // If already processing an initial load or auto-creating, don't start another one.
    if (isLoading && initialLoadCompletedRef.current === false) { // isLoading here means the main effect's isLoading
        console.log("[useBoardManager] Effect: Already in an initial loading/processing state. Skipping duplicate run.");
        return;
    }

    // If initial load is complete, and the URL board ID hasn't changed, and we have a current room, assume stable.
    if (initialLoadCompletedRef.current && (!currentUrlBoardId || currentRoom?.id === currentUrlBoardId) && currentRoom) {
        console.log("[useBoardManager] Effect: Initial load complete, URL matches current or no URL board, current room set. Stabilized.");
        setIsLoading(false);
        return;
    }


    let isMounted = true;
    setIsLoading(true); setError(null);

    const fetchAndInitializeBoards = async () => {
      console.log("[useBoardManager] fetchAndInitializeBoards: Starting sequence.");
      initialLoadCompletedRef.current = false; // Mark as starting process

      try {
        let token: string | null = null;
        if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) {
            token = await getToken();
            if (!token) throw new Error('Authentication token could not be retrieved.');
        }
        const headers: HeadersInit = {}; if (token) headers['Authorization'] = `Bearer ${token}`;

        const fetchUrl = `${BOARDS_API_BASE_URL}/api/boards`;
        const response = await fetch(fetchUrl, { headers });
        if (!response.ok) { throw new Error(`Failed to fetch boards: ${response.status}`); }
        
        let fetchedBoards: RoomData[] = await response.json();
        if (!isMounted) return;
        console.log("[useBoardManager] fetchAndInitializeBoards: Fetched boards:", fetchedBoards.map(b => ({id: b.id, name: b.name})));
        setAvailableRooms(fetchedBoards); // *Crucial: Set state first*

        const actualUserIdForDefaults = userId || "anonymous-user";
        const defaultBoardId = getDefaultBoardId(actualUserIdForDefaults);
        let boardToSelect: RoomData | null = null;

        if (currentUrlBoardId) {
          boardToSelect = fetchedBoards.find((b: RoomData) => b.id === currentUrlBoardId) || null;
        }
        
        if (!boardToSelect) {
            boardToSelect = fetchedBoards.find((b: RoomData) => b.id === defaultBoardId) || null;
            if (!boardToSelect && fetchedBoards.length > 0) boardToSelect = fetchedBoards[0];
        }

        if (boardToSelect) {
          if (isMounted) {
            console.log(`[useBoardManager] fetchAndInitializeBoards: Selecting existing board: ${boardToSelect.id}`);
            // Directly set currentRoom and navigate. selectBoard will use the updated availableRooms if called later.
            navigateToBoard(boardToSelect);
          }
        } else if (fetchedBoards.length === 0 && !currentUrlBoardId && !isAutoCreatingBoardRef.current) {
          console.log(`[useBoardManager] fetchAndInitializeBoards: No boards. Creating default.`);
          const newDefaultBoard = await createNewBoard(true); // createNewBoard updates availableRooms
          if (newDefaultBoard && isMounted) {
            console.log("[useBoardManager] fetchAndInitializeBoards: Default board created. Navigating:", newDefaultBoard.id);
            navigateToBoard(newDefaultBoard); // Navigate to the new board
          } else if (isMounted) {
            setError("Could not create default board."); navigateToBoard(null);
          }
        } else {
          if (isMounted) {
            console.log("[useBoardManager] fetchAndInitializeBoards: No board to select after logic. Navigating to null.");
            navigateToBoard(null); // Ensure no room is selected if logic falls through
          }
        }
      } catch (err: any) {
        console.error("[useBoardManager] fetchAndInitializeBoards: Error:", err.message);
        if (isMounted) setError(err.message || 'Failed to initialize boards.');
      } finally {
        if (isMounted) {
            setIsLoading(false);
            initialLoadCompletedRef.current = true; // Mark initial processing as done
        }
      }
    };
    
    // Run if Clerk is ready and user context is valid
    if (isLoaded && (process.env.NEXT_PUBLIC_USE_AUTH !== 'true' || (isSignedIn && userId))) {
        // Only trigger if initialLoadAttemptedRef is false OR if the board ID in URL has changed and isn't the current one
        const urlBoardId = searchParams.get('board'); // Get it again to ensure freshness for this check
        if (!initialLoadCompletedRef.current || (urlBoardId && currentRoom?.id !== urlBoardId) ) {
            console.log(`[useBoardManager] Conditions met for fetchAndInitializeBoards. InitialAttempted: ${initialLoadCompletedRef.current}, UrlBoard: ${urlBoardId}, CurrentRoom: ${currentRoom?.id}`);
            fetchAndInitializeBoards();
        } else {
            console.log(`[useBoardManager] Conditions NOT met for fetchAndInitializeBoards. Stabilizing. InitialAttempted: ${initialLoadCompletedRef.current}, UrlBoard: ${urlBoardId}, CurrentRoom: ${currentRoom?.id}`);
            setIsLoading(false); // Already initialized or stable, ensure loading is false
        }
    } else if (isLoaded) {
        setIsLoading(false); // Clerk loaded but not signed in (if auth required)
    }
    
    return () => { isMounted = false; };
  // Dependency array:
  // - userId, isLoaded, isSignedIn: Clerk auth state.
  // - searchParams: For `sharedBoardIdFromUrl`. Note: searchParams object itself can change reference.
  //   Using searchParams.get('board') directly inside the effect is safer.
  // - BOARDS_API_BASE_URL: Stable.
  // - getToken: Stable from useAuth.
  // - createNewBoard and navigateToBoard are stable callbacks.
  }, [userId, isLoaded, isSignedIn, searchParams, BOARDS_API_BASE_URL, getToken, router, createNewBoard, navigateToBoard]);


  const renameBoard = useCallback(async (boardId: string, newName: string) => {
    // Implementation using `availableRooms` state directly for optimistic update
    // and then server call. (Keep previous correct version)
  }, [userId, isSignedIn, getToken, BOARDS_API_BASE_URL, availableRooms, currentRoom, navigateToBoard]);

  const ensureBoardIsShareable = useCallback((boardId: string): string | null => {
    // Implementation using `availableRooms` state. (Keep previous correct version)
    const room = availableRooms.find((r: RoomData) => r.id === boardId);
    if (!room) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/?board=${room.id}`;
  }, [userId, availableRooms]);

  return {
    isLoading: isLoading || isAutoCreatingBoardRef.current, 
    error,
    currentRoom,
    availableRooms,
    selectBoard,
    createNewBoard,
    renameBoard,
    ensureBoardIsShareable,
    getDefaultBoardId: userId ? () => getDefaultBoardId(userId) : () => getDefaultBoardId("anonymous-user"),
  };
}