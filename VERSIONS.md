# KipuVault — Versiones Exactas Fijadas

Este documento fija las versiones exactas del stack sin rangos abiertos (`SPEC.md` §1).

| Componente | Versión exacta | Archivo donde se fija |
| --- | --- | --- |
| Rust (`rustc`) | `1.79.0` | `rust-toolchain.toml`, `.devcontainer/devcontainer.json` |
| Solana CLI (`agave` / `solana`) | `1.18.26` | `Anchor.toml`, `.devcontainer/setup.sh` |
| Anchor CLI / `anchor-lang` / `anchor-spl` | `0.30.1` | `Anchor.toml`, `programs/kipu_vault/Cargo.toml`, `package.json`, `frontend/package.json` |
| Node.js (Windows local / Codespaces) | `26.13.0` / `22` | Entorno local / `.devcontainer/devcontainer.json` |
| npm | `11.20.0` | Entorno local |
| `@coral-xyz/anchor` | `0.30.1` | `package.json`, `frontend/package.json` |
| `@solana/web3.js` (raíz / frontend) | `1.98.4` / `1.99.0` | `package.json`, `frontend/package.json` |
| `@solana/spl-token` | `0.4.9` | `package.json`, `frontend/package.json` |
| `anchor-bankrun` / `solana-bankrun` | `0.5.0` / `0.4.0` | `package.json` |
| Next.js / React / Tailwind | `15.5.29` / `19.1.0` / `3.4.17` | `frontend/package.json` |
| Python | `3.12.10` | `backend/requirements.txt` (entorno local / Codespaces `3.12`) |
| FastAPI / Pydantic / Uvicorn | `0.165.0` / `2.14.4` / `0.54.0` | `backend/requirements.txt` |
| PyNaCl / PyJWT / SlowAPI | `1.6.2` / `2.15.1` / `0.1.10` | `backend/requirements.txt` |
| `solders` / `solana` (Python) | `0.29.0` / `0.42.0` | `backend/requirements.txt` |
| `pytest` / `ruff` / `mypy` | `9.2.0` / `0.17.6` / `2.4.1` | `backend/requirements.txt` |
