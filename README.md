# KipuVault — Solana Smart Vault + AI Copilot

Inspirado en el **Quipu** incaico como sistema de registro de tesorería y auditoría, **KipuVault** es una bóveda en **Solana Devnet** donde un agente de IA ejecuta pagos en un token SPL (**Mock USDC**) a partir de lenguaje natural, bajo **guardrails on-chain** impuestos por un programa Rust/Anchor. El hash SHA-256 de cada decisión de la IA viaja dentro de la instrucción `agent_execute` que mueve (o intenta mover) los fondos.

---

## Program ID en Solana Devnet

```text
Program ID (desplegado en Solana Devnet):
EVPQDCiHnR47n7PKGw1nUD4dRm3ALN4AZrxgxj2kUfSx
```

- **Explorer Devnet:** https://explorer.solana.com/address/EVPQDCiHnR47n7PKGw1nUD4dRm3ALN4AZrxgxj2kUfSx?cluster=devnet
- **Bóveda inicializada (`bootstrap:vault`):** `8w7zQQupP3qnPod7juUzwr8xvrrVKa7qsH45d5yk3fTS` (Mock USDC mint: `J133Fwmo6WbCHE49vhTGeWxLLguoFotnKfeRUzcTzDxk`)
- *(Para redesplegar o re-sincronizar IDL tras cambios en Rust, ejecuta `npm run deploy:devnet` y actualiza `.env` / `frontend/.env.local`).*

---

## Arquitectura

```text
+-------------------------------------------------------------------------+
|                    FRONTEND (Next.js + Tailwind + Wallet)               |
|  TopBar (SIWS + Freeze) | PolicyPanel (onAccountChange) | Copilot | Log |
+----------------------+---------------------------------+----------------+
                       | HTTPS (JWT HS256 / REST)        | Firma directa
                       v                                 | (Phantom/Solflare)
+--------------------------------------------------+     |
|                 BACKEND (FastAPI)                |     |
|  - Auth SIWS (PyNaCl + auth_nonces single-use)   |     |
|  - LLMClient (Anthropic / Google, temp=0)        |     |
|  - Evidencia canónica + SHA-256 (sin float)      |     |
|  - Modo standard (preflight) y red_team (skip)   |     |
|  - /api/audit/verify/{tx} (público)              |     |
+-----------+---------------------------+----------+     |
            | Service Role              | Agent Keypair  |
            v                           v                v
+-----------------------+   +---------------------------------------------+
|  SUPABASE (Postgres)  |   |            SOLANA DEVNET (Anchor)           |
|  - audit_logs         |   |  Programa: kipu_vault (8 instrucciones)     |
|    (append-only trig) |   |  - VaultState PDA [b"kipu_vault",owner,mint]|
|  - auth_nonces (RLS)  |   |  - Guardrails on-chain + KipuAuditEvent     |
+-----------------------+   +---------------------------------------------+
```

---

## Instalación en 3 pasos (Codespaces o local)

1. **Prepara el entorno y compila el programa Anchor** *(en GitHub Codespaces / Ubuntu 24.04, `.devcontainer/setup.sh` instala Rust `1.89.0`, Agave `4.1.2` + `cargo-build-sbf 4.1.0`, Anchor `1.2.1`, Node `22` LTS y `backend/.venv` automáticamente)*:
   ```bash
   anchor build && anchor keys sync && anchor build
   npm run sync:idl
   anchor test --skip-local-validator --skip-deploy --skip-build
   ```
2. **Despliega en Devnet, aplica Supabase y configura variables de entorno** *(ver guía completa paso a paso en [DEPLOY.md](DEPLOY.md))*:
   ```bash
   npm run deploy:devnet
   npm run setup:devnet
   npm run bootstrap:vault
   cp .env.example .env
   cp frontend/.env.example frontend/.env.local
   # Carga supabase/schema.sql en tu proyecto Supabase y completa .env + frontend/.env.local
   ```
3. **Levanta Backend + Frontend**:
   ```bash
   ./backend/.venv/bin/uvicorn app.main:app --app-dir backend --reload --port 8000
   cd frontend && npm run dev
   ```

---

## Qué garantiza y qué no

### Lo que el programa garantiza aunque el backend y el LLM estén totalmente comprometidos
- Ningún pago supera `max_per_tx` ni acumula más de `daily_limit` en la ventana de 24 h.
- Solo se paga a destinatarios de la allowlist (`allowed_recipients`) definida por el `owner`.
- Con `is_frozen == true` el agente no mueve nada (`VaultFrozen`).
- El `owner` siempre puede retirar (`withdraw`), incluso con la bóveda congelada.

