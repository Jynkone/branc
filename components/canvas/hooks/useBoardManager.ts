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
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  
  const initialLoadCompletedRef = useRef(false);
  const isAutoCreatingBoardRef = useRef(false);
  const isFetchingBoardsRef = useRef(false); // New ref to track active fetching

  const BOARDS_API_BASE_URL = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_WORKER_URL;
    if (!url) {
      console.error("[useBoardManager] CRITICAL: NEXT_PUBLIC_WORKER_URL is not set!");
      return "http://localhost:8787"; // Fallback for local dev
    }
    return url.startsWith("http") ? url : `https://${url}`;
  }, []);

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
        // If navigating to null (no board), go to root if not already there.
        // This handles cases where a board becomes inaccessible or during initial setup before a board is chosen.
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

    // Use a local copy of availableRooms for naming to avoid stale closures if createNewBoard
    // is called multiple times before state updates propagate.
    const currentSnapshotOfAvailableRooms = availableRooms;
    const boardName = isDefaultBoardCreation ? "My First Board" : `Page ${currentSnapshotOfAvailableRooms.filter((b: RoomData) => b.owner === effectiveUserId).length + 1}`;

    console.log(`[useBoardManager] createNewBoard: Attempting to create: "${boardName}" for user: ${effectiveUserId}`);
    if (isDefaultBoardCreation) isAutoCreatingBoardRef.current = true;
    setError(null);

    try {
      let token: string | null = null;
      if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) { // Re-check isSignedIn and userId
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
      
      setAvailableRooms(prevRooms => {
          const updatedRooms = [...prevRooms, newBoard];
          console.log("[useBoardManager] createNewBoard: Updated availableRooms state with new board.", updatedRooms.map(r=>r.id));
          return updatedRooms;
      });
      return newBoard;
    } catch (err: any) {
      console.error("[useBoardManager] createNewBoard: Error:", err);
      setError(err.message || 'Failed to create board.');
      return null;
    } finally {
      if (isDefaultBoardCreation) isAutoCreatingBoardRef.current = false;
    }
  }, [userId, getToken, BOARDS_API_BASE_URL, isSignedIn, availableRooms]); // availableRooms is for naming consistency for user-created boards

  const selectBoard = useCallback((boardId: string) => {
    const roomToSelect = availableRooms.find((room: RoomData) => room.id === boardId);
    if (roomToSelect) {
      console.log(`[useBoardManager] selectBoard: Selecting ID="${roomToSelect.id}", Name="${roomToSelect.name}"`);
      setCurrentRoom(roomToSelect);
      navigateToBoard(roomToSelect);
    } else {
      console.warn(`[useBoardManager] selectBoard: Board ID "${boardId}" not found. Available:`, availableRooms.map((r: RoomData) => r.id));
      // setCurrentRoom(null); // Clear current room if board not found
      // navigateToBoard(null);
    }
  }, [availableRooms, navigateToBoard, setCurrentRoom]);


  useEffect(() => {
    const currentUrlBoardId = searchParams.get('board');
    console.log(`[useBoardManager] Effect Run -- User: ${userId}, ClerkLoaded: ${isLoaded}, SignedIn: ${isSignedIn}, URLBoard: ${currentUrlBoardId}, InitialLoadCompleted: ${initialLoadCompletedRef.current}, isFetchingBoards: ${isFetchingBoardsRef.current}, isAutoCreating: ${isAutoCreatingBoardRef.current}`);

    if (!isLoaded) {
        console.log("[useBoardManager] Effect: Clerk not loaded. Waiting.");
        setIsLoading(true);
        return;
    }

    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true') {
        if (!isSignedIn) {
            console.log("[useBoardManager] Effect: Auth required, user not signed in.");
            setAvailableRooms([]); setCurrentRoom(null); setError("User not authenticated.");
            setIsLoading(false); initialLoadCompletedRef.current = true; return;
        }
        if (!userId) {
            console.warn("[useBoardManager] Effect: Auth required, but userId is null. Waiting for userId prop.");
            setIsLoading(true); return;
        }
    }

    const fetchAndInitializeBoards = async () => {
        if (isFetchingBoardsRef.current) { // Primary guard against re-entrancy
            console.log("[useBoardManager] fetchAndInitializeBoards: Call skipped, already in progress.");
            return;
        }
        isFetchingBoardsRef.current = true;
        initialLoadCompletedRef.current = false; // Reset for this attempt
        setIsLoading(true);
        setError(null);
        console.log("[useBoardManager] fetchAndInitializeBoards: Starting sequence.");
        
        let isMountedInAsync = true;

        try {
            let token: string | null = null;
            if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) {
                token = await getToken();
                if (!token) throw new Error('Authentication token could not be retrieved.');
            }
            const headers: HeadersInit = {}; if (token) headers['Authorization'] = `Bearer ${token}`;

            const fetchUrl = `${BOARDS_API_BASE_URL}/api/boards`;
            const response = await fetch(fetchUrl, { headers });
            if (!response.ok) { 
              const errorText = await response.text();
              throw new Error(`Failed to fetch boards: ${response.status} - ${errorText}`); 
            }
            
            let fetchedBoards: RoomData[] = await response.json();
            if (!isMountedInAsync) { isFetchingBoardsRef.current = false; return; }
            console.log("[useBoardManager] fetchAndInitializeBoards: Fetched boards:", fetchedBoards.map(b => ({id: b.id, name: b.name})));
            setAvailableRooms(fetchedBoards);

            const actualUserIdForDefaults = userId || "anonymous-user";
            const defaultBoardId = getDefaultBoardId(actualUserIdForDefaults);
            let boardToSet: RoomData | null = null;
            const urlBoardIdFromParams = searchParams.get('board'); // Re-fetch inside async to ensure it's current

            if (urlBoardIdFromParams) {
                boardToSet = fetchedBoards.find((b: RoomData) => b.id === urlBoardIdFromParams) || null;
            }
            
            if (!boardToSet) {
                boardToSet = fetchedBoards.find((b: RoomData) => b.id === defaultBoardId) || null;
                if (!boardToSet && fetchedBoards.length > 0) boardToSet = fetchedBoards[0];
            }

            if (boardToSet) {
                if (isMountedInAsync) {
                    console.log(`[useBoardManager] fetchAndInitializeBoards: Selecting existing board: ${boardToSet.id}`);
                    setCurrentRoom(boardToSet);
                    navigateToBoard(boardToSet);
                }
            } else if (fetchedBoards.length === 0 && !urlBoardIdFromParams && !isAutoCreatingBoardRef.current) {
                console.log(`[useBoardManager] fetchAndInitializeBoards: No boards. Creating default.`);
                isAutoCreatingBoardRef.current = true;
                const newDefaultBoard = await createNewBoard(true); // This also updates availableRooms
                isAutoCreatingBoardRef.current = false;
                if (newDefaultBoard && isMountedInAsync) {
                    console.log("[useBoardManager] fetchAndInitializeBoards: Default board created. Setting and Navigating:", newDefaultBoard.id);
                    setCurrentRoom(newDefaultBoard);
                    navigateToBoard(newDefaultBoard);
                } else if (isMountedInAsync) {
                    setError("Could not create default board.");
                    setCurrentRoom(null); navigateToBoard(null);
                }
            } else {
                 if (isMountedInAsync) {
                    console.log("[useBoardManager] fetchAndInitializeBoards: No specific board to select or already handled. Current room:", currentRoom?.id);
                    // If currentRoom is set but doesn't match the URL (and URL is present), prioritize URL
                    if (urlBoardIdFromParams && currentRoom?.id !== urlBoardIdFromParams) {
                        // This case should ideally be handled by the boardToSet logic above.
                        // If boardToSet was null due to invalid URL, then we might need to clear currentRoom
                        // or navigate to a default.
                        console.warn(`[useBoardManager] Mismatch between URL board (${urlBoardIdFromParams}) and current room (${currentRoom?.id}). Re-evaluating.`);
                        // This might indicate a need to reset currentRoom if the URL board was invalid.
                        // The logic above should have found a valid boardToSet if fetchedBoards contained it or a default.
                        // If boardToSet is null, it implies no valid board from URL and no fallback.
                        if (!boardToSet) {
                           setCurrentRoom(null);
                           navigateToBoard(null);
                        }
                    } else if (!currentRoom && fetchedBoards.length > 0) {
                        // If no currentRoom is set, but we have boards, select the first one as a last resort.
                        // This typically shouldn't be hit if default logic is correct.
                        console.warn("[useBoardManager] No current room, but boards available. Selecting first available.");
                        setCurrentRoom(fetchedBoards[0]);
                        navigateToBoard(fetchedBoards[0]);
                    }
                 }
            }
        } catch (err: any) {
            console.error("[useBoardManager] fetchAndInitializeBoards: Error:", err);
            if (isMountedInAsync) setError(err.message || 'Failed to initialize boards.');
        } finally {
            if (isMountedInAsync) {
                initialLoadCompletedRef.current = true;
            }
            isFetchingBoardsRef.current = false;
            // setIsLoading(false) will be handled by the outer effect logic after this async op completes
        }
    };

    const shouldFetch = !initialLoadCompletedRef.current || (currentUrlBoardId && currentRoom?.id !== currentUrlBoardId);

    if (isLoaded && (process.env.NEXT_PUBLIC_USE_AUTH !== 'true' || (isSignedIn && userId))) {
        if (shouldFetch) {
            if (!isFetchingBoardsRef.current) { // Ensure not already fetching
                fetchAndInitializeBoards().finally(() => {
                    // This ensures isLoading is false only after the async operation has truly finished
                    // and isFetchingBoardsRef is also false.
                    if (!isFetchingBoardsRef.current && isMountedInAsyncCleanup.current) {
                         setIsLoading(false);
                    }
                });
            } else {
                 console.log("[useBoardManager] Effect: Fetch is needed, but an existing fetch operation is already in progress.");
                 // If already fetching, isLoading should remain true.
                 if(!isLoading) setIsLoading(true);
            }
        } else {
            // If no fetch is needed because conditions are met (e.g., initial load complete and URL matches current room)
            setIsLoading(false);
        }
    }
    // If Clerk is not loaded, or auth conditions aren't met (and auth is required),
    // isLoading and other states are handled by the return statements at the top of the useEffect.

    const isMountedInAsyncCleanup = useRef(true); // Ref for cleanup
    return () => {
      isMountedInAsyncCleanup.current = false;
      // console.log("[useBoardManager] Effect cleanup. isFetchingBoardsRef:", isFetchingBoardsRef.current);
      // Do not reset isFetchingBoardsRef here as the async function might still be running its finally block.
    };
  }, [
    userId, isLoaded, isSignedIn, searchParams, currentRoom, // Added currentRoom to re-evaluate if URL board ID differs
    getToken, createNewBoard, navigateToBoard, selectBoard, // Callbacks
    BOARDS_API_BASE_URL // Stable value
  ]);


  const renameBoard = useCallback(async (boardId: string, newName: string) => {
    const originalRooms = availableRooms;
    const roomToRename = originalRooms.find(r => r.id === boardId);
    if (!roomToRename || roomToRename.name === newName.trim()) {
        if (!roomToRename) console.warn(`[useBoardManager] renameBoard: Board ID "${boardId}" not found for renaming.`);
        return; // No change needed or board not found
    }

    // Optimistic UI update
    const updatedOptimisticRooms = originalRooms.map(r =>
        r.id === boardId ? { ...r, name: newName.trim() } : r
    );
    setAvailableRooms(updatedOptimisticRooms);
    if (currentRoom && currentRoom.id === boardId) {
        setCurrentRoom(prev => prev ? { ...prev, name: newName.trim() } : null);
    }

    try {
        let token: string | null = null;
        if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && isSignedIn && userId) {
            token = await getToken();
            if (!token) throw new Error('Authentication token could not be retrieved for renaming.');
        }
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${BOARDS_API_BASE_URL}/api/boards/${boardId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ name: newName.trim() }),
        });

        if (!response.ok) {
            const errorBodyText = await response.text();
            let errorDetail = errorBodyText; try { const errorJson = JSON.parse(errorBodyText); errorDetail = errorJson.error || errorJson.message || errorBodyText; } catch (e) {}
            throw new Error(`Failed to rename board: ${response.status} - ${errorDetail}`);
        }
        const updatedBoardFromServer: RoomData = await response.json();
        
        // Re-sync with server state
        setAvailableRooms(prevRooms => prevRooms.map(r => r.id === boardId ? updatedBoardFromServer : r));
        if (currentRoom && currentRoom.id === boardId) {
            setCurrentRoom(updatedBoardFromServer);
        }
        console.log(`[useBoardManager] renameBoard: Successfully renamed board ID "${boardId}" to "${updatedBoardFromServer.name}"`);

    } catch (err: any) {
        console.error("[useBoardManager] renameBoard: Error:", err);
        setError(err.message || 'Failed to rename board.');
        // Revert optimistic update on error
        setAvailableRooms(originalRooms);
        if (currentRoom && currentRoom.id === boardId && roomToRename) { // Check roomToRename to ensure it existed
            setCurrentRoom(roomToRename);
        }
    }
  }, [userId, isSignedIn, getToken, BOARDS_API_BASE_URL, availableRooms, currentRoom, navigateToBoard, setAvailableRooms, setCurrentRoom]);

  const ensureBoardIsShareable = useCallback((boardId: string): string | null => {
    const room = availableRooms.find((r: RoomData) => r.id === boardId);
    if (!room) {
        console.warn(`[useBoardManager] ensureBoardIsShareable: Board ID "${boardId}" not found.`);
        return null;
    }
    // Forcing shareable link format
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareableLink = `${origin}/?board=${room.id}`;
    
    if (!room.isShared) {
      // Here, you might want to update the board's `isShared` status on the backend
      // For now, we'll assume the link generation itself makes it implicitly shareable by URL
      console.log(`[useBoardManager] ensureBoardIsShareable: Board ID "${boardId}" is not explicitly shared but generating shareable link: ${shareableLink}`);
    }
    return shareableLink;
  }, [availableRooms]);


  // isLoading now also considers if a fetch is actively in progress via isFetchingBoardsRef
  return {
    isLoading: isLoading || isFetchingBoardsRef.current || isAutoCreatingBoardRef.current, 
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