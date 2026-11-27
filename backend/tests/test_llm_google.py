"""Offline unit tests for Google Gemini LLM client (header auth & model fallback)."""

from __future__ import annotations

import json

import httpx
import pytest

from app.services.llm import GoogleLLMClient, LLMParseError


@pytest.mark.asyncio
async def test_google_llm_client_sends_header_and_no_query_key() -> None:
    demo_recipient = "3kx3s1viSB9p5bZt3wDiyaiVZ5j7uNCA488PMEdWgVpN"
    captured_url = ""
    captured_header = ""

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_url, captured_header
        captured_url = str(request.url)
        captured_header = request.headers.get("x-goog-api-key", "")
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "action": "transfer",
                                            "recipient_address": demo_recipient,
                                            "amount_usdc": "5.000000",
                                            "reasoning": "OK",
                                            "risk_score": 5,
                                            "risk_flags": [],
                                        }
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = GoogleLLMClient(
            api_key="  AIza-secret-google-key  ",
            model=" gemini-2.5-flash-lite ",
            http_client=http_client,
        )
        intent = await client.parse_intent("Paga 5 USDC")

    assert "key=" not in captured_url
    assert captured_url.endswith("/v1beta/models/gemini-2.5-flash-lite:generateContent")
    assert captured_header == "AIza-secret-google-key"
    assert intent.action == "transfer"


@pytest.mark.asyncio
async def test_google_llm_client_auto_discovers_active_model_on_404() -> None:
    demo_recipient = "3kx3s1viSB9p5bZt3wDiyaiVZ5j7uNCA488PMEdWgVpN"
    seen_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_urls.append(str(request.url))
        if request.url.path.endswith("/v1beta/models"):
            return httpx.Response(
                200,
                json={
                    "models": [
                        {
                            "name": "models/text-embedding-004",
                            "supportedGenerationMethods": ["embedContent"],
                        },
                        {
                            "name": "models/gemini-3.5-flash-lite",
                            "supportedGenerationMethods": ["generateContent"],
                        },
                    ]
                },
            )
        if "gemini-2.5-flash:" in request.url.path:
            return httpx.Response(404, json={"error": {"message": "not found"}})
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "action": "transfer",
                                            "recipient_address": demo_recipient,
                                            "amount_usdc": "5.000000",
                                            "reasoning": "OK",
                                            "risk_score": 10,
                                            "risk_flags": [],
                                        }
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = GoogleLLMClient(
            api_key="AQ.test-google-key",
            model="gemini-2.5-flash",
            http_client=http_client,
        )
        intent = await client.parse_intent("Paga 5 USDC")

    assert any("gemini-3.5-flash-lite:generateContent" in u for u in seen_urls)
    assert intent.action == "transfer"


@pytest.mark.asyncio
async def test_google_llm_client_error_does_not_leak_api_key() -> None:
    secret = "AQ.super_secret_do_not_leak"

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"error": {"message": "permission denied"}})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = GoogleLLMClient(
            api_key=secret,
            model="gemini-2.5-flash-lite",
            http_client=http_client,
        )
        with pytest.raises(LLMParseError) as exc_info:
            await client.parse_intent("Paga 5 USDC")

    assert secret not in str(exc_info.value)
