import { IRequest, error } from 'itty-router'
import { Environment } from './types'

// assets are stored in the bucket under the /uploads path
function getAssetObjectName(uploadId: string) {
  return `uploads/${uploadId.replace(/[^a-zA-Z0-9\_\-]+/g, '_')}`
}

// when a user uploads an asset, we store it in the bucket
export async function handleAssetUpload(request: IRequest, env: Environment) {
  const objectName = getAssetObjectName(request.params.uploadId)

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
    return error(400, 'Invalid content type')
  }

  if (await env.TLDRAW_BUCKET.head(objectName)) {
    return error(409, 'Upload already exists')
  }

  await env.TLDRAW_BUCKET.put(objectName, request.body, {
    httpMetadata: request.headers,
  })

  return { ok: true }
}

// when a user downloads an asset, we retrieve it from the bucket with caching
export async function handleAssetDownload(
  request: IRequest,
  env: Environment,
  ctx: ExecutionContext
) {
  const objectName = getAssetObjectName(request.params.uploadId)

  // if we have a cached response for this request, return it
  const cacheKey = new Request(request.url, { headers: request.headers })
  const cachedResponse = await caches.default.match(cacheKey)
  if (cachedResponse) {
    return cachedResponse
  }

  // if not, we try to fetch the asset from the bucket
  const object = await env.TLDRAW_BUCKET.get(objectName, {
    range: request.headers,
    onlyIf: request.headers,
  })

  if (!object) {
    return error(404)
  }

  // write the relevant metadata to the response headers
  const headers = new Headers()
  object.writeHttpMetadata(headers)

  // assets are immutable, so we can cache them basically forever:
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  headers.set('etag', object.httpEtag)

  // we set CORS headers
  headers.set('access-control-allow-origin', '*')

  // handle content-range header for partial responses
  let contentRange
  if (object.range) {
    if ('suffix' in object.range) {
      const start = object.size - object.range.suffix
      const end = object.size - 1
      contentRange = `bytes ${start}-${end}/${object.size}`
    } else {
      const start = object.range.offset ?? 0
      const end = object.range.length ? start + object.range.length - 1 : object.size - 1
      if (start !== 0 || end !== object.size - 1) {
        contentRange = `bytes ${start}-${end}/${object.size}`
      }
    }
  }

  if (contentRange) {
    headers.set('content-range', contentRange)
  }

  // make sure we get the correct body/status for the response
  const body = 'body' in object && object.body ? object.body : null
  const status = body ? (contentRange ? 206 : 200) : 304

  // we only cache complete (200) responses
  if (status === 200) {
    const [cacheBody, responseBody] = body!.tee()
    ctx.waitUntil(caches.default.put(cacheKey, new Response(cacheBody, { headers, status })))
    return new Response(responseBody, { headers, status })
  }

  return new Response(body, { headers, status })
}