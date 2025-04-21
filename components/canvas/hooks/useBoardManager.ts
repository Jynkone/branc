import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Import Clerk's useAuth hook
import { useAuth } from '@clerk/nextjs';

// Type for our room data
export interface RoomData {
  id: string;
  name: string;
  isShared: boolean;
  owner: string; // User ID of the owner, or 'unknown' for boards added via link
  createdAt: number; // Keep createdAt if useful, otherwise optional
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

// Base URL for API calls (adjust if your worker serves API under a different path)
const API_BASE_URL = '/api'; // Assuming API routes are served from the same origin

export function useBoardManager(userId: string | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sharedBoardIdFromUrl = searchParams.get('board');
  // Get Clerk's getToken function
  const { getToken } = useAuth();

  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Add error state

  // --- Fetch boards from backend ---
  useEffect(() => {
    if (!userId) {
      setAvailableRooms([]);
      setCurrentRoom(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true; // Prevent state updates on unmounted component
    setIsLoading(true);
    setError(null);

    const fetchBoards = async () => {
      try {
        // Get auth token before fetching
        const token = await getToken();
        if (!token) {
            throw new Error('User is not authenticated.'); // Or handle appropriately
        }

        const response = await fetch(`${API_BASE_URL}/boards`, {
            headers: {
                'Authorization': `Bearer ${token}` // Add auth header
            }
        }); // GET request

        if (!response.ok) {
          // Handle specific errors like 401 Unauthorized
          if (response.status === 401) {
             throw new Error('Unauthorized: Please log in.');
          }
          throw new Error(`Failed to fetch boards: ${response.status} ${response.statusText}`);
        }
        let fetchedBoards: RoomData[] = await response.json();

        if (!isMounted) return; // Exit if component unmounted

         // Ensure default board exists (create locally if backend doesn't guarantee it)
         // Alternatively, the backend GET /api/boards could ensure this.
         // Let's assume backend handles default board creation if needed on first fetch.
        const defaultBoardId = getDefaultBoardId(userId);
        let defaultBoard = fetchedBoards.find(board => board.id === defaultBoardId);

        // If backend doesn't auto-create default, we might need a POST here
        // For now, assume backend handles it or we create it on first POST if needed.
        if (!defaultBoard) {
             console.warn("Default board not found in fetched list. Consider backend logic or initial creation.");
             // You might want to create it via API here if necessary
             // Or just use a temporary local representation until one is created/selected
             defaultBoard = { // Temporary local representation
                 id: defaultBoardId,
                 name: "My Board",
                 isShared: false,
                 owner: userId,
                 createdAt: Date.now()
             };
             // Don't add to fetchedBoards directly unless backend confirms creation
        }


        let roomToSelect: RoomData | null = null;

        // Handle board ID from URL
        if (sharedBoardIdFromUrl) {
          let sharedBoard = fetchedBoards.find(board => board.id === sharedBoardIdFromUrl);

          if (!sharedBoard) {
            // Board from URL not found. This case is tricky.
            // Option 1: Assume it's a valid board and add a temporary local representation.
            // Option 2: Try to fetch details for this specific board ID (needs another API endpoint).
            // Option 3: Show an error or redirect.
            console.warn(`Board ${sharedBoardIdFromUrl} from URL not found in user's list.`);
            // For simplicity, let's add a temporary representation (like before)
             sharedBoard = {
               id: sharedBoardIdFromUrl,
               name: `Shared Board`, // Placeholder
               isShared: true,
               owner: 'unknown',
               createdAt: Date.now(),
             };
             // Don't add to fetchedBoards unless confirmed valid
             roomToSelect = sharedBoard; // Select the temporary representation
          } else {
             roomToSelect = sharedBoard;
          }
        } else {
          // No board in URL, select the default board
          roomToSelect = defaultBoard;
        }

        setAvailableRooms(fetchedBoards); // Set state with boards from backend
        setCurrentRoom(roomToSelect);

      } catch (err: any) {
        console.error("Error fetching boards:", err);
        if (isMounted) setError(err.message || 'Failed to load boards.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchBoards();

    return () => { isMounted = false; }; // Cleanup function

  }, [userId, sharedBoardIdFromUrl]); // Rerun when user or URL changes


  // --- Select Board (mostly unchanged, URL logic might need review) ---
  const selectBoard = useCallback((boardId: string) => {
    // Find in the current state (which should be synced from backend)
    // Include currentRoom in search in case it was temporary (e.g., loaded from URL but not yet in fetched list)
    const selectedRoom = [...availableRooms, currentRoom].filter(Boolean).find(room => room && room.id === boardId);
    if (selectedRoom) {
      setCurrentRoom(selectedRoom);
      // Update URL - logic remains similar
      // Ensure userId exists before calling getDefaultBoardId
      if (userId && selectedRoom.isShared && selectedRoom.id !== getDefaultBoardId(userId)) {
        router.push(`/?board=${selectedRoom.id}`, { scroll: false });
      } else {
        router.push('/', { scroll: false });
      }
      console.log("Selected board:", selectedRoom.id);
    } else {
      console.warn("Attempted to select non-existent or non-fetched board:", boardId);
      // Maybe fetch the board details if not found? Or show error.
    }
  }, [availableRooms, currentRoom, router, userId]); // Add currentRoom dependency

  // --- Create New Board ---
  const createNewBoard = useCallback(async () => {
    if (!userId) return null; // Return null or throw error

    // Suggest a name, but let backend handle actual creation
    const boardNumber = availableRooms.filter(b => b.owner === userId).length + 1;
    const suggestedName = `Page ${boardNumber}`;

    setIsLoading(true); // Indicate activity
    setError(null);

    try {
      // Get auth token before creating
      const token = await getToken();
       if (!token) {
            throw new Error('User is not authenticated.');
        }

      const response = await fetch(`${API_BASE_URL}/boards`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Add auth header
        },
        body: JSON.stringify({ name: suggestedName }),
      });

      if (!response.ok) {
        // Handle specific errors like 401 Unauthorized
        if (response.status === 401) {
           throw new Error('Unauthorized: Could not create board.');
        }
        throw new Error(`Failed to create board: ${response.status} ${response.statusText}`);
      }

      const newBoard: RoomData = await response.json();

      // Update local state
      setAvailableRooms(prevRooms => [...prevRooms, newBoard]);
      setCurrentRoom(newBoard); // Select the new board

      // Update URL
      router.push(`/?board=${newBoard.id}`, { scroll: false });
      console.log("Created new board via API:", newBoard.id);
      setIsLoading(false);
      return newBoard; // Return the created board

    } catch (err: any) {
      console.error("Error creating board:", err);
      setError(err.message || 'Failed to create board.');
      setIsLoading(false);
      return null; // Indicate failure
    }
  }, [userId, availableRooms, router]); // Removed persistRooms

  // --- Rename Board ---
  const renameBoard = useCallback(async (boardId: string, newName: string) => {
    if (!userId || !newName.trim()) return;

    const trimmedName = newName.trim();
    // Find the original room from the current state for potential rollback
    const originalRoom = availableRooms.find(r => r.id === boardId);
    if (!originalRoom) {
        console.error("Cannot rename: board not found locally", boardId);
        setError("Cannot rename: board not found locally."); // Inform user
        return;
    }
    const originalName = originalRoom.name; // Store original name for rollback

    // Optimistic UI update (optional but good UX)
    const optimisticRooms = availableRooms.map(room =>
        room.id === boardId ? { ...room, name: trimmedName } : room
    );
    setAvailableRooms(optimisticRooms);
    if (currentRoom?.id === boardId) {
        setCurrentRoom(prev => prev ? { ...prev, name: trimmedName } : null);
    }

    setError(null); // Clear previous errors

    try {
      // Get auth token before renaming
      const token = await getToken();
       if (!token) {
            throw new Error('User is not authenticated.');
        }

      const response = await fetch(`${API_BASE_URL}/boards/${boardId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Add auth header
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
         // Revert optimistic update on failure
         setAvailableRooms(availableRooms.map(r => r.id === boardId ? originalRoom : r)); // Use originalRoom object
         if (currentRoom?.id === boardId) {
             setCurrentRoom(originalRoom);
         }
         // Handle specific errors
         if (response.status === 401) throw new Error('Unauthorized: Could not rename board.');
         if (response.status === 403) throw new Error('Forbidden: You do not own this board.');
         if (response.status === 404) throw new Error('Board not found on server.');

        throw new Error(`Failed to rename board: ${response.status} ${response.statusText}`);
      }

      const updatedBoardFromServer: RoomData = await response.json();

      // Update state with confirmed data from server (ensure consistency)
      setAvailableRooms(prevRooms => prevRooms.map(room =>
        room.id === boardId ? updatedBoardFromServer : room
      ));
       if (currentRoom?.id === boardId) {
           setCurrentRoom(updatedBoardFromServer);
       }

      console.log("Renamed board via API:", boardId, "to", trimmedName);

    } catch (err: any) {
      console.error("Error renaming board:", err);
      setError(err.message || 'Failed to rename board.');
       // Ensure rollback happens on any catch
       setAvailableRooms(availableRooms.map(r => r.id === boardId ? originalRoom : r));
       if (currentRoom?.id === boardId) {
           setCurrentRoom(originalRoom);
       }
    }
  }, [userId, availableRooms, currentRoom, router]); // Added router dependency for potential future use

  // --- Ensure Board Shareable (no backend call needed based on current logic) ---
  // This function primarily updates the URL and potentially a local flag.
  // The backend POST already creates boards as shareable.
  // If you needed to *change* share status via API, this would need modification.
  const ensureBoardIsShareable = useCallback((boardId: string): string | null => {
     // Find board in the current state
     const room = availableRooms.find(r => r.id === boardId);
     if (!room) return null;

     // The concept of "isShared" might now just mean "has a shareable link format"
     // since all boards created via POST are shareable.
     // If the board ID follows the shareable pattern, generate the link.
     // Also check if it's the default board ID.
     if (room.id.startsWith('shared-board-') || (userId && room.id === getDefaultBoardId(userId))) {
         // Allow generating link for default board as well, assuming it's accessible
         return `${window.location.origin}/?board=${room.id}`;
     }
     // If it's an older format or unexpected ID, don't generate a link
     console.warn("Board ID format not recognized as shareable:", boardId);
     return null;

  }, [availableRooms, userId]); // Added userId dependency


  return {
    isLoading,
    error, // Expose error state
    currentRoom,
    availableRooms,
    selectBoard,
    createNewBoard,
    renameBoard,
    ensureBoardIsShareable,
    getDefaultBoardId: userId ? () => getDefaultBoardId(userId) : () => '',
  };
}
