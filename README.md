# KipuVault — Solana Smart Vault + AI Copilot

Inspirado en el **Quipu** incaico como sistema de registro de tesorería y auditoría, **KipuVault** es una bóveda en **Solana Devnet** donde un agente de IA ejecuta pagos en un token SPL (**Mock USDC**) a partir de lenguaje natural, bajo **guardrails on-chain** impuestos por un programa Rust/Anchor. El hash SHA-256 de cada decisión de la IA viaja dentro de la instrucción `agent_execute` que mueve (o intenta mover) los fondos.

---

## Program ID en Solana Devnet

```text
Program ID (workspace inicial, sincronizar tras anchor keys sync & deploy):
KipuVau1t1111111111111111111111111111111111
```

> Al desplegar desde Codespaces con `anchor build && anchor keys sync && anchor build && anchor deploy --provider.cluster devnet`, actualiza este bloque, `.env` (`KIPU_PROGRAM_ID`, `NEXT_PUBLIC_PROGRAM_ID`) y ejecuta `npm run sync:idl`.

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

1. **Prepara el entorno y compila el programa Anchor** *(en GitHub Codespaces, `.devcontainer/setup.sh` instala Rust `1.81.0`, Solana `1.18.26`, Anchor `0.30.1`, Node y `backend/.venv` automáticamente)*:
   ```bash
   anchor build && anchor keys sync && anchor build
   npm run sync:idl
   anchor test --skip-local-validator
   ```
2. **Despliega en Devnet, aplica Supabase y configura variables de entorno**:
   ```bash
   cp .env.example .env
   # Carga supabase/schema.sql en tu proyecto Supabase y completa .env
   solana airdrop 2 --url devnet
   anchor deploy --provider.cluster devnet
   npm run setup:devnet
   npm run bootstrap:vault
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

- [x] **Programa Anchor (`programs/kipu_vault`)**: `VaultState`, 8 instrucciones, orden determinista 1–11 en `agent_execute`, 14 `KipuError` (`6000`–`6013`), scripts Devnet y 20 tests en `tests/kipu_vault.ts` (`tsc --noEmit` en verde).
- [ ] **Compilación y tests on-chain en Codespaces**: `anchor build` y `anchor test --skip-local-validator` (con `target/idl/kipu_vault.json`).
- [x] **Esquema Supabase (`supabase/schema.sql`) y Backend FastAPI (`backend/`)**: `pytest backend -q` (`28 passed`), `ruff check backend` limpio, `mypy backend/app` limpio.
- [ ] **Postgres/Supabase live**: aplicar `supabase/schema.sql` sobre instancia vacía.
- [x] **Frontend (`frontend/`)**: TopBar, PolicyPanel, KipuCopilot, AuditLedger con tema oscuro/Inca Gold, Wallet Adapter, SIWS y verificación de integridad (`npm run lint && npm run build`).
- [ ] **Guion de demo E2E contra Devnet**: pasos 1–5 tras `anchor deploy --provider.cluster devnet`.
