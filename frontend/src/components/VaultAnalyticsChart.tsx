"use client";

import React, { useMemo, useState } from "react";
import { Activity, ShieldCheck, Snowflake, TrendingUp } from "lucide-react";
import type { SecurityTimelinePoint } from "@/lib/ux";

interface VaultAnalyticsChartProps {
  currentBalanceUsdc: number;
  dailyLimitUsdc: number;
  spentTodayUsdc: number;
  maxPerTxUsdc: number;
  isFrozen: boolean;
  isRealVault: boolean;
  timelinePoints: SecurityTimelinePoint[];
}

interface ComputedPlotPoint extends SecurityTimelinePoint {
  x: number;
  y: number;
  balanceAfter: number;
}

function pointColor(status: SecurityTimelinePoint["status"]): string {
  if (status === "EXECUTED") return "#10B981";
  if (status === "FREEZE") return "#38BDF8";
  if (status === "ALERT") return "#F59E0B";
  return "#EF4444";
}

export function VaultAnalyticsChart({
  currentBalanceUsdc,
  dailyLimitUsdc,
  spentTodayUsdc,
  maxPerTxUsdc,
  isFrozen,
  isRealVault,
  timelinePoints,
}: VaultAnalyticsChartProps) {
  const [viewMode, setViewMode] = useState<"evolution" | "limits">(
    "evolution"
  );
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Reconstruct real balance progression backward from currentBalanceUsdc using executed outflows
  const plotData = useMemo(() => {
    const width = 640;
    const height = 165;
    const padX = 28;
    const padTop = 22;
    const padBottom = 26;
    const innerW = width - padX * 2;
    const innerH = height - padTop - padBottom;

    const totalExecutedOut = timelinePoints.reduce(
      (acc, p) => (p.status === "EXECUTED" ? acc + p.amountUsdc : acc),
      0
    );
    const baseStart = Math.max(0, currentBalanceUsdc + totalExecutedOut);

    let running = baseStart;
    const rawSeries = timelinePoints.map((pt) => {
      if (pt.status === "EXECUTED") {
        running = Math.max(0, running - pt.amountUsdc);
      }
      return {
        ...pt,
        balanceAfter: running,
      };
    });

    const values =
      rawSeries.length > 0
        ? [baseStart, ...rawSeries.map((r) => r.balanceAfter)]
        : [currentBalanceUsdc, currentBalanceUsdc];

    const minVal = Math.max(0, Math.min(...values) * 0.88);
    const maxVal = Math.max(...values, currentBalanceUsdc, 10) * 1.1;
    const span = Math.max(1, maxVal - minVal);

    const toY = (val: number) =>
      padTop + innerH - ((val - minVal) / span) * innerH;

    const count = Math.max(1, rawSeries.length);
    const plottedPoints: ComputedPlotPoint[] = rawSeries.map((item, i) => ({
      ...item,
      x: padX + ((i + 1) / count) * innerW,
      y: toY(item.balanceAfter),
    }));

    const lineCoords =
      plottedPoints.length > 0
        ? [{ x: padX, y: toY(baseStart) }, ...plottedPoints.map((p) => ({ x: p.x, y: p.y }))]
        : [
            { x: padX, y: toY(currentBalanceUsdc) },
            { x: width - padX, y: toY(currentBalanceUsdc) },
          ];

    const linePath = lineCoords
      .map((c, idx) => `${idx === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");

    const areaPath = `${linePath} L ${lineCoords[lineCoords.length - 1].x.toFixed(
      1
    )} ${(height - padBottom).toFixed(1)} L ${lineCoords[0].x.toFixed(1)} ${(
      height - padBottom
    ).toFixed(1)} Z`;

    return {
      width,
      height,
      padBottom,
      plottedPoints,
      linePath,
      areaPath,
      baseStart,
    };
  }, [currentBalanceUsdc, timelinePoints]);

  const activePoint =
    hoveredIdx !== null
      ? plotData.plottedPoints[hoveredIdx]
      : plotData.plottedPoints[plotData.plottedPoints.length - 1];

  const strokeColor = isFrozen
    ? "#38BDF8"
    : timelinePoints.some((p) => p.status === "BLOCKED") &&
        activePoint?.status === "BLOCKED"
      ? "#F59E0B"
      : "#10B981";

  const usedPct =
    dailyLimitUsdc > 0
      ? Math.min(100, Math.round((spentTodayUsdc / dailyLimitUsdc) * 100))
      : 0;
  const maxTxPct =
    dailyLimitUsdc > 0
      ? Math.min(100, Math.round((maxPerTxUsdc / dailyLimitUsdc) * 100))
      : 0;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-kipu-border bg-kipu-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              {isRealVault
                ? "Evolución y Actividad de Bóveda"
                : "Evolución de Bóveda · Modo Sandbox"}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                isFrozen
                  ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                  : isRealVault
                    ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-emerald-200"
                    : "border-zinc-700 bg-kipu-bg text-zinc-300"
              }`}
            >
              {isFrozen ? (
                <>
                  <Snowflake className="h-3 w-3 text-sky-300" />
                  Freeze
                </>
              ) : isRealVault ? (
                <>
                  <ShieldCheck className="h-3 w-3 text-kipu-emerald" />
                  On-Chain Devnet
                </>
              ) : (
                "Simulación local"
              )}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {currentBalanceUsdc.toFixed(2)}{" "}
              <span className="font-mono text-sm font-medium text-zinc-300">
                Mock USDC
              </span>
            </span>
            {timelinePoints.length > 0 && (
              <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5" />
                {timelinePoints.filter((p) => p.status === "BLOCKED").length}{" "}
                ataques bloqueados ·{" "}
                {timelinePoints.filter((p) => p.status === "EXECUTED").length}{" "}
                permitidas
              </span>
            )}
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-kipu-border bg-kipu-bg p-1">
          <button
            type="button"
            onClick={() => setViewMode("evolution")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === "evolution"
                ? "bg-kipu-card text-white shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Evolución & Eventos
          </button>
          <button
            type="button"
            onClick={() => setViewMode("limits")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === "limits"
                ? "bg-kipu-card text-white shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Consumo de Límites
          </button>
        </div>
      </div>

      {viewMode === "evolution" ? (
        <div className="space-y-2">
          {/* Interactive Hover Readout */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-kipu-border/80 bg-kipu-bg px-3 py-1.5 text-xs">
            {activePoint ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: pointColor(activePoint.status) }}
                  />
                  <span className="font-semibold text-white">
                    {activePoint.label}
                  </span>
                  <span className="text-zinc-300">{activePoint.reason}</span>
                </div>
                <span className="font-mono text-[11px] text-zinc-300">
                  {activePoint.amountUsdc.toFixed(2)} USDC · Riesgo{" "}
                  {activePoint.riskScore}/100 ·{" "}
                  {activePoint.isSandbox ? "Sandbox" : activePoint.timestamp}
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-zinc-300">
                <Activity className="h-3.5 w-3.5 text-zinc-400" />
                Línea base real del saldo · ejecuta cualquier escenario en Copilot
                para trazar puntos autorizados o bloqueados en vivo.
              </span>
            )}
          </div>

          <div className="relative w-full overflow-hidden rounded-lg border border-kipu-border/70 bg-kipu-bg/80 px-2 pt-2">
            <svg
              viewBox={`0 0 ${plotData.width} ${plotData.height}`}
              className="h-36 w-full select-none sm:h-40"
              role="img"
              aria-label="Gráfico de evolución de saldo y eventos de seguridad"
            >
              <defs>
                <linearGradient id="kipuAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Subtle Paytech-style vertical grid bars */}
              {Array.from({ length: 28 }).map((_, i) => (
                <rect
                  key={i}
                  x={28 + i * 21}
                  y={16}
                  width={12}
                  height={plotData.height - plotData.padBottom - 16}
                  rx={2}
                  fill="#27272A"
                  opacity={i % 2 === 0 ? 0.28 : 0.16}
                />
              ))}

              {/* Area and Line */}
              <path d={plotData.areaPath} fill="url(#kipuAreaGrad)" />
              <path
                d={plotData.linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Event Nodes */}
              {plotData.plottedPoints.map((pt, idx) => {
                const isSelected =
                  hoveredIdx === idx ||
                  (hoveredIdx === null &&
                    idx === plotData.plottedPoints.length - 1);
                const c = pointColor(pt.status);
                return (
                  <g
                    key={pt.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => setHoveredIdx(idx)}
                  >
                    {isSelected && (
                      <circle cx={pt.x} cy={pt.y} r={10} fill={c} opacity={0.22} />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 5.5 : 4}
                      fill={c}
                      stroke="#09090B"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-kipu-border bg-kipu-bg p-3.5">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-zinc-200">
                Consumo diario (Ventana 24h)
              </span>
              <span className="font-mono text-zinc-100">
                {spentTodayUsdc.toFixed(2)} / {dailyLimitUsdc.toFixed(2)} Mock USDC
                ({usedPct}%)
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full transition-all ${
                  usedPct >= 90 ? "bg-kipu-crimson" : "bg-kipu-emerald"
                }`}
                style={{ width: `${Math.max(2, usedPct)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-zinc-200">
                Tope por transacción frente al límite diario
              </span>
              <span className="font-mono text-zinc-100">
                {maxPerTxUsdc.toFixed(2)} Mock USDC ({maxTxPct}%)
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-kipu-gold transition-all"
                style={{ width: `${Math.max(4, maxTxPct)}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-zinc-300">
            Incluso si el agente ejecuta múltiples transferencias consecutivas,
            el contrato impide exceder{" "}
            <strong className="text-white">
              {maxPerTxUsdc.toFixed(0)} USDC
            </strong>{" "}
            por operación y{" "}
            <strong className="text-white">
              {dailyLimitUsdc.toFixed(0)} USDC
            </strong>{" "}
            cada 24 horas.
          </p>
        </div>
      )}
    </div>
  );
}
