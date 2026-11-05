import { isAddress } from "viem";
import { fetchXPost } from "@/lib/server";
import { cleanHandle, linkCode } from "@/lib/x";

/**
 * GET /api/x/verify?address=0x..&x=handle&post=123
 * Checks that the public X post `post` was written by @handle and contains this wallet's link code.
 * Only the wallet itself can save `x`/`xPost` on its profile, so a match means the same person
 * controls both the wallet and the X account.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const address = q.get("address") ?? "";
  const handle = cleanHandle(q.get("x") ?? "");
  const post = (q.get("post") ?? "").replace(/\D/g, "");
  if (!isAddress(address) || !handle || !post) return Response.json({ verified: false, reason: "Missing details" }, { status: 400 });
  const p = await fetchXPost(handle, post);
  if (!p) return Response.json({ verified: false, reason: "Couldn't read that post from X right now" }, { headers: { "Cache-Control": "public, max-age=60" } });
  if (p.handle.toLowerCase() !== handle.toLowerCase()) return Response.json({ verified: false, reason: `That post is by @${p.handle}, not @${handle}` });
  if (!p.text.toLowerCase().includes(linkCode(address))) return Response.json({ verified: false, reason: "The post doesn't contain your link code" });
  return Response.json({ verified: true, handle: p.handle, name: p.name }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
