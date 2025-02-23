// chatshape/services/chatService.ts

export async function fetchChatResponse(prompt: string, context?: string): Promise<string> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context }),
      });
      const data = await response.json();
      return data.response || '';
    } catch (error) {
      console.error('Error fetching chat response:', error);
      throw error;
    }
  }
  