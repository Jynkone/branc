// app/api/quota/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { getUserPromptCount } from "@/lib/quotaService";
import { getServerSupabaseClient } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  // Get user ID from Clerk
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const supabase = getServerSupabaseClient(req);
    
    // Get quota from Supabase
    const { count, limit } = await getUserPromptCount(userId, supabase);
    
    return NextResponse.json({ count, limit });
  } catch (error) {
    console.error("Error in quota route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}