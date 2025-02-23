// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { shouldUseAuth } from "@/lib/shouldUseAuth";
import { GEMINI_MODEL } from "@/ai/models";
import { createClient } from "@/ai/client";
import { systemPrompt } from "@/ai/prompt";

export async function POST(req: NextRequest) {
  try {
    // Parse the JSON body to extract the prompt and context.
    const { prompt, context } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    // If authentication is enabled, check the current user.
    if (shouldUseAuth) {
      const user = await currentUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Combine prompt and context if context exists.
    const fullPrompt = context ? `${prompt}\nContext:\n${context}` : prompt;

    // Initialize the Gemini client and get the generative model.
    const client = createClient();
    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction:systemPrompt,
    });

    // Generate the AI response using fullPrompt.
    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    // Return the response as JSON.
    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
