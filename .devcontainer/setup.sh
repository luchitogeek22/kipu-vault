#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential pkg-config libudev-dev libssl-dev llvm clang curl git ca-certificates

# Solana CLI v1.18.26 (Anza release)
if ! command -v solana >/dev/null 2>&1; then
  sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.26/install)"
fi

SOLANA_BIN="$HOME/.local/share/solana/install/active_release/bin"
export PATH="$SOLANA_BIN:$HOME/.avm/bin:$HOME/.cargo/bin:$PATH"
if ! grep -q "$SOLANA_BIN" "$HOME/.bashrc"; then
  echo "export PATH=\"$SOLANA_BIN:\$HOME/.avm/bin:\$HOME/.cargo/bin:\$PATH\"" >> "$HOME/.bashrc"
fi

mkdir -p "$HOME/.config/solana"
if [ ! -f "$HOME/.config/solana/id.json" ]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "$HOME/.config/solana/id.json"
fi
solana config set --url https://api.devnet.solana.com

# Anchor CLI 0.30.1 via avm
if ! command -v avm >/dev/null 2>&1; then
  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
fi
avm install 0.30.1
avm use 0.30.1

# Node dependencies (tests & Devnet scripts)
npm install

# Python backend venv
python3 -m venv backend/.venv
backend/.venv/bin/pip install --upgrade pip
backend/.venv/bin/pip install -r backend/requirements.txt

echo ""
echo "=== KipuVault Codespace listo ==="
echo "Ejecuta ahora:"
echo "  anchor build && anchor keys sync && anchor build"
echo "  anchor test --skip-local-validator"
