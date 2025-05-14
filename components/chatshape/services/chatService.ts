// File: Jynkone/branc/branc-35acf07df2bc3fdbf1d7d97ee2c139d0fcf9291a/components/chatshape/services/chatService.ts

// For chatService, we will use the relative path to hit the Next.js API route on Vercel
const CHAT_API_ENDPOINT = '/api/chat'; // Relative path for Next.js API route on Vercel

export async function fetchChatResponse(
  prompt: string,
  history?: Array<{role: string, parts: Array<{text: string}>}>,
  context?: string
): Promise<{ response: string; followUpQuestions?: string[] }> {
  try {
    console.log(`[chatService] Sending chat request to Next.js API route: ${CHAT_API_ENDPOINT}`);
    const response = await fetch(CHAT_API_ENDPOINT, { // Uses relative path
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history: history || [], context }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to parse error response from chat API" }));
      console.error('[chatService] Error fetching chat response:', response.status, errorData);
      throw new Error(errorData.error || `Chat API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
        response: data.response || '',
        followUpQuestions: data.followUpQuestions || []
    };
  } catch (error) {
    console.error('[chatService] Error in fetchChatResponse:', error);
    throw error;
  }
}
