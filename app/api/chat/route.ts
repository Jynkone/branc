import { NextRequest, NextResponse } from "next/server";
import { GEMINI_MODEL } from "@/ai/models";
import { createClient } from "@/ai/client";
import { systemPrompt } from "@/ai/prompt";
import { getAuth } from "@clerk/nextjs/server";
import { userPromptCounts } from "@/lib/quotaStore";

export async function POST(req: NextRequest) {
  try {
    // Rollback: Use real Clerk authentication
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { prompt, context } = await req.json();
    if (!prompt || prompt.trim() === "") {
      return NextResponse.json(
        { error: "Prompt cannot be empty. Please type a question before sending." },
        { status: 400 }
      );
    }

    const currentCount = userPromptCounts[userId] || 0;
    if (currentCount >= 50) {
      return NextResponse.json(
        { error: "You have reached your prompt limit of 50. Please upgrade or try again later." },
        { status: 403 }
      );
    }

    const fullPrompt = context
      ? `Context:\n${context}\n\nFollow-up Question:\n${prompt}`
      : prompt;

    const client = createClient();
    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    // Only count the prompt if a valid response is generated
    if (responseText && responseText.trim() !== "") {
      userPromptCounts[userId] = currentCount + 1;
    } else {
      return NextResponse.json(
        { error: "Failed to generate a valid response." },
        { status: 500 }
      );
    }

    return NextResponse.json({ response: responseText, count: userPromptCounts[userId] });
  } catch (error) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
