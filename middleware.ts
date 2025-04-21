import { clerkMiddleware } from "@clerk/nextjs/server";
// Removed unused import: import { shouldUseAuth } from "@/lib/shouldUseAuth";

export default clerkMiddleware();

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
