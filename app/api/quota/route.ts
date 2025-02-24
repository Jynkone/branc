import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { userPromptCounts } from "@/lib/quotaStore";

export async function GET(req: NextRequest) {
  // Rollback: Use real Clerk authentication
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const count = userPromptCounts[userId] || 0;
  const limit = 50;

  return NextResponse.json({ count, limit });
}
