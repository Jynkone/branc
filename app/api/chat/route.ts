// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GEMINI_MODEL } from "@/ai/models";
import { createClient } from "@/ai/client";
import { systemPrompt } from "@/ai/prompt";
import { getAuth } from "@clerk/nextjs/server";

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

export async function POST(req: NextRequest) {
  try {
    // Authenticate the user
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

    const fullPrompt = context
      ? `Context:\n${context}\n\nFollow-up Question:\n${prompt}`
      : prompt;

    const client = createClient();
    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(fullPrompt);
    const rawResponseText = result.response.text();
    
    // Extract follow-up questions from the response
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