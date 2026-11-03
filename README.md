# Backing

**Patronage that doesn't disappear.** Fans back creators by staking USDC on Base instead of tipping. The USDC goes into an audited ERC-4626 yield vault. The creator gets the yield, the fan's principal stays theirs, and the fan can withdraw it any time.

> Your capital works the night shift.

Built for Vibestarter Vibeathon 02 ("Night shift").

## How it works

1. A creator registers a profile (stored on-chain).
2. A fan approves USDC and calls `back(creator, amount)`. The contract deposits it into the vault.
3. Yield builds up. The contract attributes it to creators in proportion to the principal behind each one.
4. The creator calls `claim()` once per epoch to withdraw their yield.
5. The fan calls `unback` / `unbackAll` at any time and gets 100% of their principal back. The creator stops earning on that amount.

Yield attribution uses a single "yield per unit of principal" accumulator (MasterChef-style). Every write first syncs: the vault position's growth beyond what is owed (principal + unclaimed yield) is spread across all principal. Rounding always favours the contract, so a few wei of dust stay in the vault as a buffer. A 512-run fuzz test checks that after random back/unback/claim sequences, every fan exits with their exact principal and every creator receives exactly what they were shown.

## Repo layout

```
contracts/            Foundry project
  src/Backing.sol       the protocol (≈400 lines)
  src/mocks/            Test USDC (faucet) + demo ERC-4626 vault with sped-up yield. Testnet/local only.
  script/Deploy.s.sol   MODE=demo (mocks) or MODE=live (real vault). Writes web/src/deployments/<chainId>.json
  script/Seed.s.sol     fills a demo deployment with 4 sample creators + 6 backers
  test/                 unit + fuzz tests, plus an opt-in mainnet-fork test against a real vault
web/                  Next.js 15 + wagmi 2 + viem + Tailwind 4
  src/app/              /, /c/[address], /me, /creator
  src/deployments/      contract addresses per chain (written by the deploy script, commit these)
scripts-local.sh      one-command local chain + deploy + seed
```

## Prerequisites

- Node 20+ and npm
- Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`

> **Never paste a private key or seed phrase into a chat, an issue, a commit or a `.env` file that gets pushed.** The commands below use Foundry's encrypted keystore, so your key never appears in plain text.

## 1. Run it locally (≈5 min)

```bash
# terminal 1: local chain + contracts + sample data
cd contracts && forge test        # 17 tests should pass
cd .. && MY_WALLET=0xYourWalletAddress ./scripts-local.sh

# terminal 2: the app
cd web
npm install
npm run dev                       # http://localhost:3000
```

In your wallet, add a network with RPC `http://127.0.0.1:8545` and chain ID `31337`. `MY_WALLET` received 10 test ETH for gas. In the app, choose **Local** in the network picker, connect, tap **Get 1,000 test USDC**, then back a creator.

On Windows, run the commands inside `scripts-local.sh` one by one in Git Bash or WSL.

If you restart Anvil, re-run the script. Addresses are deterministic, so nothing in `web/` changes.

## 2. Deploy the testnet demo (Base Sepolia)

This is the version judges can try for free. It uses Test USDC and a demo vault at 3,650% APR, so income visibly ticks up during a demo. The UI labels this clearly, and the "est. per month" figures use a realistic 5% APY.

```bash
cd contracts
cast wallet import deployer --interactive      # paste the deployer key once; it's stored encrypted
# fund that address with a little Base Sepolia ETH (Coinbase Developer Platform faucet)

forge script script/Deploy.s.sol --rpc-url base_sepolia --account deployer --broadcast
forge script script/Seed.s.sol   --rpc-url base_sepolia --account deployer --broadcast --slow --gas-estimate-multiplier 200
```

This writes `web/src/deployments/84532.json`. Commit it.

Optional: verify the source on BaseScan with `--verify` and `BASESCAN_API_KEY=...`.

