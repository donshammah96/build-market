import { env } from "@/app/lib/infrastructure/env";

export async function verifyHCaptcha(token: string): Promise<boolean> {
  const response = await fetch("https://hcaptcha.com/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `response=${token}&secret=${env.services.hcaptchaSecretKey}`,
  });
  const data = await response.json();
  return data.success;
}
