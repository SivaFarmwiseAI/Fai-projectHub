import { createHash } from "crypto";

const SALT = "projecthub_salt_2024";

export function hashPassword(password: string): string {
  return createHash("sha256").update(password + SALT).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Lightweight session token: base64(userId:email:timestamp)
// Not cryptographically signed — suitable for internal demo.
// For production, replace with JWT using jose or similar.
export function createSessionToken(userId: string, email: string): string {
  const payload = `${userId}:${email}:${Date.now()}`;
  return Buffer.from(payload).toString("base64");
}

export function parseSessionToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [userId, email] = decoded.split(":");
    if (!userId || !email) return null;
    return { userId, email };
  } catch {
    return null;
  }
}
