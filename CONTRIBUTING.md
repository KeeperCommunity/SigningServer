# Contributing

Use Node.js 22. Start from a clean checkout and run `npm ci --ignore-scripts`, `npm run compile`, and `npm test`. Before proposing a change, run `python3 scripts/check-source-secrets.py`. The CI workflow runs current-source and full-history checks.

Keep tests self-contained and use generated, disposable identities. Do not require production infrastructure, cloud credentials, or signing keys in a pull request. Never commit `.env` files, private keys, wallet seeds, database exports, production logs, or deployment access. Add tests for changed behavior, especially authorization and signing paths. Document any new local configuration in `.env.example` using names and safe placeholders only.

Open a focused pull request describing the behavior, risks, and verification. Keep dependency changes in the lockfile. If a security issue or suspected credential exposure is involved, follow [SECURITY.md](SECURITY.md) before opening a public issue.
