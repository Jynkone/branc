// worker/cloudflare-workers-unfurl.d.ts
// Basic type declaration to satisfy TypeScript when @types package is missing

declare module 'cloudflare-workers-unfurl' {
  // Define the shape of the module's exports based on usage.
  // We know handleUnfurlRequest is used and likely takes a Request and returns a Promise<Response>.
  export function handleUnfurlRequest(request: Request): Promise<Response>;

  // Add declarations for other functions from this module if you use them.
  // Example:
  // export function anotherFunction(arg1: string): boolean;
}
