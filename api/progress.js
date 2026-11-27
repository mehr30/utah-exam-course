// Stores one JSON progress file per personal key and course in a private Vercel Blob store.
import { put, get } from "@vercel/blob";

const ORIGINS = ["https://mehr30.github.io"];
const KEY = /^[A-Za-z0-9_-]{8,48}$/;
const COURSE = /^(pc|lh)$/;

async function readState(path) {
  try {
    const r = await get(path, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) {
    if (e && e.name === "BlobNotFoundError") return null;
    throw e;
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  const k = String(req.query.k || ""), c = String(req.query.c || "");
  if (!KEY.test(k) || !COURSE.test(c)) return res.status(400).json({ error: "bad key" });
  const path = `progress/${k}-${c}.json`;

  if (req.method === "GET") return res.status(200).json(await readState(path));

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || null);
    if (body.length > 400000) return res.status(413).json({ error: "too large" });
    let incoming;
    try { incoming = JSON.parse(body); } catch { return res.status(400).json({ error: "bad json" }); }
    if (!incoming || incoming.v !== 2 || typeof incoming.u !== "number") return res.status(400).json({ error: "bad state" });
    // An older copy (say, a phone that was offline) never overwrites newer progress; the client adopts this instead.
    const current = await readState(path);
    if (current && (current.u || 0) > incoming.u) return res.status(409).json(current);
    await put(path, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    return res.status(200).json({ ok: true, u: incoming.u });
  }
  return res.status(405).json({ error: "method" });
}
