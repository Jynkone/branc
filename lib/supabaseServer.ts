// lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getServerSupabaseClient = (req: NextRequest) => {
  const { userId } = getAuth(req);
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        'x-user-id': userId || 'anonymous',
      },
    },
  });
};