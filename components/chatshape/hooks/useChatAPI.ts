import { useState } from 'react'

export function useChatAPI() {
  const [isLoading, setIsLoading] = useState(false)

  async function getChatResponse(
    prompt: string, 
    history?: Array<{role: string, parts: Array<{text: string}>}>,
    context?: string
  ): Promise<{
    response: string;
    followUpQuestions?: string[];
  }> {
    setIsLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          history: history || [],
          context 
        }),
      });
      
      const data = await res.json();
      setIsLoading(false);
      return {
        response: data.response || '',
        followUpQuestions: data.followUpQuestions || []
      };
    } catch (error) {
      setIsLoading(false);
      console.error('Error fetching chat response:', error);
      return { response: 'Error: Failed to get a response' };
    }
  }

  return { isLoading, getChatResponse };
}