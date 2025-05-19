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
  const cleanUserId = userId.replace(/^user[_-]+/, '');
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
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const BOARDS_API_BASE_URL = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_WORKER_URL;
    if (!url) {
      console.error('[useBoardManager] Missing NEXT_PUBLIC_WORKER_URL');
      return 'http://localhost:8787';
    }
    return url.startsWith('http') ? url : `https://${url}`;
  }, []);

  const navigateToBoard = useCallback((board: RoomData | null) => {
    if (!isMountedRef.current) return;
    const curr = window.location.pathname + window.location.search;
    let next = '/';
    if (board) {
      const actualUser = userId || 'anonymous-user';
      const defaultId = getDefaultBoardId(actualUser);
      if (board.isShared && board.id !== defaultId) {
        next = `/?board=${board.id}`;
      }
    }
    if (curr !== next) router.push(next, { scroll: false });
  }, [router, userId]);

  const createNewBoard = useCallback(
    async (isDefault = false): Promise<RoomData | null> => {
      if (!isMountedRef.current) return null;
      const effUser = userId || 'anonymous-user';

      if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
        setError('Cannot create board: User not signed in.');
        return null;
      }
      if (!effUser) {
        setError('Cannot create board: User ID missing.');
        return null;
      }

      // Name: either default label or incremental Page N
      const boardName = isDefault
        ? 'My First Board'
        : `Page ${availableRooms.length + 1}`;

      if (isDefault) isAutoCreatingBoardRef.current = true;
      setError(null);

      try {
        let token: string | null = null;
        if (
          process.env.NEXT_PUBLIC_USE_AUTH === 'true' &&
          isSignedIn &&
          userId
        ) {
          token = await getToken();
          if (!token) throw new Error('Auth token retrieval failed.');
        }
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `${BOARDS_API_BASE_URL}/api/boards`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: boardName }),
          }
        );
        if (!res.ok) throw new Error(`Create failed: ${res.status}`);
        const newBoard: RoomData = await res.json();

        if (isMountedRef.current) {
          setAvailableRooms((prev) => [...prev, newBoard]);
        }
        return newBoard;
      } catch (e: any) {
        console.error('[useBoardManager] createNewBoard error', e);
        if (isMountedRef.current) setError(e.message);
        return null;
      } finally {
        if (isDefault) isAutoCreatingBoardRef.current = false;
      }
    },
    [availableRooms, userId, getToken, BOARDS_API_BASE_URL, isSignedIn]
  );

  const selectBoard = useCallback(
    (boardId: string) => {
      if (!isMountedRef.current) return;
      const room = availableRooms.find((b) => b.id === boardId) || null;
      if (room) {
        setCurrentRoom(room);
        navigateToBoard(room);
      }
    },
    [availableRooms, navigateToBoard]
  );

  // Initial fetch & setup
  useEffect(() => {
    const urlId = searchParams.get('board');
    if (!isLoaded) {
      setIsLoading(true);
      return;
    }
    if (process.env.NEXT_PUBLIC_USE_AUTH === 'true' && !isSignedIn) {
      setAvailableRooms([]);
      setCurrentRoom(null);
      setError('Not authenticated.');
      setIsLoading(false);
      initialLoadCompletedRef.current = true;
      return;
    }

    const fetchBoards = async () => {
      if (isFetchingBoardsRef.current) return;
      isFetchingBoardsRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        let token: string | null = null;
        if (
          process.env.NEXT_PUBLIC_USE_AUTH === 'true' &&
          isSignedIn &&
          userId
        ) {
          token = await getToken();
          if (!token) throw new Error('Auth token error');
        }
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const res = await fetch(
          `${BOARDS_API_BASE_URL}/api/boards`,
          { headers }
        );
        if (!res.ok)
          throw new Error(`Fetch boards failed: ${res.status}`);
        const data: RoomData[] = await res.json();
        if (!isMountedRef.current) return;

        setAvailableRooms(data);

        // pick initial board
        const actualUser = userId || 'anonymous-user';
        const defaultId = getDefaultBoardId(actualUser);
        let pick: RoomData | null =
          data.find((b) => b.id === urlId) ||
          data.find((b) => b.id === defaultId) ||
          data[0] ||
          null;

        if (pick) {
          setCurrentRoom(pick);
          navigateToBoard(pick);
        } else {
          // no boards: create default
          isAutoCreatingBoardRef.current = true;
          const def = await createNewBoard(true);
          isAutoCreatingBoardRef.current = false;
          if (def) {
            setCurrentRoom(def);
            navigateToBoard(def);
          } else {
            setError('Failed to create default board.');
            setCurrentRoom(null);
            navigateToBoard(null);
          }
        }
      } catch (e: any) {
        console.error('[useBoardManager] fetchBoards error', e);
        setError(e.message || 'Load boards failed.');
      } finally {
        isFetchingBoardsRef.current = false;
        initialLoadCompletedRef.current = true;
        setIsLoading(false);
      }
    };

    if (!initialLoadCompletedRef.current) {
      fetchBoards();
    } else {
      setIsLoading(false);
    }
  }, [
    searchParams,
    isLoaded,
    isSignedIn,
    userId,
    getToken,
    BOARDS_API_BASE_URL,
    navigateToBoard,
    createNewBoard,
  ]);

  const renameBoard = useCallback(
    async (boardId: string, newName: string) => {
      if (!isMountedRef.current) return;
      const original = [...availableRooms];
      const room = original.find((r) => r.id === boardId);
      if (!room || room.name === newName.trim()) return;
      const trimmed = newName.trim();

      setAvailableRooms((prev) =>
        prev.map((r) =>
          r.id === boardId ? { ...r, name: trimmed } : r
        )
      );
      if (currentRoom?.id === boardId) {
        setCurrentRoom({ ...currentRoom, name: trimmed });
      }

      try {
        let token: string | null = null;
        if (
          process.env.NEXT_PUBLIC_USE_AUTH === 'true' &&
          isSignedIn &&
          userId
        ) {
          token = await getToken();
          if (!token) throw new Error('Auth token error');
        }
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `${BOARDS_API_BASE_URL}/api/boards/${boardId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ name: trimmed }),
          }
        );
        if (!res.ok) throw new Error(`Rename failed: ${res.status}`);
        const updated: RoomData = await res.json();

        if (isMountedRef.current) {
          setAvailableRooms((prev) =>
            prev.map((r) =>
              r.id === boardId ? updated : r
            )
          );
          if (currentRoom?.id === boardId) {
            setCurrentRoom(updated);
          }
        }
      } catch (e: any) {
        console.error('[useBoardManager] renameBoard error', e);
        setError(e.message || 'Rename failed.');
        setAvailableRooms(original);
        if (currentRoom?.id === boardId && room) {
          setCurrentRoom(room);
        }
      }
    },
    [availableRooms, currentRoom, getToken, BOARDS_API_BASE_URL, isSignedIn, userId]
  );

  const ensureBoardIsShareable = useCallback(
    (boardId: string): string | null => {
      const room = availableRooms.find((r) => r.id === boardId);
      if (!room) return null;
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      return `${origin}/?board=${boardId}`;
    },
    [availableRooms]
  );

  const deleteBoard = useCallback(
    async (boardId: string) => {
      let token: string | null = null;
      if (
        process.env.NEXT_PUBLIC_USE_AUTH === 'true' &&
        isSignedIn &&
        userId
      ) {
        token = await getToken();
      }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `${BOARDS_API_BASE_URL}/api/boards/${boardId}`,
        {
          method: 'DELETE',
          headers,
        }
      );
      if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`);

      const next = availableRooms.filter((r) => r.id !== boardId);
      if (next.length > 0) {
        setAvailableRooms(next);
        if (currentRoom?.id === boardId) {
          const first = next[0];
          setCurrentRoom(first);
          navigateToBoard(first);
        }
      } else {
        // last board deleted → auto-create default
        const def = await createNewBoard(true);
        if (def) {
          setAvailableRooms([def]);
          setCurrentRoom(def);
          navigateToBoard(def);
        } else {
          setAvailableRooms([]);
          setCurrentRoom(null);
          navigateToBoard(null);
        }
      }
    },
    [
      availableRooms,
      currentRoom,
      createNewBoard,
      getToken,
      BOARDS_API_BASE_URL,
      isSignedIn,
      userId,
      navigateToBoard,
    ]
  );

  return {
    isLoading:
      isLoading ||
      isFetchingBoardsRef.current ||
      isAutoCreatingBoardRef.current,
    error,
    currentRoom,
    availableRooms,
    selectBoard,
    createNewBoard,
    renameBoard,
    deleteBoard,
    ensureBoardIsShareable,
    getDefaultBoardId: userId
      ? () => getDefaultBoardId(userId)
      : () => getDefaultBoardId('anonymous-user'),
  };
}
