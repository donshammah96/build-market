import crypto from "node:crypto";

type ParsedScryptHash = {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  derived: Buffer;
};

function parseScryptHash(passwordHash: string): ParsedScryptHash | null {
  const parts = passwordHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const derivedHex = parts[5];

  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return null;
  }
  if (!saltHex || !derivedHex) return null;

  return {
    N,
    r,
    p,
    salt: Buffer.from(saltHex, "hex"),
    derived: Buffer.from(derivedHex, "hex"),
  };
}

export async function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  opts: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, opts, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey as Buffer);
    });
  });
}

export async function verifyScryptPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const parsed = parseScryptHash(passwordHash);
  if (!parsed) return false;
  const { N, r, p, salt, derived } = parsed;
  const calc = await scryptAsync(password, salt, derived.length, { N, r, p });
  return crypto.timingSafeEqual(calc, derived);
}

export async function hashPasswordScrypt(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const derived = await scryptAsync(password, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}
