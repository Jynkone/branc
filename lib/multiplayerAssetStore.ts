import { TLAssetStore, uniqueId } from 'tldraw'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "";

// How does our server handle assets like images and videos?
export const multiplayerAssetStore: TLAssetStore = {
  // to upload an asset, we...
  async upload(_asset, file) {
    // ...create a unique name & URL...
    const id = uniqueId()
    const objectName = `${id}-${file.name}`.replace(/[^a-zA-Z0-9.]/g, '-')
    const url = `${WORKER_URL}/uploads/${objectName}`

    // ...POST it to our worker to upload it...
    const response = await fetch(url, {
      method: 'POST',
      body: file,
    })

    if (!response.ok) {
      throw new Error(`Failed to upload asset: ${response.statusText}`)
    }

    // Return an object with a src property instead of just the URL
    return {
      src: url,
      // Optionally include metadata if you have any
      meta: {}
    }
  },

  // to retrieve an asset, we can just use the same URL
  resolve(asset) {
    return asset.props.src
  },
}