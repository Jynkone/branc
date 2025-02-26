import { supabase } from './supabase';

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
    
    // First, get all board IDs the user has access to
    const { data: userBoardData, error: userBoardError } = await supabase
      .from('user_boards')
      .select('board_id')
      .eq('user_id', userId);
    
    if (userBoardError || !userBoardData || userBoardData.length === 0) {
      console.error('Error fetching user board IDs:', userBoardError);
      
      // Try localStorage fallback
      return getLocalStorageBoards(userId);
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
      return getLocalStorageBoards(userId);
    }
    
    // Map to our BoardData format
    const supabaseBoards = boardsData ? boardsData.map(board => ({
      id: board.id,
      name: board.name,
      isShared: board.is_shared,
      owner: userId, // Default the owner to current user
      createdAt: new Date(board.created_at).getTime()
    })) : [];
    
    // Merge with localStorage boards during migration
    const localBoards = getLocalStorageBoards(userId);
    
    // Filter out boards already in Supabase to avoid duplicates
    const uniqueLocalBoards = localBoards.filter(local => 
      !supabaseBoards.some(supaBoard => supaBoard.id === local.id)
    );
    
    // Sync any missing boards to Supabase (in background)
    uniqueLocalBoards.forEach(board => {
      syncBoardToSupabase(userId, board).catch(console.error);
    });
    
    return [...supabaseBoards, ...uniqueLocalBoards];
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
// Update in lib/boardService.ts - modify the createBoard function

export async function createBoard(userId: string, name: string): Promise<BoardData> {
    try {
      // Ensure user exists first
      await ensureUserExists(userId);
      
      const boardId = `shared-board-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      
      const newBoard = {
        id: boardId,
        name,
        is_shared: true,
        created_at: now,
        last_modified_at: now
      };
      
      // Insert into Supabase
      const { error: boardError } = await supabase
        .from('boards')
        .insert(newBoard);
      
      if (boardError) {
        console.error('Error creating board in Supabase:', boardError);
        throw boardError;
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
        // Try to clean up the created board
        await supabase.from('boards').delete().eq('id', boardId);
        throw relationError;
      }
      
      // During migration, also write to localStorage (remove this later)
      try {
        if (typeof window !== 'undefined') {
          const storedBoardsStr = localStorage.getItem(`branc-known-boards-${userId}`);
          let storedBoards = storedBoardsStr ? JSON.parse(storedBoardsStr) : [];
          
          const localBoard = {
            id: boardId,
            name,
            isShared: true,
            owner: userId,
            createdAt: Date.now()
          };
          
          storedBoards.push(localBoard);
          localStorage.setItem(`branc-known-boards-${userId}`, JSON.stringify(storedBoards));
        }
      } catch (err) {
        console.error('Error writing to localStorage:', err);
        // Don't throw here as the database operations were successful
      }
      
      return {
        id: boardId,
        name,
        isShared: true,
        owner: userId,
        createdAt: Date.now()
      };
    } catch (err) {
      console.error('Critical error in createBoard:', err);
      throw err;
    }
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
  try {
    // Attempt to create user record if it doesn't exist
    const { error: userError } = await supabase
      .from('users')
      .upsert({ 
        id: userId, 
        created_at: new Date().toISOString() 
      }, { 
        onConflict: 'id' 
      });

    // Ensure user_prompts record exists
    const { error: promptError } = await supabase
      .from('user_prompts')
      .upsert({ 
        user_id: userId, 
        count: 0,
        last_updated: new Date().toISOString() 
      }, { 
        onConflict: 'user_id' 
      });

    if (userError) {
      console.error('User creation error:', userError);
    }

    if (promptError) {
      console.error('Prompt count creation error:', promptError);
    }
  } catch (err) {
    console.error('Critical user initialization error:', err);
    throw err;
  }
}