#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

for cmd in solana anchor node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[deploy_devnet] Error: falta el comando requerido '$cmd' en PATH." >&2
    exit 1
  fi
done

echo "[deploy_devnet] Configurando CLI de Solana en Devnet..."
solana config set --url https://api.devnet.solana.com >/dev/null

DEPLOYER_PUBKEY="$(solana address)"
echo "[deploy_devnet] Deployer wallet: $DEPLOYER_PUBKEY"

get_balance_sol() {
  solana balance --url devnet | awk '{print $1}'
}

is_less_than() {
  awk -v a="$1" -v b="$2" 'BEGIN { exit !(a + 0 < b + 0) }'
}

BALANCE_SOL="$(get_balance_sol)"
echo "[deploy_devnet] Balance actual en Devnet: ${BALANCE_SOL} SOL"

if is_less_than "$BALANCE_SOL" "1.5"; then
  echo "[deploy_devnet] Balance < 1.5 SOL; solicitando airdrop en Devnet..."
  MAX_ATTEMPTS=3
  AIRDROP_OK=0
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    if solana airdrop 2 --url devnet; then
      AIRDROP_OK=1
      break
    fi
    if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
      delay=$((attempt * 4))
      echo "[deploy_devnet] Faucet de Devnet limitó el intento ${attempt}/${MAX_ATTEMPTS}. Reintentando en ${delay}s..." >&2
      sleep "$delay"
    fi
  done

  BALANCE_SOL="$(get_balance_sol)"
  if [ "$AIRDROP_OK" -eq 0 ] && is_less_than "$BALANCE_SOL" "0.5"; then
    echo "" >&2
    echo "[deploy_devnet] ERROR: El faucet RPC de Devnet rechazó el airdrop (rate limit) y tu balance (${BALANCE_SOL} SOL) es insuficiente para desplegar." >&2
    echo "Fondea manualmente tu wallet desde el faucet web oficial:" >&2
    echo "  URL: https://faucet.solana.com" >&2
    echo "  Address: $DEPLOYER_PUBKEY" >&2
    echo "Luego vuelve a ejecutar: npm run deploy:devnet" >&2
    exit 1
  elif [ "$AIRDROP_OK" -eq 0 ]; then
    echo "[deploy_devnet] Aviso: el faucet limitó el airdrop, continuando con ${BALANCE_SOL} SOL disponibles." >&2
  else
    echo "[deploy_devnet] Balance actualizado en Devnet: ${BALANCE_SOL} SOL"
  fi
fi

echo "[deploy_devnet] 1/4 Compilando programa Anchor..."
anchor build

echo "[deploy_devnet] 2/4 Sincronizando Program ID en localnet y devnet..."
anchor keys sync
anchor keys sync --provider.cluster devnet

echo "[deploy_devnet] 3/4 Recompilando con el Program ID sincronizado..."
anchor build

echo "[deploy_devnet] 4/4 Desplegando programa en Solana Devnet..."
anchor deploy --provider.cluster devnet

echo "[deploy_devnet] Sincronizando IDL hacia frontend/src/idl/kipu_vault.json..."
npm run sync:idl

PROGRAM_ID="$(node -e "const fs = require('fs'); const idl = JSON.parse(fs.readFileSync('target/idl/kipu_vault.json', 'utf8')); console.log(idl.address || '');")"

echo ""
echo "=== Despliegue en Solana Devnet completado ==="
echo "Program ID real: ${PROGRAM_ID}"
echo ""
echo "Siguientes pasos:"
echo "  1. Ejecuta Mock USDC + bootstrap de bóveda:"
echo "       npm run setup:devnet"
echo "       npm run bootstrap:vault"
echo "  2. Actualiza con el Program ID real (${PROGRAM_ID}):"
echo "       - README.md (sección 'Program ID en Solana Devnet')"
echo "       - .env (KIPU_PROGRAM_ID=${PROGRAM_ID} y NEXT_PUBLIC_PROGRAM_ID=${PROGRAM_ID})"
echo "       - frontend/.env.local (NEXT_PUBLIC_PROGRAM_ID=${PROGRAM_ID})"
echo "  3. Sube a GitHub el Program ID y frontend/src/idl/kipu_vault.json sincronizados."
