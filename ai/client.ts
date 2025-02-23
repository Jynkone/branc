// client.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// Create a Gemini client instance using your Gemini API key.
// Ensure that your environment has the GEMINI_API_KEY set, or replace process.env.GEMINI_API_KEY with your key.
export const createClient = () => {
  const geminiApiKey = process.env.GEMINI_API_KEY || "";
  if (!geminiApiKey) {
    throw new Error("Gemini API key is not set in the environment variables.");
  }
  // Instantiate the Gemini client
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  return genAI;
};
