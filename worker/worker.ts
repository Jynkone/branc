// File: jynkone/branc/branc-16a65ff66ddc7f3222c6b1c23f719827e18fdb63/worker/worker.ts
import { handleUnfurlRequest } from 'cloudflare-workers-unfurl';
import { AutoRouter, cors, error, IRequest, json, RouterType } from 'itty-router';
import { createClerkClient, verifyToken as clerkVerifyToken } from '@clerk/backend'; 
import type { ClerkClient, VerifyTokenOptions } from '@clerk/backend';
import { handleAssetDownload, handleAssetUpload } from './assetUploads';
import type { RoomData, Environment } from './types';

export { TldrawDurableObject } from './TldrawDurableObject';

// --- Helper functions for KV ---
async function getUserBoards(kv: KVNamespace, userId: string): Promise<RoomData[]> {
    const boardsJson = await kv.get(`user-boards:${userId}`);
    try {
        const boards = boardsJson ? JSON.parse(boardsJson) : [];
        return Array.isArray(boards) ? boards : [];
    } catch (e) {
        console.error(`[Worker] KV: Failed to parse boards for user ${userId}:`, e);
        return [];
    }
}

async function saveUserBoards(kv: KVNamespace, userId: string, boards: RoomData[]): Promise<void> {
    await kv.put(`user-boards:${userId}`, JSON.stringify(boards));
}

// --- Clerk Authentication Logic ---
const getClerkClientInstance = (secretKey: string | undefined): ClerkClient | null => {
    if (!secretKey) {
        return null;
    }
    try {
        return createClerkClient({ secretKey });
    } catch (e) {
        console.error("[Worker] Auth: Error creating Clerk client instance:", e);
        return null;
    }
};

export interface AuthenticatedRequest extends IRequest {
    userId?: string;
}

async function getAuthUserId(
    stdRequest: Request, 
    env: Environment
): Promise<string | null> {
    console.log(`[Worker] getAuthUserId: Processing request to ${stdRequest.url}`);

    if (!env.CLERK_SECRET_KEY) {
        console.log("[Worker] Auth: CLERK_SECRET_KEY not set. Defaulting to 'anonymous-dev-user'.");
        const devUserId = stdRequest.headers.get('X-Dev-User-Id');
        if (devUserId) {
            console.log(`[Worker] Auth: Using X-Dev-User-Id header: ${devUserId}`);
            return devUserId;
        }
        return 'anonymous-dev-user';
    }

    const authHeader = stdRequest.headers.get('Authorization');
    const headerToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : undefined;

    if (!headerToken) {
        console.warn("[Worker] Auth: Authorization header missing or not Bearer type. Cannot verify token.");
        return null;
    }

    try {
        const verifyTokenOptions: VerifyTokenOptions = {
            secretKey: env.CLERK_SECRET_KEY,
        };

        const claims = await clerkVerifyToken(headerToken, verifyTokenOptions);
        
        console.log("[Worker] Auth: clerkVerifyToken completed. Claims subject (userId):", claims.sub);

        if (claims && claims.sub) {
            console.log("[Worker] Auth: Token verified successfully. UserID:", claims.sub);
            return claims.sub;
        } else {
            console.warn("[Worker] Auth: Token verification succeeded but claims or sub (userId) missing.", claims);
            return null;
        }

    } catch (err: any) {
        console.error("[Worker] Auth: EXCEPTION during clerkVerifyToken:", err.message);
        if (err.status) console.error("[Worker] Auth: Error status:", err.status);
        if (err.errors) console.error("[Worker] Auth: Clerk error details:", JSON.stringify(err.errors));
        else if (err.clerkError) console.error("[Worker] Auth: Clerk error (generic):", err);
        return null;
    }
}

