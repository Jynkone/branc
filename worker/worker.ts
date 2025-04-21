import { handleUnfurlRequest } from 'cloudflare-workers-unfurl'
// Import json helper from itty-router
import { AutoRouter, cors, error, IRequest, json } from 'itty-router'
// Import Clerk Backend SDK
import { createClerkClient } from '@clerk/backend';
import { handleAssetDownload, handleAssetUpload } from './assetUploads'
import { Environment } from './types'
// Import RoomData type (adjust path if necessary, assuming it's colocated or aliased)
// If using path aliases defined in tsconfig.json, ensure they resolve correctly in the worker context.
// Using relative path for potentially better worker compatibility:
import type { RoomData } from '../components/canvas/hooks/useBoardManager';

// Make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from './TldrawDurableObject'

// --- Helper functions for KV ---
async function getUserBoards(kv: KVNamespace, userId: string): Promise<RoomData[]> {
    const boardsJson = await kv.get(`user-boards:${userId}`);
    // Add basic validation in case KV data is corrupted
    try {
        const boards = boardsJson ? JSON.parse(boardsJson) : [];
        return Array.isArray(boards) ? boards : [];
    } catch (e) {
        console.error(`Failed to parse boards for user ${userId}:`, e);
        return []; // Return empty array on parsing error
    }
}

async function saveUserBoards(kv: KVNamespace, userId: string, boards: RoomData[]): Promise<void> {
    await kv.put(`user-boards:${userId}`, JSON.stringify(boards));
}

// --- Clerk Authentication Logic ---
// Helper to get a Clerk client instance, throws if key is missing
const getClerkClientInstance = (secretKey: string | undefined) => {
    if (!secretKey) {
        console.error("CLERK_SECRET_KEY environment variable is not set!");
        throw new Error("Server authentication configuration error: Clerk secret key not configured.");
    }
    // Assuming createClerkClient is correctly imported and returns the expected type
    return createClerkClient({ secretKey });
};

// Function to get validated userId from request using Clerk token
async function getAuthUserId(request: IRequest, env: Environment): Promise<string | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("No or invalid Authorization header found");
        return null; // No token provided
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
        // Get the client instance; this will throw if key is missing
        const clerk = getClerkClientInstance(env.CLERK_SECRET_KEY);

        // Verify the token using Clerk SDK
        // Ensure 'verifyToken' exists on the type returned by createClerkClient
        // If TS still complains, there might be an issue with @clerk/backend types
        // Explicitly cast to ClerkClient type if necessary, though ideally types should resolve
        const claims = await (clerk as any).verifyToken(token); // Using 'as any' temporarily if ClerkClient type doesn't work
        console.log("Token verified successfully for sub:", claims.sub);
        return claims.sub; // 'sub' usually holds the userId
    } catch (err: any) {
        // Catch errors from both getClerkClientInstance and verifyToken
        console.error("Clerk authentication failed:", err.message);
        return null; // Token is invalid, expired, or config error
    }
}