Claims open every 2 minutes on the demo (`EPOCH_SECONDS` overrides this).

## 3. Deploy on Base mainnet (real USDC, real vault)

1. **Pick a vault.** Open a USDC vault on Base in the Morpho app (or Moonwell's Morpho-curated vaults). Copy its address and cross-check it on basescan.org. Prefer a large, established curator. Check that it holds real liquidity, because your users' withdrawals depend on it.
2. **Check it on-chain:**
   ```bash
   cast call $VAULT "asset()(address)" --rpc-url base   # must be 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (USDC)
   cast call $VAULT "totalAssets()(uint256)" --rpc-url base
   ```
3. **Fork-test against it** (no money moves):
   ```bash
   BASE_RPC_URL=https://mainnet.base.org VAULT=$VAULT forge test --match-contract Fork -vv
   ```
4. **Deploy.** The script refuses if the vault's asset isn't USDC or the vault is empty.
   ```bash
   MODE=live VAULT=$VAULT forge script script/Deploy.s.sol --rpc-url base --account deployer --broadcast
   ```
   This writes `web/src/deployments/8453.json`. Set `NEXT_PUBLIC_VAULT_NAME` to the vault's name. The epoch defaults to 1 day (`EPOCH_SECONDS` overrides this).
5. **Smoke test with small amounts:** register a creator from one wallet, back it with $1–5 USDC from another, withdraw. Keep amounts small. This contract is unaudited.

## 4. Put the site online (Vercel)

1. Push the repo to GitHub with the `deployments/*.json` files committed.
2. In Vercel: **Add New → Project**, import the repo, set **Root Directory = `web`**.
3. Add the env vars from `web/.env.example`. At minimum set `NEXT_PUBLIC_SITE_URL` to your Vercel URL.
4. Deploy. The network picker shows every network that has a deployment file. Testnet is the default.

## Vibeathon submission checklist

Submit at app.vibestarter.xyz/vibeathon/submit, signed in with the wallet you applied with, **before Mon 9 Nov 2026, 22:00 UTC (11pm in Lagos)**. You can edit your entry until then.

- **Project name:** Backing
- **Tagline:** "Back creators without spending a cent: your USDC stays yours, its yield pays them."
- **Live URL:** your Vercel URL (testnet demo works end to end)
- **What it does / what to try:**
  1. Connect (Base Account works with a passkey), tap **Get 1,000 test USDC**.
  2. Open a creator, back them with 100 tUSDC, and watch "Earned from backers" tick up.
  3. Go to **My backings** and withdraw. You get 100% back.
  4. Go to **Creator**, make a profile, share your link, claim your yield.
- **AI tools:** list what you used (e.g. Claude).
- **Optional:** repo link, a 60–90s demo video of the flow above, a screenshot, your X handle, a Fundable score link.

**Demo moment:** two browser windows, a creator dashboard and a fan. The fan backs, the creator's "Claimable now" starts ticking. The fan withdraws everything, the ticker freezes, and the fan's wallet shows the full principal back.

## Security notes and known limits

- Unaudited hackathon code. Principal sits in a third-party ERC-4626 vault: smart-contract risk, curator risk and liquidity risk all apply. If the vault takes a loss, yield stops accruing until it recovers. Withdrawals are first-come, first-served.
- Withdrawals depend on vault liquidity. Morpho vaults can be temporarily illiquid when utilisation is very high.
- Yield is net of any vault performance fee. It is modest on mainnet (low single-digit % APY), so sell the mechanic, not the APY.
- Creator profiles are on-chain and unmoderated. Avatar URLs are shown as-is (https only).
- Creators can't back themselves. Anyone can donate vault shares to the contract; donations become creator yield.
- The frontend reads straight from the contract (no indexer), so it's fine for hundreds of creators. Add an indexer before scaling further.
- Regulatory framing: fans keep 100% of principal and get no return; creators receive the yield on capital fans choose to lend them. Don't market it as an investment.
