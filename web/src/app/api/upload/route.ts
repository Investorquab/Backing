import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isAddress } from "viem";
import { put } from "@vercel/blob";
import { clientFor } from "@/lib/server";
import { netFromParam } from "@/lib/networks";

/**
 * POST /api/upload (multipart): file, address, message, signature, net
 * The wallet signs a short message, so only real wallet owners can upload, and every file is
 * stored under the wallet's address. Stored in Vercel Blob when BLOB_READ_WRITE_TOKEN is set
 * (create a Blob store in your Vercel project), or in public/uploads during local development.
 */
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" };

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected a form upload" }, { status: 400 });
  }
  const file = form.get("file");
  const address = String(form.get("address") ?? "");
  // Browsers turn "\n" into "\r\n" inside multipart form fields; undo that so the signed text matches.
  const message = String(form.get("message") ?? "").replace(/\r\n/g, "\n");
  const signature = String(form.get("signature") ?? "") as `0x${string}`;
  const net = netFromParam(String(form.get("net") ?? ""));

  if (!(file instanceof Blob)) return Response.json({ error: "No picture attached" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "Use a JPG, PNG, WebP or GIF" }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Pictures can be up to 4 MB" }, { status: 413 });
  if (!isAddress(address)) return Response.json({ error: "Missing wallet" }, { status: 400 });

  // message: "Backing upload\naddress: 0x...\ntime: <unix seconds>"
  const m = message.match(/^Backing upload\naddress: (0x[0-9a-fA-F]{40})\ntime: (\d+)$/);
  if (!m || m[1].toLowerCase() !== address.toLowerCase()) return Response.json({ error: "Bad signature message" }, { status: 400 });
  if (Math.abs(Date.now() / 1000 - Number(m[2])) > 600) return Response.json({ error: "Signature expired, try again" }, { status: 401 });
  try {
    const ok = await clientFor(net).verifyMessage({ address, message, signature });
    if (!ok) return Response.json({ error: "Signature doesn't match this wallet" }, { status: 401 });
  } catch {
    return Response.json({ error: "Couldn't check the signature" }, { status: 401 });
  }

  const name = `uploads/${address.toLowerCase()}/${Date.now()}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(name, file, { access: "public", contentType: file.type, addRandomSuffix: true });
    return Response.json({ url: blob.url });
  }
  if (process.env.NODE_ENV !== "production") {
    const dest = path.join(process.cwd(), "public", name);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(await file.arrayBuffer()));
    return Response.json({ url: `/${name}` });
  }
  return Response.json({ error: "Picture uploads aren't set up yet. Add a Vercel Blob store to this project" }, { status: 501 });
}
