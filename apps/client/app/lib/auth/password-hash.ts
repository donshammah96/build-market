type PasswordHashModule = {
  hashPasswordScrypt: (password: string) => Promise<string>;
  scryptAsync: (
    password: string,
    salt: Buffer,
    keylen: number,
    opts: { N: number; r: number; p: number },
  ) => Promise<Buffer>;
  verifyScryptPassword: (
    password: string,
    passwordHash: string,
  ) => Promise<boolean>;
};

let passwordHashModulePromise: Promise<PasswordHashModule> | null = null;

// Cloud builds can resolve workspace packages as CJS; this supports both CJS and ESM shapes.
async function loadPasswordHashModule(): Promise<PasswordHashModule> {
  if (passwordHashModulePromise) {
    return passwordHashModulePromise;
  }

  passwordHashModulePromise = (async () => {
    const rawModule = (await import("@build/auth-server/password-hash")) as
      | Partial<PasswordHashModule>
      | {
          default?: Partial<PasswordHashModule>;
        };

    const moduleWithFallback = {
      ...(typeof (rawModule as { default?: unknown }).default === "object"
        ? ((rawModule as { default?: Partial<PasswordHashModule> }).default ??
          {})
        : {}),
      ...(rawModule as Partial<PasswordHashModule>),
    };

    const { hashPasswordScrypt, scryptAsync, verifyScryptPassword } =
      moduleWithFallback;

    if (
      typeof hashPasswordScrypt !== "function" ||
      typeof scryptAsync !== "function" ||
      typeof verifyScryptPassword !== "function"
    ) {
      throw new Error(
        "@build/auth-server/password-hash is missing one or more required exports.",
      );
    }

    return {
      hashPasswordScrypt,
      scryptAsync,
      verifyScryptPassword,
    };
  })();

  return passwordHashModulePromise;
}

export async function hashPasswordScrypt(password: string): Promise<string> {
  const pwModule = await loadPasswordHashModule();
  return pwModule.hashPasswordScrypt(password);
}

export async function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  opts: { N: number; r: number; p: number },
): Promise<Buffer> {
  const pwModule = await loadPasswordHashModule();
  return pwModule.scryptAsync(password, salt, keylen, opts);
}

export async function verifyScryptPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const pwModule = await loadPasswordHashModule();
  return pwModule.verifyScryptPassword(password, passwordHash);
}
