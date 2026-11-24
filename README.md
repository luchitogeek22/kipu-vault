# KipuVault — Solana Smart Vault + AI Copilot

Inspirado en el **Quipu** incaico como sistema de registro y auditoría de tesorería, **KipuVault** es una bóveda en **Solana Devnet** donde un agente de IA ejecuta pagos en token SPL (Mock USDC) a partir de lenguaje natural, bajo **guardrails on-chain** impuestos por un programa Rust/Anchor que **limita el radio de daño** incluso si el backend o el LLM resultan comprometidos.

## Qué garantiza on-chain y qué no

**Garantías impuestas por el programa Anchor (`programs/kipu_vault`)**:
- Ningún pago supera `max_per_tx` ni acumula más de `daily_limit` dentro de la ventana fija de 24 h.
- Solo se transfiere a destinatarios presentes en `allowed_recipients` definidos por el `owner`.
- Con `is_frozen == true` (`Emergency Freeze`), el agente no puede mover fondos (`VaultFrozen`).
- El `owner` siempre puede retirar fondos (`withdraw`), incluso con la bóveda congelada.

**Lo que NO garantiza**:
- No garantiza que la decisión semántica de la IA sea correcta; limita el radio de daño.
- `decision_hash` es una atestación de auditoría anclada en la instrucción (`[u8; 32]` distinto de cero); el programa no verifica su contenido semántico on-chain.
- La ventana de 24 h es fija (`window_start`), por lo que en el borde del cambio de ventana se puede gastar hasta `2× daily_limit`.

## Estructura actual del repositorio

- `programs/kipu_vault/` — Programa Rust / Anchor `0.30.1` (`VaultState`, 8 instrucciones, 14 `KipuError`).
- `tests/kipu_vault.ts` — 20 tests deterministas con `anchor-bankrun` (incluyendo manipulación de reloj).
- `scripts/` — Scripts idempotentes para Mock USDC (`setup_devnet_usdc.ts`) e inicialización (`bootstrap_vault.ts`).
- `supabase/schema.sql` — Esquema append-only (`audit_logs`, trigger de inmutabilidad, `auth_nonces`, RLS).
- `backend/` — API FastAPI (auth SIWS Ed25519 + JWT HS256, `/api/agent/execute-intent` en modos `standard`/`red_team`, `/api/audit/verify/{tx}`, `LLMClient`).
- `.devcontainer/` — Configuración lista para **GitHub Codespaces** (Ubuntu 22.04, Rust `1.81.0`, Solana CLI `1.18.26`, Anchor `0.30.1`, Node `22`, Python `3.12`).

## Uso en GitHub Codespaces

1. Abre el repositorio en **GitHub Codespaces** (`Code → Codespaces → Create codespace on main`).
   El `.devcontainer/setup.sh` instala automáticamente Solana CLI `1.18.26`, Anchor `0.30.1`, dependencias Node y `backend/.venv`.
2. Compila, sincroniza el `Program ID` y ejecuta los 20 tests de Anchor:
   ```bash
   anchor build
   anchor keys sync
   anchor build
   anchor test --skip-local-validator
   ```
3. Despliegue a Solana Devnet y bootstrap de bóveda:
   ```bash
   solana airdrop 2 --url devnet
   anchor deploy --provider.cluster devnet
   npm run setup:devnet
   npm run bootstrap:vault
   ```
4. Verificación del backend FastAPI:
   ```bash
   ./backend/.venv/bin/pytest backend -q
   ./backend/.venv/bin/ruff check backend
   ./backend/.venv/bin/mypy --config-file backend/pyproject.toml backend/app
   ```
