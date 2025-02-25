// Type definitions for Cloudflare Workers

interface WebSocketPair {
    0: WebSocket;
    1: WebSocket;
  }
  
  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
  }
  
  interface R2Bucket {
    head(key: string): Promise<R2Object | null>;
    get(key: string, options?: R2GetOptions): Promise<R2Object | null>;
    put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>;
  }
  
  interface R2GetOptions {
    onlyIf?: R2Conditional;
    range?: R2Range;
  }
  
  interface R2PutOptions {
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
    md5?: ArrayBuffer;
  }
  
  interface R2HTTPMetadata {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  }
  
  interface R2Conditional {
    etagMatches?: string;
    etagDoesNotMatch?: string;
    uploadedBefore?: Date;
    uploadedAfter?: Date;
  }
  
  interface R2Range {
    offset?: number;
    length?: number;
    suffix?: number;
  }
  
  interface R2Object {
    key: string;
    version: string;
    size: number;
    etag: string;
    httpEtag: string;
    uploaded: Date;
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
    range?: R2Range;
    body: ReadableStream;
    bodyUsed: boolean;
    writeHttpMetadata(headers: Headers): void;
    json<T>(): Promise<T>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
  }
  
  interface DurableObjectState {
    storage: DurableObjectStorage;
    blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  }
  
  interface DurableObjectStorage {
    get<T = unknown>(key: string, options?: DurableObjectGetOptions): Promise<T | undefined>;
    get<T = unknown>(keys: string[], options?: DurableObjectGetOptions): Promise<Map<string, T>>;
    list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, T>>;
    put<T>(key: string, value: T, options?: DurableObjectPutOptions): Promise<void>;
    put<T>(entries: Record<string, T>, options?: DurableObjectPutOptions): Promise<void>;
    delete(key: string, options?: DurableObjectPutOptions): Promise<boolean>;
    delete(keys: string[], options?: DurableObjectPutOptions): Promise<number>;
    deleteAll(options?: DurableObjectPutOptions): Promise<void>;
    transaction<T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T>;
  }
  
  interface DurableObjectGetOptions {
    allowConcurrency?: boolean;
    noCache?: boolean;
  }
  
  interface DurableObjectListOptions {
    start?: string;
    end?: string;
    prefix?: string;
    reverse?: boolean;
    limit?: number;
    allowConcurrency?: boolean;
    noCache?: boolean;
  }
  
  interface DurableObjectPutOptions {
    allowConcurrency?: boolean;
    allowUnconfirmed?: boolean;
    noCache?: boolean;
  }
  
  interface DurableObjectTransaction {
    get<T = unknown>(key: string): Promise<T | undefined>;
    get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
    list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, T>>;
    put<T>(key: string, value: T): Promise<void>;
    put<T>(entries: Record<string, T>): Promise<void>;
    delete(key: string): Promise<boolean>;
    delete(keys: string[]): Promise<number>;
    deleteAll(): Promise<void>;
    rollback(): void;
  }
  
  interface DurableObjectNamespace {
    newUniqueId(options?: DurableObjectNamespaceNewUniqueIdOptions): DurableObjectId;
    idFromName(name: string): DurableObjectId;
    idFromString(id: string): DurableObjectId;
    get(id: DurableObjectId): DurableObject;
  }
  
  interface DurableObjectNamespaceNewUniqueIdOptions {
    jurisdiction?: string;
  }
  
  interface DurableObjectId {
    toString(): string;
    equals(other: DurableObjectId): boolean;
  }
  
  interface DurableObject {
    fetch(request: Request): Promise<Response>;
  }
  
  // Extend the global caches object
  interface CacheStorage {
    default: Cache;
  }
  
  declare var caches: CacheStorage;
  
  // Add KVNamespace for quota storage
  interface KVNamespace {
    get(key: string, options?: Partial<KVNamespaceGetOptions<undefined>>): Promise<string | null>;
    get(key: string, type: 'text'): Promise<string | null>;
    get<ExpectedValue = unknown>(key: string, type: 'json'): Promise<ExpectedValue | null>;
    get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
    get(key: string, type: 'stream'): Promise<ReadableStream | null>;
    get(key: string, options: KVNamespaceGetOptions<'text'>): Promise<string | null>;
    get<ExpectedValue = unknown>(key: string, options: KVNamespaceGetOptions<'json'>): Promise<ExpectedValue | null>;
    get(key: string, options: KVNamespaceGetOptions<'arrayBuffer'>): Promise<ArrayBuffer | null>;
    get(key: string, options: KVNamespaceGetOptions<'stream'>): Promise<ReadableStream | null>;
    list<Metadata = unknown>(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<Metadata>>;
    put(
      key: string,
      value: string | ReadableStream | ArrayBuffer | FormData | URLSearchParams,
      options?: KVNamespacePutOptions,
    ): Promise<void>;
    delete(key: string): Promise<void>;
  }
  
  type KVNamespaceGetOptions<Type> = {
    type: Type;
    cacheTtl?: number;
  };
  
  type KVNamespaceListOptions = {
    limit?: number;
    prefix?: string | null;
    cursor?: string | null;
  };
  
  type KVNamespaceListResult<Metadata> = {
    keys: {
      name: string;
      expiration?: number;
      metadata?: Metadata;
    }[];
    list_complete: boolean;
    cursor?: string;
  };
  
  type KVNamespacePutOptions = {
    expiration?: number;
    expirationTtl?: number;
    metadata?: any;
  };