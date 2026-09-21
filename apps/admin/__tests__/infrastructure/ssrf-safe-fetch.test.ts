import { describe, expect, it } from "vitest";
import { validateSsrfTargetUrl } from "@/lib/infrastructure/ssrf-safe-fetch";

describe("SSRF-Safe Outbound Client Governance", () => {
  it("allows valid public HTTPS target URLs", () => {
    const url = validateSsrfTargetUrl("https://api.resend.com/emails");
    expect(url.hostname).toBe("api.resend.com");
  });

  it("blocks localhost and 127.0.0.1 loopback targets", () => {
    expect(() =>
      validateSsrfTargetUrl("http://localhost:8080/internal"),
    ).toThrow(/SSRF Protection/);
    expect(() => validateSsrfTargetUrl("http://127.0.0.1:3000/api")).toThrow(
      /SSRF Protection/,
    );
  });

  it("blocks RFC 1918 private IPv4 ranges", () => {
    expect(() => validateSsrfTargetUrl("http://10.0.0.1/admin")).toThrow(
      /SSRF Protection/,
    );
    expect(() => validateSsrfTargetUrl("http://172.16.0.5/internal")).toThrow(
      /SSRF Protection/,
    );
    expect(() => validateSsrfTargetUrl("http://192.168.1.1/router")).toThrow(
      /SSRF Protection/,
    );
  });

  it("blocks cloud metadata service IP (169.254.169.254)", () => {
    expect(() =>
      validateSsrfTargetUrl("http://169.254.169.254/latest/meta-data/"),
    ).toThrow(/SSRF Protection/);
  });

  it("blocks non-HTTP protocols (e.g. file://, ftp://)", () => {
    expect(() => validateSsrfTargetUrl("file:///etc/passwd")).toThrow(
      /SSRF Protection/,
    );
  });
});
