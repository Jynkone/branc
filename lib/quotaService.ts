import { supabase } from './supabase';

// Get current prompt count for a user
// Update in lib/quotaService.ts

export async function getUserPromptCount(userId: string): Promise<{count: number, limit: number}> {
    // Default quota limit
    const limit = 50;
    
    try {
      // Ensure user exists first
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      
      if (!userData) {
        // Create the user first
        await supabase.from('users').insert({ 
          id: userId,
          created_at: new Date().toISOString()
        });
      }
      
      const { data, error } = await supabase
        .from('user_prompts')
        .select('count')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching prompt count:', error);
        return { count: 0, limit };
      }
      
      // If no record exists, create one
      if (!data) {
        const { error: insertError } = await supabase
          .from('user_prompts')
          .insert({ 
            user_id: userId, 
            count: 0,
            last_updated: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Error creating prompt count record:', insertError);
        }
        
        return { count: 0, limit };
      }
      
      return { count: data.count, limit };
    } catch (err) {
      console.error('Critical error in getUserPromptCount:', err);
      return { count: 0, limit };
    }
  }
  
  export async function incrementUserPromptCount(userId: string): Promise<{count: number, limit: number}> {
    // Default quota limit
    const limit = 50;
    
    try {
      // First, get current count
      const { data, error } = await supabase
        .from('user_prompts')
        .select('count')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching prompt count for increment:', error);
        return { count: 0, limit };
      }
      
      // If no record exists, create one
      if (!data) {
        const { error: insertError } = await supabase
          .from('user_prompts')
          .insert({ 
            user_id: userId, 
            count: 1,
            last_updated: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Error creating prompt count record:', insertError);
          return { count: 0, limit };
        }
        
        return { count: 1, limit };
      }
      
      const currentCount = data.count || 0;
      const newCount = currentCount + 1;
      
      // Update the count
      const { error: updateError } = await supabase
        .from('user_prompts')
        .update({ 
          count: newCount,
          last_updated: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (updateError) {
        console.error('Error updating prompt count:', updateError);
        return { count: currentCount, limit };
      }
      
      return { count: newCount, limit };
    } catch (err) {
      console.error('Critical error in incrementUserPromptCount:', err);
      return { count: 0, limit };
    }
  }

// Reset prompt count for a user (e.g., for subscription renewal)
export async function resetUserPromptCount(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_prompts')
    .update({ 
      count: 0,
      last_updated: new Date()
    })
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error resetting prompt count:', error);
    return false;
  }
  
  return true;
}