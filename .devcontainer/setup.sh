#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential pkg-config libudev-dev libssl-dev llvm clang curl git ca-certificates

# Agave / Solana CLI v4.1.2 (Anza release)
if ! command -v solana >/dev/null 2>&1; then
  sh -c "$(curl -sSfL https://release.anza.xyz/v4.1.2/install)"
fi

SOLANA_BIN="$HOME/.local/share/solana/install/active_release/bin"
export PATH="$SOLANA_BIN:$HOME/.avm/bin:$HOME/.cargo/bin:$PATH"
if ! grep -q "$SOLANA_BIN" "$HOME/.bashrc"; then
  echo "export PATH=\"$SOLANA_BIN:\$HOME/.avm/bin:\$HOME/.cargo/bin:\$PATH\"" >> "$HOME/.bashrc"
fi
export ANCHOR_BUILD_SBF_ARCH=v0
if ! grep -q "ANCHOR_BUILD_SBF_ARCH" "$HOME/.bashrc"; then
  echo "export ANCHOR_BUILD_SBF_ARCH=v0" >> "$HOME/.bashrc"
fi

mkdir -p "$HOME/.config/solana"
if [ ! -f "$HOME/.config/solana/id.json" ]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "$HOME/.config/solana/id.json"
fi
solana config set --url https://api.devnet.solana.com

if ! command -v cargo-build-sbf >/dev/null 2>&1; then
  cargo install cargo-build-sbf --version 4.1.0 --locked
fi

# Anchor CLI 1.2.1 (binario oficial x86_64 o avm)
if ! command -v anchor >/dev/null 2>&1; then
  if [ "$(uname -m)" = "x86_64" ]; then
    mkdir -p "$HOME/.cargo/bin"
    curl -fsSL "https://github.com/otter-sec/anchor/releases/download/v1.2.1/anchor-1.2.1-x86_64-unknown-linux-gnu" \
      -o "$HOME/.cargo/bin/anchor"
    chmod +x "$HOME/.cargo/bin/anchor"
  else
    cargo install avm --locked --force
    avm install 1.2.1
    avm use 1.2.1
  fi
fi

# Node dependencies (tests, Devnet scripts, and frontend)
npm install
(cd frontend && npm install)

# Python backend venv
python3 -m venv backend/.venv
backend/.venv/bin/pip install --upgrade pip
backend/.venv/bin/pip install -r backend/requirements.txt

echo ""
echo "=== KipuVault Codespace listo ==="
echo "Ejecuta ahora:"
echo "  anchor build --arch v0 && anchor keys sync && anchor build --arch v0"
echo "  npm run sync:idl"
echo "  anchor test --skip-local-validator --skip-deploy --skip-build"
