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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const initialLoadCompletedRef = useRef(false);
  const isAutoCreatingBoardRef = useRef(false);
  const isFetchingBoardsRef = useRef(false);
  const isMountedRef = useRef(true); // To track component mount status for async operations

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const BOARDS_API_BASE_URL = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_WORKER_URL;
    if (!url) {
      console.error("[useBoardManager] CRITICAL: NEXT_PUBLIC_WORKER_URL is not set!");
      return "http://localhost:8787"; 
    }
    return url.startsWith("http") ? url : `https://${url}`;
  }, []);

  const navigateToBoard = useCallback((board: RoomData | null) => {
    if (!isMountedRef.current) return;
    const currentPath = window.location.pathname + window.location.search;
    let newPath = '/';

    if (board) {
        const actualUserIdForDefaults = userId || "anonymous-user";
        newPath = (board.isShared && board.id !== getDefaultBoardId(actualUserIdForDefaults))
                       ? `/?board=${board.id}`
                       : '/';
    }
    
    if (currentPath !== newPath) {
        router.push(newPath, { scroll: false });
    }
  }, [router, userId]);

  const createNewBoard = useCallback(async (isDefaultBoardCreation = false) => {
    if (!isMountedRef.current) return null;
    const effectiveUserId = (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && userId) ? userId : "anonymous-user";
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
        if (isMountedRef.current) setError("Cannot create board: User not signed in."); 
        return null;
    }
    if (!effectiveUserId) {
        if (isMountedRef.current) setError("Cannot create board: User ID is missing."); 
        return null;
    }

    const currentSnapshotOfAvailableRooms = availableRooms; // Use current state for naming
    const boardName = isDefaultBoardCreation ? "My First Board" : `Page ${currentSnapshotOfAvailableRooms.filter((b: RoomData) => b.owner === effectiveUserId).length + 1}`;

    console.log(`[useBoardManager] createNewBoard: Attempting to create: "${boardName}" for user: ${effectiveUserId}`);
    if (isDefaultBoardCreation) isAutoCreatingBoardRef.current = true;
    if (isMountedRef.current) setError(null);

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
      
      if (isMountedRef.current) {
        setAvailableRooms(prevRooms => [...prevRooms, newBoard]);
      }
      return newBoard;
    } catch (err: any) {
      console.error("[useBoardManager] createNewBoard: Error:", err);
      if (isMountedRef.current) setError(err.message || 'Failed to create board.');
      return null;
    } finally {
      if (isDefaultBoardCreation) isAutoCreatingBoardRef.current = false;
    }
  }, [userId, getToken, BOARDS_API_BASE_URL, isSignedIn, availableRooms, setAvailableRooms, setError]);

  const selectBoard = useCallback((boardId: string) => {
    if (!isMountedRef.current) return;
    const roomToSelect = availableRooms.find((room: RoomData) => room.id === boardId);
    if (roomToSelect) {
      console.log(`[useBoardManager] selectBoard: Selecting ID="${roomToSelect.id}", Name="${roomToSelect.name}"`);
      setCurrentRoom(roomToSelect);
      navigateToBoard(roomToSelect);
    } else {
      console.warn(`[useBoardManager] selectBoard: Board ID "${boardId}" not found.`);
    }
  }, [availableRooms, navigateToBoard, setCurrentRoom]);


  useEffect(() => {
    const currentUrlBoardId = searchParams.get('board');
    console.log(`[useBoardManager] Effect Run -- User: ${userId}, ClerkLoaded: ${isLoaded}, SignedIn: ${isSignedIn}, URLBoard: ${currentUrlBoardId}, InitialLoadCompleted: ${initialLoadCompletedRef.current}, IsFetching: ${isFetchingBoardsRef.current}`);

    if (!isLoaded) {
      console.log("[useBoardManager] Effect: Clerk not loaded. Waiting.");
      if (isMountedRef.current) setIsLoading(true);
      return;
    }

    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true') {
      if (!isSignedIn) {
        console.log("[useBoardManager] Effect: Auth required, user not signed in.");
        if (isMountedRef.current) {
          setAvailableRooms([]); setCurrentRoom(null); setError("User not authenticated.");
          setIsLoading(false);
        }
        initialLoadCompletedRef.current = true;
        return;
      }
      if (!userId) {
        console.warn("[useBoardManager] Effect: Auth required, but userId is null. Waiting for userId prop.");
        if (isMountedRef.current) setIsLoading(true);
        return;
      }
    }

    const fetchAndInitializeBoards = async () => {
      if (isFetchingBoardsRef.current) {
        console.log("[useBoardManager] fetchAndInitializeBoards: Call skipped, already in progress.");
        return;
      }
      isFetchingBoardsRef.current = true;
      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
      }
      console.log("[useBoardManager] fetchAndInitializeBoards: Starting data fetch and initialization.");

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
        if (!isMountedRef.current) return;
        
        console.log("[useBoardManager] fetchAndInitializeBoards: Fetched boards:", fetchedBoards.map(b => ({id: b.id, name: b.name})));
        setAvailableRooms(fetchedBoards);

        const actualUserIdForDefaults = userId || "anonymous-user";
        const defaultBoardId = getDefaultBoardId(actualUserIdForDefaults);
        let boardToSet: RoomData | null = null;
        const urlBoardIdFromParamsInAsync = searchParams.get('board'); // Get fresh value

        if (urlBoardIdFromParamsInAsync) {
          boardToSet = fetchedBoards.find((b: RoomData) => b.id === urlBoardIdFromParamsInAsync) || null;
        }
        
        if (!boardToSet) {
          boardToSet = fetchedBoards.find((b: RoomData) => b.id === defaultBoardId) || null;
          if (!boardToSet && fetchedBoards.length > 0) boardToSet = fetchedBoards[0];
        }

        if (boardToSet) {
          if (isMountedRef.current) {
            setCurrentRoom(boardToSet);
            navigateToBoard(boardToSet);
          }
        } else if (fetchedBoards.length === 0 && !urlBoardIdFromParamsInAsync) {
          isAutoCreatingBoardRef.current = true;
          const newDefaultBoard = await createNewBoard(true);
          isAutoCreatingBoardRef.current = false;
          if (newDefaultBoard && isMountedRef.current) {
            setCurrentRoom(newDefaultBoard);
            navigateToBoard(newDefaultBoard);
          } else if (isMountedRef.current) {
            setError("Could not create default board.");
            setCurrentRoom(null); navigateToBoard(null);
          }
        } else if (isMountedRef.current) {
            // If URL specified a board but it wasn't found, or no boards at all.
            setCurrentRoom(null);
            navigateToBoard(null); // Navigate to root or clear board param
        }
      } catch (err: any) {
        console.error("[useBoardManager] fetchAndInitializeBoards: Error:", err);
        if (isMountedRef.current) setError(err.message || 'Failed to initialize boards.');
      } finally {
        isFetchingBoardsRef.current = false;
        if (isMountedRef.current) {
          initialLoadCompletedRef.current = true;
          setIsLoading(false); // Set loading false after all operations
        }
      }
    };

    // Determine if a fetch operation is needed
    // Fetch if:
    // 1. Initial load hasn't completed yet.
    // OR
    // 2. A board ID is present in the URL, AND
    //    a. There's no current room selected yet, OR
    //    b. The current room's ID does not match the URL's board ID.
    const needsToFetch = !initialLoadCompletedRef.current || 
                         (currentUrlBoardId && (!currentRoom || currentRoom.id !== currentUrlBoardId));

    if (needsToFetch) {
      if (!isFetchingBoardsRef.current) {
        fetchAndInitializeBoards();
      } else {
        console.log("[useBoardManager] Effect: Fetch needed, but already in progress.");
      }
    } else {
      // If no fetch needed (already loaded and URL/currentRoom are in sync or no specific board in URL)
      if (isMountedRef.current) setIsLoading(false);
    }

  }, [
    userId, isLoaded, isSignedIn, searchParams, /* currentRoom removed */
    getToken, createNewBoard, navigateToBoard, // Callbacks
    BOARDS_API_BASE_URL, selectBoard // selectBoard was added back by user, check if really needed here. If not called by effect, remove.
                                    // `selectBoard` is not called by this effect, so it can be removed.
                                    // `createNewBoard` and `MapsToBoard` are called within `WorkspaceAndInitializeBoards`
                                    // and will use their latest versions from the hook's scope.
                                    // Their inclusion here is if their change of definition itself should re-run the effect.
                                    // Given `isFetchingBoardsRef`, this is less critical.
  ]);

  const renameBoard = useCallback(async (boardId: string, newName: string) => {
    if (!isMountedRef.current) return;
    const originalRooms = [...availableRooms]; // Create a shallow copy for potential revert
    const roomToRename = originalRooms.find(r => r.id === boardId);

    if (!roomToRename || roomToRename.name === newName.trim()) {
        if (!roomToRename) console.warn(`[useBoardManager] renameBoard: Board ID "${boardId}" not found.`);
        return; 
    }

    const newNameTrimmed = newName.trim();
    setAvailableRooms(prevRooms => prevRooms.map(r =>
        r.id === boardId ? { ...r, name: newNameTrimmed } : r
    ));
    if (currentRoom && currentRoom.id === boardId) {
        setCurrentRoom(prev => prev ? { ...prev, name: newNameTrimmed } : null);
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
            body: JSON.stringify({ name: newNameTrimmed }),
        });

        if (!response.ok) {
            const errorBodyText = await response.text();
            let errorDetail = errorBodyText; try { const errorJson = JSON.parse(errorBodyText); errorDetail = errorJson.error || errorJson.message || errorBodyText; } catch (e) {}
            throw new Error(`Failed to rename board: ${response.status} - ${errorDetail}`);
        }
        const updatedBoardFromServer: RoomData = await response.json();
        
        if (isMountedRef.current) {
            setAvailableRooms(prevRooms => prevRooms.map(r => r.id === boardId ? updatedBoardFromServer : r));
            if (currentRoom && currentRoom.id === boardId) {
                setCurrentRoom(updatedBoardFromServer);
            }
        }
        console.log(`[useBoardManager] renameBoard: Successfully renamed board ID "${boardId}" to "${updatedBoardFromServer.name}"`);

    } catch (err: any) {
        console.error("[useBoardManager] renameBoard: Error:", err);
        if (isMountedRef.current) {
            setError(err.message || 'Failed to rename board.');
            setAvailableRooms(originalRooms); // Revert optimistic update
            if (currentRoom && currentRoom.id === boardId && roomToRename) {
                setCurrentRoom(roomToRename);
            }
        }
    }
  }, [userId, isSignedIn, getToken, BOARDS_API_BASE_URL, availableRooms, currentRoom, setAvailableRooms, setCurrentRoom, setError]);

  const ensureBoardIsShareable = useCallback((boardId: string): string | null => {
    const room = availableRooms.find((r: RoomData) => r.id === boardId);
    if (!room) {
        console.warn(`[useBoardManager] ensureBoardIsShareable: Board ID "${boardId}" not found.`);
        return null;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/?board=${room.id}`;
  }, [availableRooms]);

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