const generateShareableBoardId = (): string => {
    return `shared-board-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Define CORS options if you need to customize them further,
// otherwise, the default '*' origin from cors() is often fine for development.
const corsOptions = {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Dev-User-Id'],
};

const { preflight, corsify: corsifyResponse } = cors(corsOptions); // Renamed to avoid conflict if cors is used as a function

const router = AutoRouter<AuthenticatedRequest, [Environment, ExecutionContext]>({
  before: [preflight], // Handles OPTIONS requests and sets CORS headers for preflight
  // The `finally` array in itty-router with corsify is used to wrap successful responses.
  // For error responses from `catch`, we need to handle CORS headers manually or ensure `corsifyResponse` is called.
  finally: [corsifyResponse], 
  catch: (e, request) => {
    const errorMsg = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : "No stack available";
    console.error(`[Worker] Router error for ${request.method} ${request.url}: ${errorMsg}`, e);
    console.error(`[Worker] Router error stack: ${errorStack}`);
    
    const errorResponse = new Response(JSON.stringify({ 
        message: "Internal Router Error", 
        detail: errorMsg,
    }), {
        status: 500,
        headers: { 
            'Content-Type': 'application/json',
            // Manually add ACAO header for errors not caught by the main corsify
            'Access-Control-Allow-Origin': corsOptions.origin 
        }
    });
    // Though `finally` with `corsifyResponse` should ideally catch this,
    // being explicit for error responses is safer if it doesn't.
    // If corsifyResponse is robust, this manual header might be redundant.
    // Test if corsifyResponse in `finally` correctly applies to these error responses.
    // For now, directly adding the header is a surefire way.
    return errorResponse;
  },
});

const withAuth = async (request: AuthenticatedRequest, env: Environment, ctx: ExecutionContext) => {
    const userId = await getAuthUserId(request as unknown as Request, env); 
    if (!userId) {
        // This error response will be passed to the router's `finally` handlers, including corsifyResponse
        return error(401, { error: 'Unauthorized: Invalid or missing token.' });
    }
    request.userId = userId;
};

// --- API Routes for Board Metadata ---
router.get('/api/boards', withAuth, async (request, env) => {
    const userId = request.userId!;
    console.log(`[Worker] GET /api/boards for userId: ${userId}`);
    try {
        const boards = await getUserBoards(env.BOARD_METADATA, userId);
        return json(boards); // This will be wrapped by corsifyResponse from `finally`
    } catch (err: any) {
        console.error(`[Worker] Error fetching boards for user ${userId}:`, err.message, err.stack);
        return error(500, 'Internal Server Error fetching boards'); // Will also be wrapped
    }
});

router.post('/api/boards', withAuth, async (request, env) => {
    const userId = request.userId!;
    console.log(`[Worker] POST /api/boards for userId: ${userId}`);
    try {
        const body = await request.json?.().catch(e => {
            console.error("[Worker] POST /api/boards: Invalid JSON in request body", e);
            throw new SyntaxError("Invalid JSON in request body");
        });
        const name = body?.name;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return error(400, 'Bad Request: Missing or invalid board name');
        }

        const currentBoards = await getUserBoards(env.BOARD_METADATA, userId);
        const newBoard: RoomData = {
            id: generateShareableBoardId(),
            name: name.trim(),
            isShared: true, 
            owner: userId,
            createdAt: Date.now(),
        };

        const updatedBoards = [...currentBoards, newBoard];
        await saveUserBoards(env.BOARD_METADATA, userId, updatedBoards);
        console.log(`[Worker] Created new board "${newBoard.name}" (ID: ${newBoard.id}) for userId: ${userId}`);
        return json(newBoard, { status: 201 });
    } catch (err: any) {
        console.error(`[Worker] Error creating board for user ${userId}:`, err.message, err.stack);
        if (err instanceof SyntaxError) return error(400, 'Bad Request: Invalid JSON');
        return error(500, 'Internal Server Error creating board');
    }
});

router.put('/api/boards/:boardId', withAuth, async (request, env) => {
    const userId = request.userId!;
    const boardId = request.params.boardId;
    console.log(`[Worker] PUT /api/boards/${boardId} for userId: ${userId}`);
    try {
        const body = await request.json?.().catch(e => {
            console.error(`[Worker] PUT /api/boards/${boardId}: Invalid JSON in request body`, e);
            throw new SyntaxError("Invalid JSON in request body");
        });
        const name = body?.name;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return error(400, 'Bad Request: Missing or invalid board name');
        }
        const newName = name.trim();

        const currentBoards = await getUserBoards(env.BOARD_METADATA, userId);
        let boardFound = false;
        let forbidden = false;
        const updatedBoards = currentBoards.map(board => {
            if (board.id === boardId) {
                if (board.owner !== userId && userId !== 'anonymous-dev-user' && board.owner !== 'unknown') {
                    console.warn(`[Worker] Forbidden attempt to rename board. User ${userId} does not own board ${boardId} (owner: ${board.owner})`);
                    forbidden = true;
                }
                boardFound = true;
                return { ...board, name: newName };
            }
            return board;
        });

        if (forbidden) return error(403, 'Forbidden: You do not own this board');
        if (!boardFound) return error(404, 'Not Found: Board ID does not exist for renaming');

        await saveUserBoards(env.BOARD_METADATA, userId, updatedBoards);
        const updatedBoard = updatedBoards.find(b => b.id === boardId);
        console.log(`[Worker] Renamed board ${boardId} to "${newName}" for userId: ${userId}`);
        return json(updatedBoard);

    } catch (err: any) {
        console.error(`[Worker] Error renaming board ${boardId} for user ${userId}:`, err.message, err.stack);
        if (err instanceof SyntaxError) return error(400, 'Bad Request: Invalid JSON');
        return error(500, 'Internal Server Error renaming board');
    }
});

// --- WebSocket Connection Route ---
router.get('/connect/:roomId', (request: IRequest, env: Environment, ctx: ExecutionContext) => {
    const roomId = request.params.roomId;
    if (!roomId) {
        return error(400, 'Missing roomId for /connect');
    }
    console.log(`[Worker] GET /connect/${roomId} - Original URL from itty-router request: ${request.url}`);
    try {
        const id = env.TLDRAW_DURABLE_OBJECT.idFromName(roomId);
        const stub = env.TLDRAW_DURABLE_OBJECT.get(id);

        const forwardedRequest = new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : undefined,
        });
        
        console.log(`[Worker] Forwarding to DO with explicitly created Request - Method: ${forwardedRequest.method}, URL: ${forwardedRequest.url}`);
        return stub.fetch(forwardedRequest);

    } catch (e: any) {
        console.error("[Worker] Error in /connect/:roomId (during stub creation or request forwarding):", e.message, e.stack);
        if (e.message?.includes('binding') || e.message?.includes('TLDRAW_DURABLE_OBJECT')) {
             return error(500, `Server configuration error related to Durable Object binding: ${e.message}`);
        }
        return error(500, `Internal Server Error connecting to board via DO: ${e.message}`);
    }
});

router.delete('/api/boards/:boardId', withAuth, async (request, env) => {
  const userId = request.userId!;
  const boardId = request.params.boardId!;
  console.log(`[Worker] DELETE /api/boards/${boardId} for userId: ${userId}`);

  // Fetch existing
  const boards = await getUserBoards(env.BOARD_METADATA, userId);
  const board = boards.find((b) => b.id === boardId);

  if (!board) {
    return error(404, 'Not Found: Board does not exist');
  }
  if (board.owner !== userId && userId !== 'anonymous-dev-user') {
    return error(403, 'Forbidden: You do not own this board');
  }

  // Remove
  const next = boards.filter((b) => b.id !== boardId);
  await saveUserBoards(env.BOARD_METADATA, userId, next);
  console.log(`[Worker] Deleted board ${boardId}`);
  return json({ success: true });
});

// --- Other Existing Routes ---
router.post('/uploads/:uploadId', handleAssetUpload)
  .get('/uploads/:uploadId', handleAssetDownload)
  .get('/unfurl', handleUnfurlRequest)
  .all('*', (request) => error(404, `Not Found in Worker: ${request.method} ${request.url}`));

export default {
    async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
        return router.fetch(request, env, ctx)
          .catch(err => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const errorStack = err instanceof Error ? err.stack : "No stack available";
            console.error("[Worker] Uncaught error in main fetch handler:", errorMsg, errorStack);
            
            const errorResponse = new Response(JSON.stringify({ 
                error: "Unhandled error in worker", 
                detail: errorMsg,
            }), {
                 status: 500,
                 headers: { 
                     'Content-Type': 'application/json',
                     // Manually set CORS headers for this outermost catch
                     'Access-Control-Allow-Origin': corsOptions.origin,
                     'Access-Control-Allow-Methods': corsOptions.methods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS',
                     'Access-Control-Allow-Headers': corsOptions.allowHeaders?.join(', ') || 'Authorization, Content-Type',
                 }
            });
            return errorResponse;
          });
    },
};