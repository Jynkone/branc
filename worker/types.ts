// The contents of the environment should mostly be determined by wrangler.toml
// The contents of the environment should mostly be determined by wrangler.toml
export interface Environment {
  TLDRAW_BUCKET: R2Bucket
  TLDRAW_DURABLE_OBJECT: DurableObjectNamespace
  BOARD_METADATA: KVNamespace; // Added for storing board metadata
  CLERK_SECRET_KEY: string; // Added for Clerk Backend SDK authentication
}

// Definition for the structure of board metadata stored in KV
export interface RoomData {
id: string;
name: string;
isShared: boolean; // Indicates if the board can be accessed by a shared link
owner: string; // User ID of the owner
createdAt: number; // Timestamp of creation
// Add any other fields you expect to store for a board's metadata
}
