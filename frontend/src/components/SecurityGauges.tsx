"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  XCircle,
} from "lucide-react";
import { FRONTEND_CONFIG } from "@/lib/config";
import { explorerAddressUrl, truncateMiddle } from "@/lib/format";
import type { SecurityTimelinePoint } from "@/lib/ux";

interface SecurityGaugesProps {
  points: SecurityTimelinePoint[];
  currentRiskScore: number;
  lastReason: string;
  isFrozen: boolean;
  isRealVault: boolean;
  balanceUsdc: number;
  dailyRemainingUsdc: number;
  dailyLimitUsdc: number;
  maxPerTxUsdc: number;
  allowlistCount: number;
}

function pointVisual(status: SecurityTimelinePoint["status"]) {
  if (status === "EXECUTED") {
    return { color: "#10B981", label: "Autorizada" };
  }
  if (status === "FREEZE") {
    return { color: "#38BDF8", label: "Emergency Freeze" };
  }
  if (status === "ALERT") {
    return { color: "#F59E0B", label: "Alerta IA" };
  }
  return { color: "#EF4444", label: "Bloqueada" };
}

export function SecurityGauges({
  points,
  currentRiskScore,
  lastReason,
  isFrozen,
  isRealVault,
  balanceUsdc,
  dailyRemainingUsdc,
  dailyLimitUsdc,
  maxPerTxUsdc,
  allowlistCount,
}: SecurityGaugesProps) {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const threatCount = points.filter(
    (p) => p.status === "BLOCKED" || p.status === "ALERT" || p.status === "FREEZE"
  ).length;

  const displayPoints = points.slice(-6);
  const selectedPoint =
    displayPoints.find((p) => p.id === selectedPointId) ??
    displayPoints[displayPoints.length - 1] ??
    null;

  // Semicircle gauge geometry (180 degrees from left to right)
  const clampedRisk = Math.max(0, Math.min(100, currentRiskScore));
  const arcRadius = 72;
  const arcLen = Math.PI * arcRadius;
  const dashOffset = arcLen * (1 - clampedRisk / 100);

  const riskLabel = isFrozen
    ? "Freeze Activo"
    : clampedRisk >= 81
      ? "Riesgo Alto"
      : clampedRisk >= 41
        ? "Riesgo Moderado"
        : "Riesgo Bajo";

  const riskAccent = isFrozen
    ? "#38BDF8"
    : clampedRisk >= 81
      ? "#EF4444"
      : clampedRisk >= 41
        ? "#F59E0B"
        : "#10B981";

  const guardrailChecks = [
    {
      name: "Max Tx Limit Guardrail",
      ok: true,
      detail: `≤ ${maxPerTxUsdc.toFixed(0)} USDC`,
    },
    {
      name: "24h Daily Spending Cap",
      ok: dailyRemainingUsdc > 0,
      detail: `${dailyRemainingUsdc.toFixed(0)} / ${dailyLimitUsdc.toFixed(0)} disp.`,
    },
    {
      name: "Strict Allowlist Filter",
      ok: allowlistCount > 0,
      detail: `${allowlistCount}/8 destinos`,
    },
    {
      name: "Emergency Freeze Ready",
      ok: true,
      freeze: isFrozen,
      detail: isFrozen ? "Congelada" : "Disponible",
    },
    {
      name: "SHA-256 Audit Ledger",
      ok: true,
      detail: isRealVault ? "On-Chain" : "Sandbox",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* 1. Threat Count Radar (TrustScan left card) */}
      <div className="kipu-card-glow flex flex-col justify-between rounded-xl border border-kipu-border p-4 lg:col-span-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-zinc-300">Threat Count</p>
            <p className="mt-0.5 font-display text-3xl font-bold tracking-tight text-white">
              {String(threatCount).padStart(2, "0")}
            </p>
          </div>
          <span className="rounded-full border border-zinc-700 bg-kipu-bg px-2.5 py-0.5 font-mono text-[11px] text-zinc-300">
            {isRealVault ? "On-Chain" : "Sesión"}
          </span>
        </div>

        <div className="my-2 flex justify-center">
          <svg
            viewBox="0 0 200 200"
            className="h-44 w-44 select-none"
            role="img"
            aria-label="Radar circular de amenazas bloqueadas y eventos"
          >
            <defs>
              <radialGradient id="kipuRadarBg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
                <stop offset="65%" stopColor="#0E7490" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#09090B" stopOpacity="0.02" />
              </radialGradient>
              <linearGradient id="kipuSweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
              </linearGradient>
            </defs>

            <circle cx="100" cy="100" r="88" fill="url(#kipuRadarBg)" />
            {[24, 46, 68, 88].map((r) => (
              <circle
                key={r}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke="#27272A"
                strokeWidth="1"
              />
            ))}
            <line
              x1="12"
              y1="100"
              x2="188"
              y2="100"
              stroke="#27272A"
              strokeWidth="1"
            />
            <line
              x1="100"
              y1="12"
              x2="100"
              y2="188"
              stroke="#27272A"
              strokeWidth="1"
            />

            {/* Subtle sweep wedge */}
            <path
              d="M 100 100 L 100 12 A 88 88 0 0 1 176 56 Z"
              fill="url(#kipuSweepGrad)"
              className="kipu-radar-sweep"
            />

            {/* Center Vault Core */}
            <circle
              cx="100"
              cy="100"
              r="14"
              fill="#09090B"
              stroke={isFrozen ? "#38BDF8" : "#10B981"}
              strokeWidth="1.5"
            />
            <text
              x="100"
              y="103"
              textAnchor="middle"
              fill="#E4E4E7"
              fontSize="8"
              fontFamily="monospace"
            >
              VAULT
            </text>

            {/* Deterministic plotted radar dots for real/sandbox points */}
            {displayPoints.map((pt, idx) => {
              const angle = ((idx * 67 + 28) * Math.PI) / 180;
              const radius =
                pt.status === "EXECUTED" ? 36 : pt.status === "FREEZE" ? 56 : 72;
              const cx = 100 + Math.cos(angle) * radius;
              const cy = 100 + Math.sin(angle) * radius;
              const vis = pointVisual(pt.status);
              const active = selectedPoint?.id === pt.id;
              return (
                <g
                  key={pt.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedPointId(pt.id)}
                  onMouseEnter={() => setSelectedPointId(pt.id)}
                >
                  {active && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={10}
                      fill={vis.color}
                      opacity={0.28}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={active ? 5.5 : 4.5}
                    fill={vis.color}
                    stroke="#09090B"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="rounded-lg border border-kipu-border bg-kipu-bg px-3 py-2 text-xs">
          {selectedPoint ? (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-white">
                {selectedPoint.label}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-zinc-300">
                {selectedPoint.amountUsdc.toFixed(0)} USDC
              </span>
            </div>
          ) : (
            <p className="text-zinc-300">
              Sin amenazas detectadas aún. Lanza Red-Team o Freeze para
              probar.
            </p>
          )}
        </div>
      </div>

      {/* 2. Risk Score Semicircle Gauge (TrustScan center card) */}
      <div className="kipu-card-glow flex flex-col justify-between rounded-xl border border-kipu-border p-4 lg:col-span-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-300">Risk Score</span>
          <span
            className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
            style={{
              borderColor: `${riskAccent}66`,
              backgroundColor: `${riskAccent}1A`,
              color: "#F4F4F5",
            }}
          >
            {riskLabel}
          </span>
        </div>

        <div className="my-1 flex flex-col items-center justify-center">
          <svg
            viewBox="0 0 200 118"
            className="w-full max-w-[240px] select-none"
            role="img"
            aria-label={`Medidor de riesgo: ${clampedRisk} de 100`}
          >
            <defs>
              <linearGradient
                id="kipuRiskGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor={isFrozen ? "#38BDF8" : "#EF4444"} />
              </linearGradient>
            </defs>

            {/* Radial tick marks around the semicircle */}
            {Array.from({ length: 25 }).map((_, i) => {
              const theta = Math.PI + (i / 24) * Math.PI;
              const x1 = 100 + Math.cos(theta) * 84;
              const y1 = 102 + Math.sin(theta) * 84;
              const x2 = 100 + Math.cos(theta) * 90;
              const y2 = 102 + Math.sin(theta) * 90;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={i / 24 <= clampedRisk / 100 ? riskAccent : "#3F3F46"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Background arc */}
            <path
              d="M 28 102 A 72 72 0 0 1 172 102"
              fill="none"
              stroke="#27272A"
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* Active progress arc */}
            <path
              d="M 28 102 A 72 72 0 0 1 172 102"
              fill="none"
              stroke="url(#kipuRiskGradient)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={arcLen}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />

            <text
              x="100"
              y="76"
              textAnchor="middle"
              fill="#A1A1AA"
              fontSize="10"
            >
              Risk Score
            </text>
            <text
              x="100"
              y="104"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="28"
              fontWeight="700"
            >
              {clampedRisk}
            </text>
          </svg>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
            <div className="rounded border border-kipu-border bg-kipu-bg py-1">
              <span className="block text-emerald-300">Low Risk</span>
              <span className="font-mono text-zinc-200">0 - 40</span>
            </div>
            <div className="rounded border border-kipu-border bg-kipu-bg py-1">
              <span className="block text-amber-300">Moderate</span>
              <span className="font-mono text-zinc-200">41 - 80</span>
            </div>
            <div className="rounded border border-kipu-border bg-kipu-bg py-1">
              <span className="block text-red-300">High Risk</span>
              <span className="font-mono text-zinc-200">81 - 100</span>
            </div>
          </div>
          <p className="truncate text-center text-xs text-zinc-300">
            {lastReason}
          </p>
        </div>
      </div>

      {/* 3. Vault Overview + Guardrail Checks (TrustScan right card) */}
      <div className="kipu-card-glow flex flex-col justify-between gap-3 rounded-xl border border-kipu-border p-4 lg:col-span-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              Vault Overview
            </span>
            <a
              href={explorerAddressUrl(FRONTEND_CONFIG.programId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[11px] text-kipu-gold hover:underline"
            >
              {truncateMiddle(FRONTEND_CONFIG.programId, 4, 4)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <dl className="divide-y divide-kipu-border/60 text-xs">
            <div className="flex justify-between py-1">
              <dt className="text-zinc-400">Vault Balance</dt>
              <dd className="font-mono font-semibold text-white">
                {balanceUsdc.toFixed(2)} USDC
              </dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-zinc-400">24h Remaining</dt>
              <dd className="font-mono text-zinc-100">
                {dailyRemainingUsdc.toFixed(0)} / {dailyLimitUsdc.toFixed(0)}
              </dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-zinc-400">Max / Tx Cap</dt>
              <dd className="font-mono text-zinc-100">
                {maxPerTxUsdc.toFixed(0)} Mock USDC
              </dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-zinc-400">Network</dt>
              <dd className="font-mono text-emerald-300">Solana Devnet</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-1.5 border-t border-kipu-border pt-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Guardrail Checks
          </p>
          {guardrailChecks.map((chk) => (
            <div
              key={chk.name}
              className="flex items-center justify-between rounded-md border border-kipu-border/80 bg-kipu-bg px-2.5 py-1 text-xs"
            >
              <span className="text-zinc-200">{chk.name}</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
                <span>{chk.detail}</span>
                {chk.freeze ? (
                  <Snowflake className="h-3.5 w-3.5 text-sky-300" />
                ) : chk.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-kipu-emerald" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-kipu-crimson" />
                )}
              </span>
            </div>
          ))}
          <p className="sr-only">
            <ShieldCheck />
            <ShieldAlert />
          </p>
        </div>
      </div>
    </div>
  );
}
