import { supabase } from './supabase';
import { getAuth } from "@clerk/nextjs/server";

// Type definitions
export type BoardData = {
  id: string;
  name: string;
  isShared: boolean;
  owner: string;
  createdAt: number;
};

export type UserBoardRole = 'owner' | 'editor' | 'viewer';

// Check if a user has access to a board
export async function userHasAccessToBoard(userId: string, boardId: string): Promise<boolean> {
  // First ensure the user exists in the database
  await ensureUserExists(userId);
  
  // Check Supabase
  const { data, error } = await supabase
    .from('user_boards')
    .select('id')
    .eq('user_id', userId)
    .eq('board_id', boardId)
    .maybeSingle();
  
  if (error) {
    console.error('Error checking board access:', error);
  }
  
  // If found in Supabase, user has access
  if (data) {
    return true;
  }
  
  // If not in Supabase, check if it's a shared board
  const { data: boardData } = await supabase
    .from('boards')
    .select('is_shared')
    .eq('id', boardId)
    .maybeSingle();
  
  if (boardData?.is_shared) {
    return true;
  }
  
  // Fallback to localStorage during migration (will be removed later)
  try {
    if (typeof window !== 'undefined') {
      const storedBoardsStr = localStorage.getItem(`branc-known-boards-${userId}`);
      if (storedBoardsStr) {
        const storedBoards = JSON.parse(storedBoardsStr);
        return storedBoards.some((board: BoardData) => board.id === boardId);
      }
    }
  } catch (err) {
    console.error('Error reading from localStorage:', err);
  }
  
  return false;
}

