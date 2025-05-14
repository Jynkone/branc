// File: Jynkone/branc/branc-35acf07df2bc3fdbf1d7d97ee2c139d0fcf9291a/worker/worker.ts
import { handleUnfurlRequest } from 'cloudflare-workers-unfurl';
import { AutoRouter, cors, error, IRequest, json, RouterType } from 'itty-router';
import { createClerkClient, ClerkClient } from '@clerk/backend';
import { handleAssetDownload, handleAssetUpload } from './assetUploads';
import { Environment } from './types';
import type { RoomData } from '../components/canvas/hooks/useBoardManager';

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
        // console.warn("[Worker] Auth: CLERK_SECRET_KEY is undefined. Cannot create Clerk client.");
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
    stdRequest: Request, // This is the standard Fetch API Request object
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

    const clerk = getClerkClientInstance(env.CLERK_SECRET_KEY);
    if (!clerk) {
        console.error("[Worker] Auth: Clerk client instance is null (CLERK_SECRET_KEY was set but instance failed to create).");
        return null;
    }

    try {
        // Call authenticateRequest with the Request object.
        // Clerk's SDK should automatically look for tokens in standard places (Authorization header, cookies).
        // We provide an empty options object if no specific overrides are needed, or omit it if allowed.
        // Forcing the secretKey here can sometimes help if the client wasn't fully initialized with it
        // or if the SDK version expects it for this specific call.
        const authState = await clerk.authenticateRequest(stdRequest, {
            secretKey: env.CLERK_SECRET_KEY,
            // No explicit headerToken here; let Clerk find it.
            // Other options like loadUser: true, loadSession: true could be added if necessary.
        });
        
        console.log("[Worker] Auth: clerk.authenticateRequest completed. Status:", authState.status);

        if (authState.status === 'signed-in' && authState.toAuth().userId) {
            console.log("[Worker] Auth: Request authenticated successfully. UserID:", authState.toAuth().userId);
            return authState.toAuth().userId;
        } else {
            console.warn("[Worker] Auth: Request not signed in. Status:", authState.status, "Reason:", authState.reason, "Message:", authState.message);
            const authHeader = stdRequest.headers.get('Authorization');
            if (!authHeader) console.warn("[Worker] Auth: Detail - Authorization header was missing from the original request.");
            else if (!authHeader.startsWith('Bearer ')) console.warn("[Worker] Auth: Detail - Authorization header was present but not 'Bearer ' type.");
            else console.warn("[Worker] Auth: Detail - Bearer token was present but Clerk deemed it invalid or session expired.");
            return null;
        }

    } catch (err: any) {
        console.error("[Worker] Auth: EXCEPTION during clerk.authenticateRequest:", err.message, err.stack);
        if (err.clerkError && err.errors) {
             console.error("[Worker] Auth: Clerk error details:", JSON.stringify(err.errors));
        } else if (err.clerkError) {
            console.error("[Worker] Auth: Clerk error (no further details):", err);
        }
        return null;
    }
}

const generateShareableBoardId = (): string => {
    return `shared-board-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const { preflight, corsify } = cors({ origin: '*', allowHeaders: 'Authorization, Content-Type' });

const router: RouterType<AuthenticatedRequest, [Environment, ExecutionContext]> = AutoRouter<AuthenticatedRequest, [Environment, ExecutionContext]>({
  before: [preflight],
  finally: [corsify],
  catch: (e, request) => {
    console.error(`[Worker] Router error for ${request.method} ${request.url}:`, e);
    return error(500, { message: "Internal Router Error", detail: e instanceof Error ? e.message : String(e) });
  },
});

const withAuth = async (request: AuthenticatedRequest, env: Environment, ctx: ExecutionContext) => {
    const userId = await getAuthUserId(request, env);
    if (!userId) {
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
        return json(boards);
    } catch (err) {
        console.error(`[Worker] Error fetching boards for user ${userId}:`, err);
        return error(500, 'Internal Server Error fetching boards');
    }
});

router.post('/api/boards', withAuth, async (request, env) => {
    const userId = request.userId!;
    console.log(`[Worker] POST /api/boards for userId: ${userId}`);
    try {
        const body = await request.json?.();
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
        console.error(`[Worker] Error creating board for user ${userId}:`, err);
        if (err instanceof SyntaxError) return error(400, 'Bad Request: Invalid JSON');
        return error(500, 'Internal Server Error creating board');
    }
});

router.put('/api/boards/:boardId', withAuth, async (request, env) => {
    const userId = request.userId!;
    const boardId = request.params.boardId;
    console.log(`[Worker] PUT /api/boards/${boardId} for userId: ${userId}`);
    try {
        const body = await request.json?.();
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
                if (board.owner !== userId && board.owner !== 'unknown' && userId !== 'anonymous-dev-user') {
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
        console.error(`[Worker] Error renaming board ${boardId} for user ${userId}:`, err);
        if (err instanceof SyntaxError) return error(400, 'Bad Request: Invalid JSON');
        return error(500, 'Internal Server Error renaming board');
    }
});

// --- Existing Routes ---
router.get('/connect/:roomId', (request, env: Environment) => {
    const roomId = request.params.roomId;
    if (!roomId) {
        return error(400, 'Missing roomId for /connect');
    }
    console.log(`[Worker] GET /connect/${roomId}`);
    try {
        const id = env.TLDRAW_DURABLE_OBJECT.idFromName(roomId);
        const stub = env.TLDRAW_DURABLE_OBJECT.get(id);
        return stub.fetch(request as unknown as Request);
    } catch (e: any) {
        console.error("[Worker] Error forwarding to DO for /connect:", e);
        if (e.message?.includes('binding') || e.message?.includes('TLDRAW_DURABLE_OBJECT')) {
             return error(500, `Server configuration error related to Durable Object binding: ${e.message}`);
        }
        return error(500, 'Internal Server Error connecting to board via DO');
    }
})
  .post('/uploads/:uploadId', handleAssetUpload)
  .get('/uploads/:uploadId', handleAssetDownload)
  .get('/unfurl', handleUnfurlRequest)
  .all('*', (request) => error(404, `Not Found in Worker: ${request.method} ${request.url}`));

export default {
    async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
        return router.fetch(request, env, ctx)
          .catch(err => {
            console.error("[Worker] Uncaught error in fetch handler:", err);
            return new Response("Internal Server Error", { status: 500 });
          });
    },
};