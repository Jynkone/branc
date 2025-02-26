import { Canvas } from "@/components/Canvas";
import { shouldUseAuth } from "@/lib/shouldUseAuth";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MigrationHandler } from "@/components/MigrationHandler";
import { Suspense } from "react";

// Force dynamic rendering so that runtime context (ClerkProvider) is available
export const dynamic = "force-dynamic";

export default async function Home() {
  if (shouldUseAuth) {
    const user = await currentUser();
    if (!user) {
      redirect("/sign-in");
    }
    
    // Return Canvas with the userId and migration handler
    return (
      <>
        <Suspense fallback={null}>
          <MigrationHandler />
        </Suspense>
        <Canvas userId={user.id} />
      </>
    );
  }
  
  // If auth is disabled, use a placeholder userId
  return <Canvas userId="anonymous-user" />;
}