// Get all boards for a user
export async function getUserBoards(userId: string): Promise<BoardData[]> {
  // Ensure user exists
  await ensureUserExists(userId);
  
  // Helper function to get boards from localStorage
  const getLocalStorageBoards = (): BoardData[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const storedBoardsStr = localStorage.getItem(`branc-known-boards-${userId}`);
      if (storedBoardsStr) {
        return JSON.parse(storedBoardsStr);
      }
    } catch (err) {
      console.error('Error reading from localStorage:', err);
    }
    
    return [];
  };
  
  // First, get all board IDs the user has access to
  const { data: userBoardData, error: userBoardError } = await supabase
    .from('user_boards')
    .select('board_id')
    .eq('user_id', userId);
  
  // If no boards exist in Supabase, check localStorage
  if (userBoardError || !userBoardData || userBoardData.length === 0) {
    const localBoards = getLocalStorageBoards();
    
    // If no boards at all, return an empty array
    if (localBoards.length === 0) {
      return [];
    }
    
    return localBoards;
  }
  
  // Extract the board IDs
  const boardIds = userBoardData.map(item => item.board_id);
  
  // Then fetch all boards matching these IDs
  const { data: boardsData, error: boardsError } = await supabase
    .from('boards')
    .select('*')
    .in('id', boardIds);
  
  if (boardsError) {
    console.error('Error fetching boards:', boardsError);
    return getLocalStorageBoards();
  }
  
  // Map to our BoardData format
  const supabaseBoards = boardsData ? boardsData.map(board => ({
    id: board.id,
    name: board.name,
    isShared: board.is_shared,
    owner: userId,
    createdAt: new Date(board.created_at).getTime()
  })) : [];
  
  // Merge with localStorage boards during migration
  const localBoards = getLocalStorageBoards();
  
  // Deduplication logic
  const uniqueBoards = new Map<string, BoardData>();
  
  // Add Supabase boards first
  supabaseBoards.forEach(board => uniqueBoards.set(board.id, board));
  
  // Add local boards only if they don't already exist
  localBoards.forEach(board => {
    if (!uniqueBoards.has(board.id)) {
      uniqueBoards.set(board.id, board);
    }
  });
  
  // Convert back to array
  const mergedBoards = Array.from(uniqueBoards.values());
  
  // Reduce sync operations
  const boardsToSync = localBoards.filter(local => 
    !supabaseBoards.some(supaBoard => supaBoard.id === local.id)
  );
  
  // Limit sync to first 3 boards to prevent excessive operations
  for (const local of boardsToSync.slice(0, 3)) {
    try {
      await syncBoardToSupabase(userId, local);
    } catch (err) {
      console.error('Sync failed for board:', local.id, err);
    }
  }
  
  return mergedBoards;
}

  // Helper function to get boards from localStorage
  function getLocalStorageBoards(userId: string): BoardData[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const storedBoardsStr = localStorage.getItem(`branc-known-boards-${userId}`);
      if (storedBoardsStr) {
        return JSON.parse(storedBoardsStr);
      }
    } catch (err) {
      console.error('Error reading from localStorage:', err);
    }
    
    return [];
  }// Create a new board


  export async function createBoard(userId: string, name: string): Promise<BoardData> {
    // Ensure user exists
    await ensureUserExists(userId);
    
    // Check if a board with this name already exists
    const { data: existingBoards } = await supabase
      .from('boards')
      .select('id, name')
      .eq('name', name)
      .eq('is_shared', true)
      .eq('id[starts_with]', `user-${userId}-`);
    
    // If board exists, return the existing board
    if (existingBoards && existingBoards.length > 0) {
      return {
        id: existingBoards[0].id,
        name: existingBoards[0].name,
        isShared: true,
        owner: userId,
        createdAt: Date.now()
      };
    }
    
    // Generate a more deterministic board ID
    const boardId = `user-${userId}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    
    const newBoard = {
      id: boardId,
      name,
      is_shared: true
    };
    
    // Insert into Supabase
    const { error: boardError } = await supabase
      .from('boards')
      .insert(newBoard);
    
    if (boardError) {
      console.error('Error creating board in Supabase:', boardError);
    }
    
    // Create user-board relationship
    const { error: relationError } = await supabase
      .from('user_boards')
      .insert({
        user_id: userId,
        board_id: boardId,
        role: 'owner'
      });
    
    if (relationError) {
      console.error('Error creating user-board relationship:', relationError);
    }
    
    // Safely update localStorage
    try {
      if (typeof window !== 'undefined') {
        const storedBoardsStr = localStorage.getItem(`branc-known-boards-${userId}`);
        const storedBoards = storedBoardsStr ? JSON.parse(storedBoardsStr) : [];
        
        // Only add if not already exists
        const boardExists = storedBoards.some((board: BoardData) => board.id === boardId);
        if (!boardExists) {
          storedBoards.push({
            id: boardId,
            name,
            isShared: true,
            owner: userId,
            createdAt: Date.now()
          });
          
          localStorage.setItem(`branc-known-boards-${userId}`, JSON.stringify(storedBoards));
        }
      }
    } catch (err) {
      console.error('Error updating localStorage:', err);
    }
    
    return {
      id: boardId,
      name,
      isShared: true,
      owner: userId,
      createdAt: Date.now()
    };
  }
  
// Rename a board
export async function renameBoard(userId: string, boardId: string, newName: string): Promise<void> {
  // Update in Supabase
  const { error } = await supabase
    .from('boards')
    .update({ name: newName, last_modified_at: new Date() })
    .eq('id', boardId);
  
  if (error) {
    console.error('Error renaming board in Supabase:', error);
  }
  
  // During migration, also update localStorage (remove this later)
  try {
    if (typeof window !== 'undefined') {
      const storedBoardsStr = localStorage.getItem(`branc-known-boards-${userId}`);
      if (storedBoardsStr) {
        const storedBoards = JSON.parse(storedBoardsStr);
        const updatedBoards = storedBoards.map((board: BoardData) => {
          if (board.id === boardId) {
            return { ...board, name: newName };
          }
          return board;
        });
        
        localStorage.setItem(`branc-known-boards-${userId}`, JSON.stringify(updatedBoards));
      }
    }
  } catch (err) {
    console.error('Error updating localStorage:', err);
  }
}

// Helper to sync a board from localStorage to Supabase
async function syncBoardToSupabase(userId: string, board: BoardData): Promise<void> {
  // Check if board already exists
  const { data: existingBoard } = await supabase
    .from('boards')
    .select('id')
    .eq('id', board.id)
    .maybeSingle();
  
  if (!existingBoard) {
    // Insert board
    const { error: boardError } = await supabase
      .from('boards')
      .insert({
        id: board.id,
        name: board.name,
        is_shared: board.isShared,
        created_at: new Date(board.createdAt)
      });
    
    if (boardError) {
      console.error('Error syncing board to Supabase:', boardError);
      return;
    }
  }
  
  // Create user-board relationship if it doesn't exist
  const { data: existingRelation } = await supabase
    .from('user_boards')
    .select('id')
    .eq('user_id', userId)
    .eq('board_id', board.id)
    .maybeSingle();
  
  if (!existingRelation) {
    const { error: relationError } = await supabase
      .from('user_boards')
      .insert({
        user_id: userId,
        board_id: board.id,
        role: 'owner' // Assume ownership for existing boards
      });
    
    if (relationError) {
      console.error('Error creating user-board relationship:', relationError);
    }
  }
}

// Helper to ensure a user exists in the database
export async function ensureUserExists(userId: string): Promise<void> {
  // Check if user exists
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  
  if (!data) {
    // Create user record
    const { error } = await supabase
      .from('users')
      .insert({ id: userId });
    
    if (error) {
      console.error('Error creating user in Supabase:', error);
    }
    
    // Also create a prompts record
    const { error: promptError } = await supabase
      .from('user_prompts')
      .insert({ user_id: userId, count: 0 });
    
    if (promptError) {
      console.error('Error creating user prompts record:', promptError);
    }
  }
}