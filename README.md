# refaz mobile games — auto-build repo

Three Android games, each in its own folder: `spacebala/`, `neonsnake/`, `quantumascent/`.
GitHub Actions (see `.github/workflows/build-all.yml`) compiles all three into signed
`.aab` (Play upload) + `.apk` (test) files. Download them from the Actions run's Artifacts.

Secrets required (Settings → Secrets and variables → Actions):
`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`.
