# M-Pesa Credential & Certificate Rotation Runbook

**Classification:** Class A Secret Management  
**Last Updated:** 2026-08-31

## Secret Quarantine Boundaries

M-Pesa credentials (`MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_B2C_INITIATOR_PASSWORD`, `MPESA_B2C_CERTIFICATE_PEM`) are **strictly worker-only**. Neither `apps/client` nor `apps/admin` hold these environment variables.

## Rotation Procedure

1. **Consumer Key & Secret Rotation:**
   - Generate new Consumer Key & Secret in Safaricom Developer Portal.
   - Update Secret Manager / environment for `apps/workers`.
   - Perform rolling restart of `apps/workers` daemon.
   - In-memory OAuth token cache in workers will automatically fetch a fresh token on next request.
   - Verify health probe on `http://localhost:18080/healthz`.

2. **STK Passkey Rotation:**
   - Generate new passkey in Safaricom Developer Portal.
   - Update `MPESA_PASSKEY` in worker configuration.
   - Trigger a sandbox smoke transaction to verify password timestamp derivation (`Base64(shortcode + passkey + timestamp)`).

3. **B2C Certificate Rotation:**
   - Obtain updated Safaricom Public Certificate (PEM format).
   - Verify RSA public key with `openssl x509 -in cert.pem -text -noout`.
   - Update `MPESA_B2C_CERTIFICATE_PEM` in worker configuration.
   - Run provider package tests: `pnpm -C packages/mpesa test`.