### Lo que NO garantiza
- **No garantiza que la decisión de la IA sea correcta: limita el radio de daño.**
- `decision_hash` es una atestación de auditoría. El programa acepta cualquier `[u8; 32]` distinto de cero y no verifica su contenido semántico on-chain.
- La ventana de 24 h es fija (`window_start`): en el borde de la ventana se puede gastar hasta `2× daily_limit`.

---

## Modelo de amenazas

| Vector de amenaza | Impacto y defensa en KipuVault |
| --- | --- |
| **LLM comprometido (prompt injection)** | Puede intentar generar montos altos o destinatarios arbitrarios; los guardrails on-chain bloquean montos sobre `max_per_tx`/`daily_limit` y direcciones fuera de la allowlist. |
| **Backend comprometido** | Incluso si el backend ignora filtros y fuerza transacciones (`red_team`), el programa en Solana rechaza cualquier exceso o destinatario no autorizado y solo acepta firmas del `agent` dentro de política. |
| **Clave del agente filtrada (`AGENT_KEYPAIR_B58`)** | El atacante queda acotado a los topes por tx/diario y a las cuentas de la allowlist; el `owner` puede revocar al instante con `emergency_freeze(true)` o `update_policy(new_agent)`. |
| **Destinatario malicioso ya en la allowlist** | Si el `owner` aprobó previamente un destinatario malicioso, el agente puede enviarle hasta `daily_limit` (o `2×` en cruce de ventana); el `owner` debe auditar y usar `remove_recipient`. |
| **Clave del owner comprometida** | **Fuera de alcance**: el `owner` controla `withdraw`, `update_policy`, `add_recipient` y `emergency_freeze`. |

---

## Limitaciones conocidas

1. **Ventana fija de 24 h**: reinicia `spent_today` cuando `now - window_start >= 86400`, permitiendo hasta `2× daily_limit` en el borde de la ventana.
2. **Máximo 8 destinatarios**: `allowed_recipients` es un arreglo fijo `[Pubkey; 8]` dentro de `VaultState`.
3. **Solo SPL Token clásico**: utiliza `transfer_checked` con `Tokenkeg...`; Token-2022 queda fuera de alcance.
4. **El agente paga las fees**: el `agent` cubre el fee de transacción y la creación idempotente de ATAs destino (con alerta en `/api/health` si baja de `0.05 SOL`).
5. **Hash no verificado semánticamente on-chain**: la integridad off-chain ↔ on-chain se verifica en `/api/audit/verify/{tx_signature}` comparando `canonical_json` contra la data de la instrucción `agent_execute`.

---

## ¿Por qué no Squads Spending Limits?

Squads es infraestructura multisig de propósito general y complementaria; **KipuVault** aporta la capa de intención en lenguaje natural, allowlist y freeze pensados para agentes autónomos, y un ancla de auditoría (`decision_hash` sobre JSON canónico) verificable públicamente por cualquiera.

---

## Checklist de verificación (`SPEC.md` §1 y §9)

- [x] **Programa Anchor y 20 tests LiteSVM (`programs/kipu_vault`, `tests/kipu_vault.ts`)**: `VaultState`, 8 instrucciones, orden determinista 1–11 en `agent_execute`, 14 `KipuError` (`6000`–`6013`); `anchor build`, `anchor keys sync`, `target/idl/kipu_vault.json` y `20 passing` verificados en CI (GitHub Actions run `45415264328`).
- [x] **Esquema SQL sobre Postgres vacío y Backend FastAPI (`supabase/schema.sql`, `backend/`)**: `supabase/schema.sql` verificado sobre Postgres 16 vacío en CI; `pytest backend -q` (`31 passed`), `ruff check backend` limpio, `mypy backend/app` limpio.
- [x] **Frontend (`frontend/`)**: TopBar, PolicyPanel, KipuCopilot, AuditLedger con tema oscuro/Inca Gold, Wallet Adapter, SIWS y verificación de integridad (`npm run lint && npm run build` y Docker builds en verde en CI).
- [x] **Despliegue en Solana Devnet y Program ID definitivo**: desplegado en Devnet (`EVPQDCiHnR47n7PKGw1nUD4dRm3ALN4AZrxgxj2kUfSx`), IDL sincronizado en `frontend/src/idl/kipu_vault.json`, Mock USDC creado (`setup:devnet`) y bóveda inicializada (`bootstrap:vault`) con `100.00 Mock USDC`.
- [ ] **Instancia real de Supabase y `.env`**: esquema `supabase/schema.sql` aplicado y verificado en `kipu-vault` (`https://gnutupmixhkgrskpdras.supabase.co`); resta completar `.env` (`SUPABASE_SERVICE_ROLE_KEY`, `AGENT_KEYPAIR_B58` y API key del LLM) y `frontend/.env.local`.
- [ ] **Guion de demo E2E contra Devnet**: recorrer pasos 1–5 de `SPEC.md` §2 con Phantom, FastAPI, Next.js y Supabase live.
