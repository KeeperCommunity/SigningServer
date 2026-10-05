# Bitcoin Keeper Signing Server

Source for the Bitcoin Keeper Signing Server. The server handles assisted signing and inheritance requests. Its runtime depends on external configuration and services. The unit tests use disposable local identities and do not need production credentials.

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

The history check requires a full clone with fetched branches and tags. Run `git fetch --all --tags --prune` first when checking a fork. Tests exercise local fixtures; they do not prove live signing, recovery, or inheritance behavior.

## Local configuration

Copy `.env.example` to a local `.env` and supply only disposable development values. `.env` is ignored by Git. The test suite creates its own configuration in `tests/setup-env.ts`; no hosted account is needed to run it. Running the HTTP server requires a compatible database and external services that are not included in this repository. Never commit mnemonics, API keys, service-account files, or environment exports.

## Project layout

- `src/routes/`: HTTP route wiring for signer and inheritance endpoints
- `src/services/`: assisted signing, inheritance, mail, and notifications
- `src/wallet/`: wallet and key derivation logic
- `src/utilities/`: cryptography, policy, and service helpers
- `tests/`: isolated unit tests

See [CONTRIBUTING.md](CONTRIBUTING.md) for changes and [SECURITY.md](SECURITY.md) for reporting security issues. The public distribution uses MIT while retaining the ISC notice for inherited code; see [LICENSE](LICENSE), [LICENSE-ISC](LICENSE-ISC), and [NOTICE.md](NOTICE.md).
