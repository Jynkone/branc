// The contents of the environment should mostly be determined by wrangler.toml
export interface Environment {
    TLDRAW_BUCKET: R2Bucket
    TLDRAW_DURABLE_OBJECT: DurableObjectNamespace
    BOARD_METADATA: KVNamespace; // Added for storing board metadata
    CLERK_SECRET_KEY: string; // Added for Clerk Backend SDK authentication
  }
