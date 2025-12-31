import crypto from "crypto";
import { ROOM_CODE_LENGTH } from "./constants";

const ROOM_PASS_SALT = process.env.ROOM_PASSWORD_SALT || "dev-salt";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = ROOM_CODE_LENGTH) {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function hashPassword(password: string) {
  return crypto
    .createHash("sha256")
    .update(`${ROOM_PASS_SALT}:${password}`)
    .digest("hex");
}

export function verifyPassword(password: string, hash: string) {
  if (!password || !hash) return false;
  return hashPassword(password) === hash;
}

export function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function toBase64(input: ArrayBuffer) {
  return Buffer.from(input).toString("base64");
}

export function cleanText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}
