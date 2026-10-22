# Source security and dependency review

Reviewed 7 October 2026 with Node 22 and the committed lockfile. This document records source/contributor checks; it is not approval to deploy a hosted backend.

## Runtime dependencies

The lockfile pins patched `proxy-addr` 2.0.8 and `pbkdf2` 3.1.7. BIP39 published vectors and a long-passphrase fixture retain output compatibility. Moment 2.31.0 fixes [GHSA-4p3w-j4w9-5jqw](https://github.com/advisories/GHSA-4p3w-j4w9-5jqw); duration-format fixtures cover the email calls used here.

An explicit override resolves the four transitive UUID copies to CommonJS-compatible `uuid` 11.1.1, the patched version for [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq). The callers in AWS SDK, google-gax, node-cron and teeny-request use `v4()` without a caller-provided buffer. Compatibility tests exercise AWS/Google UUID helpers, cron registration/manual execution and the Google HTTP client's multipart boundary against a loopback server. This avoids changing cloud-client or cron lifecycle APIs merely to update the transitive package. Keep the override visible until those upstream chains support a patched version themselves.

`npm audit --omit=dev --package-lock-only` reports no critical, high or moderate runtime findings after these changes. One low AWS SDK v2 region-validation advisory remains: [GHSA-j965-2qgj-vjmq](https://github.com/advisories/GHSA-j965-2qgj-vjmq). The SES client region here comes from deployment configuration (`SES_REGION`), not request data. Restrict that configuration to the deployment's valid AWS region. Do not follow the audit suggestion to downgrade AWS SDK to v1. Plan the supported AWS SDK v3 migration separately, with a staging SES send/response test and runtime identity review. Unit and local contributor checks do not contact SES or Google Secret Manager.

## HTTP errors and logging

The mobile client consumes the existing `{ err: message }` response from Signing Server routes. Changing all failures to generic text or a new code schema would change verification/signing error behavior. Preserve that response contract in the logging-only change. A future public-error contract should explicitly allow stable expected route errors and sanitize provider/database exceptions, with mobile acceptance fixtures per route before any hosted rollout.

Never put request bodies, seeds, keys, OTPs, access configuration, provider exception contents or real user logs into an issue or PR. Source/history secret scans and synthetic error-canary tests belong in review. Source scans cannot establish what a separate hosted system logged historically; any investigation or credential change must follow the private security process and its production dependencies.

## Contributor verification

Use a fresh public clone, Node 22, `npm ci --ignore-scripts`, `npm run compile`, `npm test`, the runtime audit above, and both current-source and history scans documented in CONTRIBUTING. Tests use generated disposable identities and deny live Secret Manager access. Retain the MIT/ISC notices and SECURITY reporting channel when distributing the source.
