// File: Jynkone/branc/branc-35acf07df2bc3fdbf1d7d97ee2c139d0fcf9291a/components/chatshape/services/chatService.ts

// For chatService, we will use the relative path to hit the Next.js API route on Vercel
const CHAT_API_ENDPOINT = '/api/chat';

export async function fetchChatResponse(
  prompt: string,
  history?: Array<{role: string, parts: Array<{text: string}>}>, // History is expected by your Next.js API route
  context?: string
): Promise<{ response: string; followUpQuestions?: string[] }> { // Match return type of Next.js API
  try {
    console.log(`[chatService] Sending chat request to: ${CHAT_API_ENDPOINT}`);
    const response = await fetch(CHAT_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history: history || [], context }), // Send history
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to parse error response from chat API" }));
      console.error('Error fetching chat response:', response.status, errorData);
      throw new Error(errorData.error || `Chat API request failed with status ${response.status}`);
    }

    const data = await response.json();
    // Ensure the structure matches what the useManageAiApi hook expects
    return {
        response: data.response || '',
        followUpQuestions: data.followUpQuestions || []
    };
  } catch (error) {
    console.error('Error in fetchChatResponse:', error);
    // Re-throw to be handled by the caller, or return a structured error
    throw error;
  }
}