// --- Generate Shareable ID ---
const generateShareableBoardId = (): string => {
    return `shared-board-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};


// We use itty-router with CORS enabled
const { preflight, corsify } = cors({ origin: '*' })
// Update router type to include Environment and ExecutionContext for handlers
const router = AutoRouter<IRequest, [Environment, ExecutionContext]>({
  before: [preflight],
  finally: [corsify],
  catch: (e) => {
    console.error(e)
    return error(e)
  },
})

// --- Authentication Middleware (now async) ---
const withAuth = async (request: IRequest, env: Environment, ctx: ExecutionContext) => {
    // Check if CLERK_SECRET_KEY is configured before proceeding
    if (!env.CLERK_SECRET_KEY) {
        console.error("Authentication check skipped: CLERK_SECRET_KEY is not configured.");
        return error(500, "Server authentication configuration error.");
    }

    const userId = await getAuthUserId(request, env); // Await the async verification
    if (!userId) {
        return error(401, 'Unauthorized: Invalid or missing token.');
    }
    // Attach userId to the request object for downstream handlers
    request.userId = userId;
    // If valid, proceed to the next handler (the actual route logic)
};


// --- NEW API Routes for Board Metadata ---

// GET /api/boards - Fetch user's boards
router.get('/api/boards', withAuth, async (request, env) => {
    const userId = request.userId!; // userId is guaranteed by withAuth
    try {
        const boards = await getUserBoards(env.BOARD_METADATA, userId);
        // Optional: Ensure default board exists if not found
        // const defaultBoardId = `user-${userId}-default-board`;
        // if (!boards.some(b => b.id === defaultBoardId)) { ... }
        return json(boards); // itty-router's json helper sets content-type
    } catch (err) {
        console.error("Error fetching boards:", err);
        return error(500, 'Internal Server Error');
    }
});

// POST /api/boards - Create a new board
router.post('/api/boards', withAuth, async (request, env) => {
    const userId = request.userId!;
    try {
        const body = await request.json?.(); // Use optional chaining for safety
        const name = body?.name;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return error(400, 'Bad Request: Missing or invalid board name');
        }

        const currentBoards = await getUserBoards(env.BOARD_METADATA, userId);
        const newBoard: RoomData = {
            id: generateShareableBoardId(),
            name: name.trim(),
            isShared: true, // New boards are shareable by default
            owner: userId,
            createdAt: Date.now(),
        };

        const updatedBoards = [...currentBoards, newBoard];
        await saveUserBoards(env.BOARD_METADATA, userId, updatedBoards);

        return json(newBoard, { status: 201 }); // Return created board
    } catch (err) {
        console.error("Error creating board:", err);
        if (err instanceof SyntaxError) {
            return error(400, 'Bad Request: Invalid JSON');
        }
        return error(500, 'Internal Server Error');
    }
});

// PUT /api/boards/:boardId - Rename a board
router.put('/api/boards/:boardId', withAuth, async (request, env) => {
    const userId = request.userId!;
    const boardId = request.params.boardId;

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
                // Allow renaming if user is owner OR if owner is 'unknown' (board added via link)
                if (board.owner !== userId && board.owner !== 'unknown') {
                    forbidden = true; // Mark as forbidden, handle after map
                }
                boardFound = true;
                return { ...board, name: newName };
            }
            return board;
        });

        if (forbidden) {
            return error(403, 'Forbidden: You do not own this board');
        }
        if (!boardFound) {
            return error(404, 'Not Found: Board ID does not exist');
        }

        await saveUserBoards(env.BOARD_METADATA, userId, updatedBoards);
        const updatedBoard = updatedBoards.find(b => b.id === boardId);
        return json(updatedBoard); // Return updated board

    } catch (err) {
        console.error(`Error renaming board ${boardId}:`, err);
        if (err instanceof SyntaxError) {
            return error(400, 'Bad Request: Invalid JSON');
        }
        return error(500, 'Internal Server Error');
    }
});


// --- Existing Routes ---

// Requests to /connect are routed to the Durable Object
// IMPORTANT: This route likely should NOT have `withAuth` unless the DO connection itself needs it
router.get('/connect/:roomId', (request, env: Environment) => {
    const roomId = request.params.roomId;
    if (!roomId) {
        return error(400, 'Missing roomId');
    }
    try {
        // Get the Durable Object stub. ID based on roomId ensures requests for the same
        // board go to the same DO instance.
        // Ensure the DO binding name matches wrangler.toml ('TLDRAW_DURABLE_OBJECT')
        const id = env.TLDRAW_DURABLE_OBJECT.idFromName(roomId);
        const stub = env.TLDRAW_DURABLE_OBJECT.get(id);
        // Forward the request to the Durable Object's fetch handler
        // Pass the original request object directly
        return stub.fetch(request);
    } catch (e: any) {
        console.error("Error forwarding to DO:", e);
        // Handle cases like class_name not found in wrangler.toml
        if (e.message?.includes('binding') || e.message?.includes('TLDRAW_DURABLE_OBJECT')) {
             return error(500, `Server configuration error related to Durable Object binding: ${e.message}`);
        }
        return error(500, 'Internal Server Error connecting to board');
    }
})

  // Assets can be uploaded to the bucket
  .post('/uploads/:uploadId', handleAssetUpload)

  // They can be retrieved from the bucket too
  .get('/uploads/:uploadId', handleAssetDownload)

  // Bookmarks need to extract metadata
  .get('/unfurl', handleUnfurlRequest)

  // Catch-all for other routes
  .all('*', () => error(404, 'Not Found.'));

// Export the main fetch handler for Cloudflare
export default {
    async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
        // Pass env and ctx to the router
        return router.fetch(request, env, ctx);
    },
};
