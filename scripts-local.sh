#!/usr/bin/env bash
# One-shot local setup: starts Anvil, deploys the demo contracts and seeds sample creators.
# Usage: ./scripts-local.sh   (then in another terminal: cd web && npm run dev)
set -euo pipefail
cd "$(dirname "$0")/contracts"
# Anvil's well-known test account #0. Local chain only. Never send real funds to it.
ANVIL_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
anvil --block-time 1 --silent &
ANVIL_PID=$!
trap 'kill $ANVIL_PID' EXIT
sleep 2
forge script script/Deploy.s.sol --rpc-url local --broadcast --private-key $ANVIL_KEY
SEED_IMAGE_BASE=http://localhost:3000/demo SEED_GAS_WEI=10000000000000000 forge script script/Seed.s.sol --rpc-url local --broadcast --private-key $ANVIL_KEY --slow --gas-estimate-multiplier 200
if [ -n "${MY_WALLET:-}" ]; then
  cast send "$MY_WALLET" --value 10ether --private-key $ANVIL_KEY --rpc-url http://127.0.0.1:8545 >/dev/null
  echo "Sent 10 test ETH to $MY_WALLET"
fi
echo
echo "Local chain running on http://127.0.0.1:8545 (chain id 31337). Ctrl+C to stop."
wait $ANVIL_PID
