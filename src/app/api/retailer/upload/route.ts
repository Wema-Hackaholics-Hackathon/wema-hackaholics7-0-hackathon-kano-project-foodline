import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiUser } from "@/lib/session";

// Product photos uploaded by a partner shop. The object lands in R2 and is
// served back through GET /img/<key>, so the form only ever holds a path.

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const retailer = await apiUser("retailer");
  if (!retailer) {
    return Response.json(
      { error: "Your session has ended. Sign in again to upload a photo." },
      { status: 401 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return Response.json({ error: "Choose a photo to upload." }, { status: 400 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return Response.json(
      { error: "That file type is not supported. Use a JPEG, PNG or WebP photo." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "That photo is above 5MB. Take a smaller one, or compress it, then try again." },
      { status: 400 }
    );
  }

  const key = `products/${crypto.randomUUID()}.${ext}`;
  const { env } = getCloudflareContext();
  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return Response.json({ path: `/img/${key}` });
}
