import { getCloudflareContext } from "@opennextjs/cloudflare";

// Serves product images from R2 through the Worker with long-lived caching.
// Keys are content-addressed (uuid per upload), so immutable is safe.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const objectKey = key.join("/");
  const { env } = getCloudflareContext();
  const object = await env.MEDIA.get(objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      etag: object.httpEtag,
    },
  });
}
