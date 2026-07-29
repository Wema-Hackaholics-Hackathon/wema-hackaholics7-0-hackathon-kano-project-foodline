import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const admin = await apiUser("admin");
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return Response.json({ error: "Choose an image file to upload." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return Response.json(
      { error: "That file type is not supported. Use JPEG, PNG or WebP." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "That image is above 5MB. Compress it and try again." },
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
