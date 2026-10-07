# Miniscript Coordinator Pattern — Reference Implementation

This directory contains reference material for the coordinator-side Miniscript approach, adapted from [TDH-Labs/Bitme](https://github.com/TDH-Labs/Bitme).

## The Pattern

Hardware wallets that don't natively understand Miniscript (Satochip, TAPSIGNER, Jade, Coldcard) can still participate in Miniscript wallets:

1. **Coordinator** (wallet app) parses the Miniscript descriptor
2. **Coordinator** determines which spending path applies
3. **Coordinator** constructs the PSBT with the correct `witness_script` for that path
4. **Hardware** signs the sighash digest (just a hash — no policy understanding needed)
5. **Coordinator** collects signatures and finalizes

The hardware never needs to understand the policy. It just signs what the coordinator gives it.

## Files

- **`invariants-reference.rs`**: Formal Miniscript invariant tests using rust-miniscript's `entails` algorithm. Proves:
  - No single key can spend alone
  - Intended signer combinations can spend (immediately or after timelock)
  - Timelock boundaries hold exactly (not one block early)
  
  Adapted from Bitme's `bitme-cosigner/src/invariants.rs`. Hardware references generalized from Satochip-specific to generic "hardware".

- **`descriptor-reference.rs`**: Miniscript descriptor construction with BIP389 multipath. Shows the pattern of building descriptors from labeled keys.
  
  Adapted from Bitme's `bitme-cosigner/src/descriptor.rs`. Note: Bitme's specific policy (Hardware+Server as the HOT path) is NOT Keeper's policy — Keeper uses 2-of-3 Mobile + Hardware + Server as the base. This is the *construction pattern*, not the *policy*.

- **`coordinator-pattern.md`**: Excerpt explaining the coordinator flow — how the hardware and server never communicate directly, with the wallet app carrying the PSBT between them.

## What's Next

These are Rust references. For TypeScript implementation in SigningServer, we need to decide:
1. Which JS/TS Miniscript library to use
2. Where the TypeScript port should live (`src/miniscript/` vs `src/wallet/`)
3. Whether invariant tests run in CI or serve as reference

See the PR description for discussion.
