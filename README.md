# Bitcoin Keeper Signing Server

Source for the Bitcoin Keeper Signing Server. The server provides assisted signing APIs. Its runtime depends on external configuration and services. The unit tests use disposable local identities and do not need production credentials.

The repository retains Inheritance Key routes from an earlier flow. Current Keeper inheritance uses Miniscript wallet rules and does not make Inheritance Key requests to this server.

## Requirements

- Node.js 22 and npm
- Python 3 and [Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) for source checks

## Install and verify

```sh
npm ci --ignore-scripts
npm run compile
npm test
python3 scripts/check-source-secrets.py
python3 scripts/check-source-secrets.py --history
```

The history check requires a full clone with fetched branches and tags. Run `git fetch --all --tags --prune` first when checking a fork. Tests exercise local fixtures; they do not prove live signing or recovery behavior.

## Local configuration

Copy `.env.example` to a local `.env` and supply only disposable development values. `.env` is ignored by Git. The test suite creates its own configuration in `tests/setup-env.ts`; no hosted account is needed to run it. Running the HTTP server requires a compatible database and external services that are not included in this repository. Never commit mnemonics, API keys, service-account files, or environment exports.

## Project layout

- `src/routes/`: HTTP route wiring for signer APIs and retained Inheritance Key endpoints
- `src/services/`: assisted signing, retained Inheritance Key code, mail, and notifications
- `src/wallet/`: wallet and key derivation logic
- `src/utilities/`: cryptography, policy, and service helpers
- `tests/`: isolated unit tests

See [CONTRIBUTING.md](CONTRIBUTING.md) for changes and [SECURITY.md](SECURITY.md) for reporting security issues. The public distribution uses MIT while retaining the ISC notice for inherited code; see [LICENSE](LICENSE), [LICENSE-ISC](LICENSE-ISC), and [NOTICE.md](NOTICE.md).

## Security review boundaries

Operational logs record failure categories without provider/database exception contents, request IDs or database access identifiers. Access logs retain HTTP method, status, response size and elapsed time. Route status codes and the mobile `{ err }` response contract remain unchanged; changing the public error contract needs route-specific mobile compatibility fixtures before hosted adoption.

Use the private reporting channel in SECURITY.md for suspected credential or log exposure. Source and history scans establish only what was scanned in this public repository. A separate hosted system's historical logging and production credential lifecycle require a private operational review; do not put its configuration or real logs in public issues. This repository's review does not authorize hosted deployment.
