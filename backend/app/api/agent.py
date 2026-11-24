"""Agent payment intent execution endpoint (/api/agent/execute-intent)."""

from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import (
    get_idl_registry,
    get_llm_client,
    get_repository,
    get_solana_client,
)
from app.core.config import Settings, get_settings
from app.core.idl import KipuIdlRegistry, explain_error_es
from app.core.security import AuthenticatedUser, get_current_user, limiter, validate_solana_pubkey
from app.schemas.agent import ExecuteIntentRequest, ExecuteIntentResponse
from app.services.canonical import (
    build_canonical_evidence,
    format_base_units_as_usdc,
    parse_usdc_amount,
)
from app.services.llm import LLMClient, LLMParseError
from app.services.solana_vault import SolanaVaultClient
from app.services.supabase_repo import AuditRepository

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/execute-intent", response_model=ExecuteIntentResponse)
@limiter.limit("10/minute")
async def execute_intent(
    request: Request,
    body: ExecuteIntentRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    repo: AuditRepository = Depends(get_repository),
    solana: SolanaVaultClient = Depends(get_solana_client),
    llm: LLMClient = Depends(get_llm_client),
    idl_registry: KipuIdlRegistry = Depends(get_idl_registry),
) -> ExecuteIntentResponse:
    """Parse intent, enforce pre-flight gates, anchor decision hash, and execute."""
    if (body.mode == "red_team" or body.forced_intent is not None) and not settings.kipu_demo_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El modo red_team y forced_intent solo están permitidos con KIPU_DEMO_MODE=true",
        )

    validate_solana_pubkey(body.vault_address)

    try:
        vault_state = await solana.fetch_vault_state(body.vault_address)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bóveda no encontrada on-chain: {exc}",
        ) from exc

    # Owner siempre viene del JWT, nunca del request body
    if vault_state.owner != user.wallet:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario autenticado no es el propietario (vault.owner) de esta bóveda",
        )

    max_per_tx_usdc = format_base_units_as_usdc(vault_state.max_per_tx)
    daily_limit_usdc = format_base_units_as_usdc(vault_state.daily_limit)

    recipient_address = ""
    amount_base_units = 0
    amount_usdc_str = "0.000000"
    reasoning = ""
    risk_score = 0
    risk_flags: list[str] = []

    if body.mode == "red_team":
        if body.forced_intent is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="forced_intent es obligatorio en modo red_team",
            )
        validate_solana_pubkey(body.forced_intent.recipient_address)
        recipient_address = body.forced_intent.recipient_address
        quantized, amount_base_units = parse_usdc_amount(body.forced_intent.amount_usdc)
        amount_usdc_str = f"{quantized:.6f}"
        reasoning = "Modo Red-Team: simulación de LLM comprometido usando forced_intent."
        risk_score = 100
        risk_flags = ["instruction_override", "red_team_simulated"]
    else:
        try:
            parsed = await llm.parse_intent(body.prompt)
        except LLMParseError as exc:
            nonce = str(uuid4())
            evidence = build_canonical_evidence(
                vault_address=body.vault_address,
                owner=vault_state.owner,
                agent=vault_state.agent,
                mint=vault_state.mint,
                prompt=body.prompt,
                recipient_address="",
                amount_base_units=0,
                amount_usdc="0.000000",
                reasoning=f"Error de parseo estructurado del LLM: {exc}",
                risk_score=100,
                risk_flags=["llm_parse_error"],
                mode="standard",
                nonce=nonce,
            )
            audit_row = await repo.insert_audit_log(
                nonce=nonce,
                vault_address=body.vault_address,
                owner_wallet=user.wallet,
                mode="standard",
                status="REJECTED_BY_AI",
                canonical_json=evidence.canonical_json,
                decision_hash=evidence.decision_hash_hex,
                recipient_address=None,
                amount_base_units="0",
            )
            return ExecuteIntentResponse(
                status="REJECTED_BY_AI",
                audit_id=audit_row.id,
                decision_hash=evidence.decision_hash_hex,
                guardrail_triggered=False,
                explanation_es=(
                    "El copiloto de IA no pudo generar una intención válida tras reintentar."
                ),
                risk_score=100,
                risk_flags=["llm_parse_error"],
            )

        reasoning = parsed.reasoning
        risk_score = parsed.risk_score
        risk_flags = list(parsed.risk_flags)

        if parsed.recipient_address:
            try:
                validate_solana_pubkey(parsed.recipient_address)
                recipient_address = parsed.recipient_address
            except HTTPException:
                recipient_address = ""

        if parsed.amount_usdc is not None:
            try:
                quantized, amount_base_units = parse_usdc_amount(parsed.amount_usdc)
                amount_usdc_str = f"{quantized:.6f}"
            except ValueError:
                amount_base_units = 0
                amount_usdc_str = "0.000000"

        if recipient_address:
            if not await solana.has_recipient_history(recipient_address):
                if "recipient_no_history" not in risk_flags:
                    risk_flags.append("recipient_no_history")
            if recipient_address not in vault_state.allowed_recipients:
                if "new_recipient" not in risk_flags:
                    risk_flags.append("new_recipient")

        # Gate estándar de IA
        if (
            parsed.action != "transfer"
            or not recipient_address
            or amount_base_units <= 0
            or risk_score >= settings.risk_block_threshold
        ):
            nonce = str(uuid4())
            evidence = build_canonical_evidence(
                vault_address=body.vault_address,
                owner=vault_state.owner,
                agent=vault_state.agent,
                mint=vault_state.mint,
                prompt=body.prompt,
                recipient_address=recipient_address,
                amount_base_units=amount_base_units,
                amount_usdc=amount_usdc_str,
                reasoning=reasoning,
                risk_score=risk_score,
                risk_flags=risk_flags,
                mode="standard",
                nonce=nonce,
            )
            audit_row = await repo.insert_audit_log(
                nonce=nonce,
                vault_address=body.vault_address,
                owner_wallet=user.wallet,
                mode="standard",
                status="REJECTED_BY_AI",
                canonical_json=evidence.canonical_json,
                decision_hash=evidence.decision_hash_hex,
                recipient_address=recipient_address or None,
                amount_base_units=str(amount_base_units),
            )
            return ExecuteIntentResponse(
                status="REJECTED_BY_AI",
                audit_id=audit_row.id,
                decision_hash=evidence.decision_hash_hex,
                guardrail_triggered=False,
                explanation_es=(
                    f"Solicitud bloqueada por el filtro de IA "
                    f"(risk_score={risk_score}): {reasoning}"
                ),
                risk_score=risk_score,
                risk_flags=risk_flags,
                recipient_address=recipient_address or None,
                amount_usdc=amount_usdc_str if amount_base_units > 0 else None,
            )

        # Gate allowlist on-chain en modo standard
        if recipient_address not in vault_state.allowed_recipients:
            nonce = str(uuid4())
            evidence = build_canonical_evidence(
                vault_address=body.vault_address,
                owner=vault_state.owner,
                agent=vault_state.agent,
                mint=vault_state.mint,
                prompt=body.prompt,
                recipient_address=recipient_address,
                amount_base_units=amount_base_units,
                amount_usdc=amount_usdc_str,
                reasoning=reasoning,
                risk_score=risk_score,
                risk_flags=risk_flags,
                mode="standard",
                nonce=nonce,
            )
            audit_row = await repo.insert_audit_log(
                nonce=nonce,
                vault_address=body.vault_address,
                owner_wallet=user.wallet,
                mode="standard",
                status="NEEDS_RECIPIENT_APPROVAL",
                canonical_json=evidence.canonical_json,
                decision_hash=evidence.decision_hash_hex,
                recipient_address=recipient_address,
                amount_base_units=str(amount_base_units),
            )
            return ExecuteIntentResponse(
                status="NEEDS_RECIPIENT_APPROVAL",
                audit_id=audit_row.id,
                decision_hash=evidence.decision_hash_hex,
                guardrail_triggered=False,
                explanation_es=(
                    f"El destinatario {recipient_address} aún no está en la allowlist. "
                    "Firma add_recipient con tu wallet para autorizarlo."
                ),
                risk_score=risk_score,
                risk_flags=risk_flags,
                recipient_address=recipient_address,
                amount_usdc=amount_usdc_str,
            )

    # Paso 5: Evidencia canónica + inserción PENDING
    nonce = str(uuid4())
    evidence = build_canonical_evidence(
        vault_address=body.vault_address,
        owner=vault_state.owner,
        agent=vault_state.agent,
        mint=vault_state.mint,
        prompt=body.prompt,
        recipient_address=recipient_address,
        amount_base_units=amount_base_units,
        amount_usdc=amount_usdc_str,
        reasoning=reasoning,
        risk_score=risk_score,
        risk_flags=risk_flags,
        mode=body.mode,
        nonce=nonce,
    )
    pending_row = await repo.insert_audit_log(
        nonce=nonce,
        vault_address=body.vault_address,
        owner_wallet=user.wallet,
        mode=body.mode,
        status="PENDING",
        canonical_json=evidence.canonical_json,
        decision_hash=evidence.decision_hash_hex,
        recipient_address=recipient_address,
        amount_base_units=str(amount_base_units),
    )

    # Paso 6: Construir y firmar transacción del agente
    try:
        tx_b64 = await solana.build_signed_agent_execute_tx(
            vault_address=body.vault_address,
            vault_state=vault_state,
            recipient_address=recipient_address,
            amount_base_units=amount_base_units,
            decision_hash_bytes=evidence.decision_hash_bytes,
        )
    except Exception as exc:
        await repo.update_audit_status(
            audit_id=pending_row.id,
            from_status="PENDING",
            to_status="FAILED_INFRA",
            error_name="TxBuildError",
            sim_logs=[str(exc)],
        )
        return ExecuteIntentResponse(
            status="FAILED_INFRA",
            audit_id=pending_row.id,
            decision_hash=evidence.decision_hash_hex,
            guardrail_triggered=False,
            explanation_es=f"Fallo de infraestructura construyendo la transacción: {exc}",
            risk_score=risk_score,
            risk_flags=risk_flags,
            recipient_address=recipient_address,
            amount_usdc=amount_usdc_str,
        )

    # Paso 7: Simular primero (simulateTransaction)
    sim = await solana.simulate_transaction(tx_b64)
    if sim.ok:
        send_res = await solana.send_and_confirm_transaction(tx_b64, skip_preflight=False)
        if send_res.succeeded and send_res.tx_signature:
            await repo.update_audit_status(
                audit_id=pending_row.id,
                from_status="PENDING",
                to_status="EXECUTED",
                tx_signature=send_res.tx_signature,
            )
            return ExecuteIntentResponse(
                status="EXECUTED",
                audit_id=pending_row.id,
                decision_hash=evidence.decision_hash_hex,
                tx_signature=send_res.tx_signature,
                guardrail_triggered=False,
                explanation_es=(
                    f"Pago ejecutado on-chain: {amount_usdc_str} USDC hacia {recipient_address}."
                ),
                risk_score=risk_score,
                risk_flags=risk_flags,
                recipient_address=recipient_address,
                amount_usdc=amount_usdc_str,
            )

        if send_res.error_code is not None and send_res.tx_signature:
            idl_entry = idl_registry.lookup_error(send_res.error_code)
            err_name = idl_entry.name if idl_entry else send_res.error_name
            explanation = explain_error_es(
                err_name,
                amount_usdc=amount_usdc_str,
                max_per_tx_usdc=max_per_tx_usdc,
                daily_limit_usdc=daily_limit_usdc,
                recipient_address=recipient_address,
                idl_msg=idl_entry.msg if idl_entry else None,
            )
            await repo.update_audit_status(
                audit_id=pending_row.id,
                from_status="PENDING",
                to_status="BLOCKED_ONCHAIN",
                tx_signature=send_res.tx_signature,
                error_code=send_res.error_code,
                error_name=err_name,
                sim_logs=send_res.logs,
            )
            return ExecuteIntentResponse(
                status="BLOCKED_ONCHAIN",
                audit_id=pending_row.id,
                decision_hash=evidence.decision_hash_hex,
                tx_signature=send_res.tx_signature,
                error_code=send_res.error_code,
                error_name=err_name,
                guardrail_triggered=True,
                explanation_es=explanation,
                risk_score=risk_score,
                risk_flags=risk_flags,
                recipient_address=recipient_address,
                amount_usdc=amount_usdc_str,
            )

        await repo.update_audit_status(
            audit_id=pending_row.id,
            from_status="PENDING",
            to_status="FAILED_INFRA",
            tx_signature=send_res.tx_signature,
            error_name="RpcSendError",
            sim_logs=[send_res.infra_error or "Error de red al confirmar la transacción"],
        )
        return ExecuteIntentResponse(
            status="FAILED_INFRA",
            audit_id=pending_row.id,
            decision_hash=evidence.decision_hash_hex,
            tx_signature=send_res.tx_signature,
            guardrail_triggered=False,
            explanation_es=(
                "Fallo de infraestructura en Solana RPC: "
                f"{send_res.infra_error or 'error desconocido'}"
            ),
            risk_score=risk_score,
            risk_flags=risk_flags,
            recipient_address=recipient_address,
            amount_usdc=amount_usdc_str,
        )

    # Simulación falló con KipuError
    if sim.is_program_error and sim.error_code is not None:
        idl_entry = idl_registry.lookup_error(sim.error_code)
        err_name = idl_entry.name if idl_entry else sim.error_name
        explanation = explain_error_es(
            err_name,
            amount_usdc=amount_usdc_str,
            max_per_tx_usdc=max_per_tx_usdc,
            daily_limit_usdc=daily_limit_usdc,
            recipient_address=recipient_address,
            idl_msg=idl_entry.msg if idl_entry else None,
        )

        if body.mode == "standard":
            await repo.update_audit_status(
                audit_id=pending_row.id,
                from_status="PENDING",
                to_status="BLOCKED_PREFLIGHT",
                error_code=sim.error_code,
                error_name=err_name,
                sim_logs=sim.logs,
            )
            return ExecuteIntentResponse(
                status="BLOCKED_PREFLIGHT",
                audit_id=pending_row.id,
                decision_hash=evidence.decision_hash_hex,
                tx_signature=None,
                error_code=sim.error_code,
                error_name=err_name,
                guardrail_triggered=True,
                explanation_es=(
                    f"{explanation} Bloqueado en simulación preflight: no existe firma on-chain."
                ),
                risk_score=risk_score,
                risk_flags=risk_flags,
                recipient_address=recipient_address,
                amount_usdc=amount_usdc_str,
            )

        # Modo red_team: reenviar con skipPreflight=True para anclar la tx revertida on-chain
        send_res = await solana.send_and_confirm_transaction(tx_b64, skip_preflight=True)
        if send_res.infra_error or not send_res.tx_signature:
            await repo.update_audit_status(
                audit_id=pending_row.id,
                from_status="PENDING",
                to_status="FAILED_INFRA",
                error_code=sim.error_code,
                error_name=err_name,
                sim_logs=sim.logs,
            )
            return ExecuteIntentResponse(
                status="FAILED_INFRA",
                audit_id=pending_row.id,
                decision_hash=evidence.decision_hash_hex,
                guardrail_triggered=False,
                explanation_es=(
                    f"Error de infraestructura reenviando tx Red-Team: {send_res.infra_error}"
                ),
                risk_score=risk_score,
                risk_flags=risk_flags,
                recipient_address=recipient_address,
                amount_usdc=amount_usdc_str,
            )

        final_code = send_res.error_code if send_res.error_code is not None else sim.error_code
        final_idl = idl_registry.lookup_error(final_code) if final_code is not None else idl_entry
        final_name = final_idl.name if final_idl else err_name
        final_logs = send_res.logs or sim.logs
        final_explanation = explain_error_es(
            final_name,
            amount_usdc=amount_usdc_str,
            max_per_tx_usdc=max_per_tx_usdc,
            daily_limit_usdc=daily_limit_usdc,
            recipient_address=recipient_address,
            idl_msg=final_idl.msg if final_idl else None,
        )
        await repo.update_audit_status(
            audit_id=pending_row.id,
            from_status="PENDING",
            to_status="BLOCKED_ONCHAIN",
            tx_signature=send_res.tx_signature,
            error_code=final_code,
            error_name=final_name,
            sim_logs=final_logs,
        )
        return ExecuteIntentResponse(
            status="BLOCKED_ONCHAIN",
            audit_id=pending_row.id,
            decision_hash=evidence.decision_hash_hex,
            tx_signature=send_res.tx_signature,
            error_code=final_code,
            error_name=final_name,
            guardrail_triggered=True,
            explanation_es=final_explanation,
            risk_score=risk_score,
            risk_flags=risk_flags,
            recipient_address=recipient_address,
            amount_usdc=amount_usdc_str,
        )

    # Error no relacionado a KipuError (ej. SOL insuficiente del agente)
    await repo.update_audit_status(
        audit_id=pending_row.id,
        from_status="PENDING",
        to_status="FAILED_INFRA",
        error_name="SimulationInfraError",
        sim_logs=sim.logs,
    )
    return ExecuteIntentResponse(
        status="FAILED_INFRA",
        audit_id=pending_row.id,
        decision_hash=evidence.decision_hash_hex,
        guardrail_triggered=False,
        explanation_es=(
            "Fallo de infraestructura durante simulateTransaction "
            "(revisa saldo SOL del agente o RPC)."
        ),
        risk_score=risk_score,
        risk_flags=risk_flags,
        recipient_address=recipient_address,
        amount_usdc=amount_usdc_str,
    )
