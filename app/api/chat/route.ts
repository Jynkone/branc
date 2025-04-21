// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GEMINI_MODEL } from "@/ai/models";
import { createClient } from "@/ai/client";
import { systemPrompt } from "@/ai/prompt";
import { getAuth } from "@clerk/nextjs/server";
// Removed unused import: import { shouldUseAuth } from "@/lib/shouldUseAuth";

// Helper function to extract follow-up questions from response
function extractFollowUpQuestions(text: string): { mainResponse: string, followUpQuestions: string[] } {
  const regex = /<follow-up-questions>([\s\S]*?)<\/follow-up-questions>/;
  const match = text.match(regex);
  
  if (match && match[1]) {
    const questionsText = match[1].trim();
    const questions = questionsText.split('\n')
      .map(q => q.replace(/^\d+\.\s*/, '').trim())
      .filter(q => q.length > 0);
    
    // Remove the questions section from the main response
    const mainResponse = text.replace(regex, '').trim();
    
    return { mainResponse, followUpQuestions: questions };
  }
  
  // If no questions found, return the original text
  return { mainResponse: text, followUpQuestions: [] };
}

// Update the POST handler in app/api/chat/route.ts
export async function POST(req: NextRequest) {
  try {
    // Enforce authentication unconditionally
    const auth = getAuth(req);
    if (!auth.userId) {
      // Always return error if not authenticated
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = auth.userId; // Use the authenticated user ID

    // Note: The shouldUseAuth import is no longer needed unless used elsewhere
    // import { shouldUseAuth } from "@/lib/shouldUseAuth"; // Can likely be removed

    const { prompt, history, context } = await req.json();
    if (!prompt || prompt.trim() === "") {
      return NextResponse.json(
        { error: "Prompt cannot be empty." },
        { status: 400 }
      );
    }

    const client = createClient();
    
    // Create model with system prompt
    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });

    // Initialize chat with history if available
    const chat = history && history.length > 0 
      ? model.startChat({ history }) 
      : model.startChat();
    
    // Create prompt with context if provided
    const fullPrompt = context
      ? `Context:\n${context}\n\nQuestion:\n${prompt}`
      : prompt;
    
    // Send message and get response
    const result = await chat.sendMessage(fullPrompt);
    const rawResponseText = result.response.text();
    
    // Extract follow-up questions
    const { mainResponse, followUpQuestions } = extractFollowUpQuestions(rawResponseText);

    if (mainResponse && mainResponse.trim() !== "") {
      return NextResponse.json({ 
        response: mainResponse, 
        followUpQuestions
      });
    } else {
      return NextResponse.json(
        { error: "Failed to generate a valid response." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
