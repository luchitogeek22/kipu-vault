import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt =
  "KipuVault — Guardrails On-Chain en Solana para Agentes de IA";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#09090B",
          backgroundImage:
            "radial-gradient(circle at 80% 15%, rgba(245, 158, 11, 0.18), transparent 45%), radial-gradient(circle at 15% 85%, rgba(16, 185, 129, 0.14), transparent 40%)",
          padding: "56px 64px",
          color: "#F4F4F5",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                backgroundColor: "rgba(245, 158, 11, 0.16)",
                border: "2px solid rgba(245, 158, 11, 0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#F59E0B",
                fontSize: "22px",
                fontWeight: 700,
              }}
            >
              K
            </div>
            <span style={{ fontSize: "30px", fontWeight: 700 }}>
              kipuvault<span style={{ color: "#F59E0B" }}>.</span>
            </span>
          </div>

          <div
            style={{
              borderRadius: "9999px",
              border: "1px solid rgba(245, 158, 11, 0.45)",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              color: "#FDE68A",
              padding: "8px 18px",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            Solana Devnet · DEV3PACK
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              fontSize: "58px",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "#FFFFFF",
              maxWidth: "960px",
            }}
          >
            Tu agente es IA. El control sigue siendo{" "}
            <span style={{ color: "#F59E0B" }}>tuyo.</span>
          </div>
          <div
            style={{
              fontSize: "24px",
              color: "#D4D4D8",
              maxWidth: "880px",
              lineHeight: 1.35,
            }}
          >
            Límites por transacción, cupo de 24h, allowlist, Emergency Freeze y
            auditoría SHA-256 en contratos Anchor sobre Solana.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #27272A",
            paddingTop: "24px",
            fontSize: "19px",
          }}
        >
          <div style={{ display: "flex", gap: "16px" }}>
            <span style={{ color: "#10B981", fontWeight: 600 }}>
              ✓ Max/Tx & 24h Cap
            </span>
            <span style={{ color: "#E4E4E7" }}>·</span>
            <span style={{ color: "#EF4444", fontWeight: 600 }}>
              ✕ Allowlist Guardrail
            </span>
            <span style={{ color: "#E4E4E7" }}>·</span>
            <span style={{ color: "#38BDF8", fontWeight: 600 }}>
              ❄ Emergency Freeze
            </span>
          </div>
          <span style={{ color: "#A1A1AA", fontFamily: "monospace" }}>
            EVPQDC...kUfSx
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
