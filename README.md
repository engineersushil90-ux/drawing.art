# webapp-UI

## 18+ gallery and owner access

The age confirmation records the visitor's entered name, email, and access time in `adult-sketch-viewers.json` under `DATA_DIR` (or the local `data/` directory). Configure these environment variables on the API server before enabling the feature:

- `AUTH_SECRET`: a long random secret used to sign access cookies (use at least 32 random characters).
- `ADMIN_EMAIL`: the owner's login email.
- `ADMIN_PASSWORD`: a strong owner login password.
- `DATA_DIR`: a persistent writable directory for JSON records in production. Without persistent storage, the host may discard viewer records when the service restarts or redeploys.

Open `/admin` to sign in and view the recorded access list. The age check is a self-attestation; it does not independently verify the visitor's age or email address.
