import { NextResponse } from "next/server";
import { edgeEnv } from "@/app/lib/infrastructure/edge-env";
import { env } from "@/app/lib/infrastructure/env";

function sha256Digest(str: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const bytes = new TextEncoder().encode(str);
  const bitLength = bytes.length * 8;
  const hash = new Uint32Array(8);
  const k = new Uint32Array(64);
  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = candidate * candidate; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) >>> 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) >>> 0;
      primeCounter++;
    }
  }

  const paddedLength = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const words = new Uint32Array(paddedLength >> 2);
  for (let i = 0; i < paddedLength; i++) {
    const byte = padded[i] ?? 0;
    const currentWord = words[i >> 2] ?? 0;
    words[i >> 2] = (currentWord | (byte << ((3 - (i % 4)) * 8))) >>> 0;
  }
  words[words.length - 2] = Math.floor(bitLength / maxWord) >>> 0;
  words[words.length - 1] = bitLength >>> 0;

  const w = new Uint32Array(64);
  for (let j = 0; j < words.length; j += 16) {
    for (let i = 0; i < 16; i++) {
      w[i] = words[j + i] ?? 0;
    }
    const h0 = hash[0] ?? 0;
    const h1 = hash[1] ?? 0;
    const h2 = hash[2] ?? 0;
    const h3 = hash[3] ?? 0;
    const h4 = hash[4] ?? 0;
    const h5 = hash[5] ?? 0;
    const h6 = hash[6] ?? 0;
    const h7 = hash[7] ?? 0;

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      if (i >= 16) {
        const w15 = w[i - 15] ?? 0;
        const w2 = w[i - 2] ?? 0;
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
      }
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + (k[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (h0 + a) >>> 0;
    hash[1] = (h1 + b) >>> 0;
    hash[2] = (h2 + c) >>> 0;
    hash[3] = (h3 + d) >>> 0;
    hash[4] = (h4 + e) >>> 0;
    hash[5] = (h5 + f) >>> 0;
    hash[6] = (h6 + g) >>> 0;
    hash[7] = (h7 + h) >>> 0;
  }

  let result = "";
  for (let i = 0; i < 8; i++) {
    result += (hash[i] ?? 0).toString(16).padStart(8, "0");
  }
  return result;
}

/**
 * Edge-compatible constant-time string comparison to prevent timing attacks.
 * Hashes inputs with SHA-256 before comparing 64-character digests with XOR accumulator,
 * ensuring no secret length or prefix leakage.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const hashA = sha256Digest(a);
  const hashB = sha256Digest(b);
  let result = 0;
  for (let i = 0; i < hashA.length; i++) {
    result |= hashA.charCodeAt(i) ^ hashB.charCodeAt(i);
  }
  return result === 0;
}

export function ensureValidInternalSecret(receivedSecret: string | null) {
  const expectedSecret =
    edgeEnv.internalServiceSecret ||
    edgeEnv.internalApiSecret ||
    env.services?.internalApiSecret;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Internal API secret is not configured" },
      { status: 503 },
    );
  }

  if (!receivedSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!timingSafeEqualStrings(receivedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
