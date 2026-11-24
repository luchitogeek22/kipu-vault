# KipuVault — Versiones Exactas Fijadas

Este documento fija las versiones exactas del stack sin rangos abiertos (`SPEC.md` §1).

| Componente | Versión exacta | Archivo donde se fija |
| --- | --- | --- |
| Rust (`rustc`) | `1.89.0` | `rust-toolchain.toml`, `.devcontainer/devcontainer.json`, `.github/workflows/ci.yml` |
| Solana / Agave CLI (`agave`) | `4.1.2` | `Anchor.toml`, `.devcontainer/setup.sh`, `.github/workflows/ci.yml` |
| `cargo-build-sbf` | `4.1.0` | `.devcontainer/setup.sh`, `.github/workflows/ci.yml` |
| Anchor CLI / `anchor-lang` / `anchor-spl` | `1.2.1` | `Anchor.toml`, `programs/kipu_vault/Cargo.toml`, `.devcontainer/setup.sh`, `.github/workflows/ci.yml` |
| Node.js (Windows local / CI & Codespaces) | `22` LTS (`>= 20.18`) | `.github/workflows/ci.yml`, `.devcontainer/devcontainer.json` |
| `@anchor-lang/core` | `1.2.1` | `package.json`, `frontend/package.json` |
| `@solana/web3.js` (raíz / frontend) | `1.98.4` / `1.99.0` | `package.json`, `frontend/package.json` |
| `@solana/spl-token` | `0.4.9` | `package.json`, `frontend/package.json` |
| `litesvm` / `anchor-litesvm` | `1.6.2` / `0.2.1` | `package.json` |
| Next.js / React / Tailwind | `15.5.29` / `19.1.0` / `3.4.17` | `frontend/package.json` |
| Python | `3.12.10` | `backend/requirements.txt` (entorno local / Codespaces `3.12`) |
| FastAPI / Pydantic / Uvicorn | `0.165.0` / `2.14.4` / `0.54.0` | `backend/requirements.txt` |
| PyNaCl / PyJWT / SlowAPI | `1.6.2` / `2.15.1` / `0.1.10` | `backend/requirements.txt` |
| `solders` / `solana` (Python) | `0.29.0` / `0.42.0` | `backend/requirements.txt` |
| `pytest` / `ruff` / `mypy` | `9.2.0` / `0.17.6` / `2.4.1` | `backend/requirements.txt` |
