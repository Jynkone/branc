// The contents of the environment should mostly be determined by wrangler.toml
export interface Environment {
    TLDRAW_BUCKET: R2Bucket
    TLDRAW_DURABLE_OBJECT: DurableObjectNamespace
  }