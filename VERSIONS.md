# KipuVault — Versiones Exactas Fijadas

Este documento fija las versiones exactas del stack sin rangos abiertos (`SPEC.md` §1).

| Componente | Versión exacta | Archivo donde se fija |
| --- | --- | --- |
| Rust (`rustc`) | `1.81.0` | `rust-toolchain.toml` |
| Solana CLI (`agave` / `solana`) | `1.18.26` | `Anchor.toml` (`[toolchain]`) |
| Anchor CLI / `anchor-lang` / `anchor-spl` | `0.30.1` | `Anchor.toml`, `programs/kipu_vault/Cargo.toml`, `package.json` |
| Node.js | `26.13.0` | Entorno local / `.nvmrc` |
| npm | `11.20.0` | Entorno local |
| `@coral-xyz/anchor` | `0.30.1` | `package.json` |
| `@solana/web3.js` | `1.98.4` | `package.json` |
| `@solana/spl-token` | `0.4.9` | `package.json` |
| `anchor-bankrun` | `0.5.0` | `package.json` |
| `solana-bankrun` | `0.4.0` | `package.json` |
| Python | `3.12.10` | `backend/requirements.txt` (Fase 2) |
