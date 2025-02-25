import { handleUnfurlRequest } from 'cloudflare-workers-unfurl'
import { AutoRouter, cors, error, IRequest } from 'itty-router'
import { handleAssetDownload, handleAssetUpload } from './assetUploads'
import { Environment } from './types'

// Make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from './TldrawDurableObject'

// We use itty-router with CORS enabled
const { preflight, corsify } = cors({ origin: '*' })
const router = AutoRouter<IRequest>({
  before: [preflight],
  finally: [corsify],
  catch: (e) => {
    console.error(e)
    return error(e)
  },
})
  // Requests to /connect are routed to the Durable Object
  .get('/connect/:roomId', (request, env: Environment) => {
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.TLDRAW_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, { headers: request.headers, body: request.body })
  })

  // Assets can be uploaded to the bucket
  .post('/uploads/:uploadId', handleAssetUpload)

  // They can be retrieved from the bucket too
  .get('/uploads/:uploadId', handleAssetDownload)

  // Bookmarks need to extract metadata
  .get('/unfurl', handleUnfurlRequest)

// Export our router for cloudflare
export default router