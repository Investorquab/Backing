import { fetchXPost } from "@/lib/server";
import { parseXPost } from "@/lib/x";

/** GET /api/x/post?url=https://x.com/name/status/123 → the post's author and text, for post cards. */
export async function GET(req: Request) {
  const p = parseXPost(new URL(req.url).searchParams.get("url") ?? "");
  if (!p) return Response.json({ error: "Not an X post link" }, { status: 400 });
  const post = await fetchXPost(p.handle, p.id);
  if (!post) return Response.json({ error: "Couldn't load that post from X right now" }, { status: 502 });
  return Response.json(post, { headers: { "Cache-Control": "public, max-age=600, s-maxage=3600" } });
}
