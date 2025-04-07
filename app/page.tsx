import { Canvas } from "@/components/canvas/Canvas"; // Updated path
import { shouldUseAuth } from "@/lib/shouldUseAuth";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Force dynamic rendering so that runtime context (ClerkProvider) is available
export const dynamic = "force-dynamic";

export default async function Home() {
  if (shouldUseAuth) {
    const user = await currentUser();
    if (!user) {
      redirect("/sign-in");
    }
    
    // Return Canvas with the userId
    return <Canvas userId={user.id} />;
  }
  
  // If auth is disabled, use a placeholder userId
  return <Canvas userId="anonymous-user" />;
}
