// lib/migrationUtils.ts
import { supabase } from './supabase';
import { userPromptCounts } from './quotaStore';
import { SupabaseClient } from '@supabase/supabase-js';

// Helper to get the appropriate Supabase client
function getClient(customClient?: SupabaseClient) {
  return customClient || supabase;
}

// Check if a user's data needs migration
export function needsMigration(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if we've already completed migration
  const isMigrated = localStorage.getItem(`branc-migration-complete-${userId}`);
  if (isMigrated === 'true') return false;
  
  // Check if there's data to migrate
  const storedBoardsStr = localStorage.getItem(`branc-known-boards-${userId}`);
  return !!storedBoardsStr;
}

// Migrate user's data from localStorage to Supabase
export async function migrateUserDataToSupabase(
  userId: string,
  customClient?: SupabaseClient
): Promise<void> {
  const client = getClient(customClient);
  
  if (!userId || typeof window === 'undefined') return;
    
  console.log(`Starting migration for user ${userId}`);
    
  try {
    // First, ensure user exists in Supabase
    await ensureUserExists(userId, client);
    console.log(`User existence verified: ${userId}`);
    
    // Migrate boards from localStorage
    await migrateBoardsToSupabase(userId, client);
    console.log(`Boards migration completed`);
    
    // Migrate prompt count
    await migratePromptCountToSupabase(userId, client);
    console.log(`Prompts migration completed`);
    
    // Mark migration as complete
    localStorage.setItem(`branc-migration-complete-${userId}`, 'true');
    console.log(`Migration completed successfully for user ${userId}`);
  } catch (err) {
    console.error('Error during migration:', err);
  }
}
      
// Helper to ensure user exists in Supabase
async function ensureUserExists(
  userId: string,
  customClient?: SupabaseClient
): Promise<void> {
  const client = getClient(customClient);
  
  const { data } = await client
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  
  if (!data) {
    const { error } = await client
      .from('users')
      .insert({ id: userId });
    
    if (error) {
      console.error('Error creating user in Supabase:', error);
    }
  }
}

// Migrate boards data
async function migrateBoardsToSupabase(
  userId: string,
  customClient?: SupabaseClient
): Promise<void> {
  const client = getClient(customClient);
  
  const storedBoardsStr = localStorage.getItem(`branc-known-boards-${userId}`);
  if (!storedBoardsStr) return;
    
  try {
    const storedBoards = JSON.parse(storedBoardsStr);
    if (!Array.isArray(storedBoards) || storedBoards.length === 0) return;
    
    console.log(`Migrating ${storedBoards.length} boards for user ${userId}`);
    
    for (const board of storedBoards) {
      try {
        // Check if board already exists
        const { data: existingBoard } = await client
          .from('boards')
          .select('id')
          .eq('id', board.id)
          .maybeSingle();
        
        if (!existingBoard) {
          // Insert board
          const { error: boardError } = await client
            .from('boards')
            .insert({
              id: board.id,
              name: board.name,
              is_shared: board.isShared,
              created_at: new Date(board.createdAt || Date.now()).toISOString(),
              last_modified_at: new Date(board.createdAt || Date.now()).toISOString()
            });
          
          if (boardError) {
            console.error('Error migrating board to Supabase:', boardError);
            continue;
          }
        }
        
        // Create user-board relationship if it doesn't exist
        const { data: existingRelation } = await client
          .from('user_boards')
          .select('id')
          .eq('user_id', userId)
          .eq('board_id', board.id)
          .maybeSingle();
        
        if (!existingRelation) {
          const { error: relationError } = await client
            .from('user_boards')
            .insert({
              user_id: userId,
              board_id: board.id,
              role: 'owner' // Assume ownership for all migrated boards
            });
          
          if (relationError) {
            console.error('Error creating user-board relationship:', relationError);
          }
        }
      } catch (boardErr) {
        console.error(`Error processing board ${board.id}:`, boardErr);
      }
    }
  } catch (err) {
    console.error('Error parsing or processing boards from localStorage:', err);
    throw err;
  }
}

// Migrate prompt count
async function migratePromptCountToSupabase(
  userId: string,
  customClient?: SupabaseClient
): Promise<void> {
  const client = getClient(customClient);
  
  try {
    // Check if user has a prompt count in memory
    const count = userPromptCounts[userId] || 0;
    
    // Check if user already has a prompt count in Supabase
    const { data } = await client
      .from('user_prompts')
      .select('count')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data) {
      // Update existing count with max value
      const newCount = Math.max(count, data.count);
      await client
        .from('user_prompts')
        .update({ count: newCount, last_updated: new Date().toISOString() })
        .eq('user_id', userId);
    } else {
      // Create new prompt count
      await client
        .from('user_prompts')
        .insert({ 
          user_id: userId, 
          count,
          last_updated: new Date().toISOString() 
        });
    }
  } catch (error) {
    console.error('Error migrating prompt count:', error);
    throw error; // Re-throw to ensure parent function can handle the error
  }
}