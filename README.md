# Backing

**Back creators with money you keep.** Fans stake USDC behind a creator on Base instead of tipping. The USDC goes into an audited ERC-4626 lending vault. The creator gets the yield, the fan's principal stays theirs, and the fan can withdraw all of it any time.

> Your capital works the night shift.

Built for Vibestarter Vibeathon 02 ("Night shift"). It runs as a website and as a **Base App mini app** from the same code.

## What you can do

- **Sign in with a wallet.** No password: Base Account (Face ID or fingerprint), a browser wallet, or WalletConnect. Inside Base App you're signed in automatically.
- **Feed.** *Following* shows activity from the creators you back. *Everyone* shows all of Backing: creator updates, backings with the backer's note, milestones, claims and new creators.
- **Discover.** Search creators by name or username and sort them by backing, earnings or newest.
- **Back a creator** with an optional public note. If you opened Backing from a cast in Base App, the backing remembers that cast.
- **Creator profile.** A live earnings counter, "the block" (one lit window per backer, brighter for bigger backers), updates, backers, and the casts that brought in backing.
- **My backing.** Everything you've staked, the yield it has sent, and withdraw buttons.
- **Studio** (for creators). Set up a profile (it auto-fills from your Base App profile), claim yield each epoch, post updates to your backers' feeds, and share or cast your profile.
- **Base App extras.** Profile links show as cards with a "Back them" button, one-tap casting, haptics, and "Add to your apps".

Everything lives on-chain, so there's no server and no database. The feed reads straight from the contract.

## How it works

1. A creator registers a profile (stored on-chain).
2. A fan approves USDC and calls `back(creator, amount, cast, note)`. The contract deposits it into the vault.
3. Yield builds up. The contract attributes it to creators in proportion to the principal behind each one.
4. The creator calls `claim()` once per epoch.
5. The fan calls `unback` / `unbackAll` any time and gets 100% of their principal back.
6. Creators call `post(text, link)` to reach their backers. Every join, backing, claim, update and milestone is appended to an on-chain activity log that the feed reads.

Yield attribution uses a single "yield per unit of principal" accumulator (MasterChef-style). Rounding always favours the contract, so a few wei of dust stay in the vault as a buffer. A 512-run fuzz test checks that after random back/unback/claim sequences, every fan exits with exactly their principal and every creator receives exactly what they were shown.

## Repo layout

```
contracts/            Foundry project
  src/Backing.sol       the protocol: staking, yield attribution, profiles, updates, activity feed
  src/mocks/            Test USDC (faucet) + demo ERC-4626 vault with sped-up yield. Testnet/local only
  script/Deploy.s.sol   MODE=demo (mocks) or MODE=live (real vault). Writes web/src/deployments/<chainId>.json
  script/Seed.s.sol     fills a demo deployment with 4 sample creators, 6 backers and 4 updates
  test/                 24 tests incl. fuzzing, plus an opt-in mainnet-fork test against a real vault
web/                  Next.js 15 + wagmi 2 + viem + Tailwind 4 + Farcaster mini app SDK
  src/app/              / (landing or feed), /discover, /c/[address], /me, /creator (studio)
  src/app/.well-known/farcaster.json   the Base App manifest
  src/app/api/card      the 3:2 share card image (creator name, backing, lit windows)
  src/deployments/      contract addresses per chain (written by the deploy script, commit these)
scripts-local.sh      one-command local chain + deploy + seed
```

## Prerequisites

- Node 20+ and npm
- Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup` (on Windows, run this in Git Bash or WSL)

> **Never paste a private key or seed phrase into a chat, an issue, a commit or a `.env` file that gets pushed.** The commands below use Foundry's encrypted keystore, so your key never appears in plain text.

## 1. Run it locally

```bash
# terminal 1 (Git Bash or WSL): local chain + contracts + sample data
cd contracts && forge test        # 24 tests should pass
cd .. && MY_WALLET=0xYourWalletAddress ./scripts-local.sh

# terminal 2: the app
cd web
npm install
npm run dev                       # http://localhost:3000
```

In your wallet, add a network with RPC `http://127.0.0.1:8545` and chain ID `31337`. `MY_WALLET` received 10 test ETH for gas. In the app, pick **Local** in the network menu, sign in with **Browser wallet**, tap **Get 1,000 test USDC**, then back a creator.

If you restart Anvil, re-run the script. Addresses are deterministic, so nothing in `web/` changes.

## 2. Deploy the testnet demo (Base Sepolia)

This is the version judges can try for free. It uses Test USDC and a demo vault at 3,650% a year, so income visibly ticks up. The UI labels this, and "a month" figures use a realistic 5%.

```bash
cd contracts
cast wallet import deployer --interactive      # paste the deployer key once; it's stored encrypted
# fund that address with a little Base Sepolia ETH (Coinbase Developer Platform faucet)

forge script script/Deploy.s.sol --rpc-url base_sepolia --account deployer --broadcast
forge script script/Seed.s.sol   --rpc-url base_sepolia --account deployer --broadcast --slow --gas-estimate-multiplier 200
```

This writes `web/src/deployments/84532.json`. Commit it. Claims open every 2 minutes on the demo (`EPOCH_SECONDS` overrides this).

## 3. Deploy on Base mainnet (real USDC, real vault)

1. **Pick a vault.** Open a USDC vault on Base in the Morpho app (or one of Moonwell's Morpho-curated vaults). Copy its address and cross-check it on basescan.org. Prefer a large, established curator with real liquidity, because your users' withdrawals depend on it.
2. **Check it on-chain:**
   ```bash
   cast call $VAULT "asset()(address)" --rpc-url base   # must be 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (USDC)
   cast call $VAULT "totalAssets()(uint256)" --rpc-url base
   ```
3. **Fork-test against it** (no money moves): `BASE_RPC_URL=https://mainnet.base.org VAULT=$VAULT forge test --match-contract Fork -vv`
4. **Deploy.** The script refuses if the vault's asset isn't USDC or the vault is empty.
   ```bash
   MODE=live VAULT=$VAULT forge script script/Deploy.s.sol --rpc-url base --account deployer --broadcast
   ```
   This writes `web/src/deployments/8453.json`. Set `NEXT_PUBLIC_VAULT_NAME` to the vault's name. The epoch defaults to 1 day.
5. **Smoke test with small amounts** ($1–5). This contract is unaudited.

## 4. Put the site online (Vercel)

1. Push to GitHub with the `deployments/*.json` files committed.
2. In Vercel: **Add New → Project**, import the repo, set **Root Directory = `web`**.
3. Add the env vars from `web/.env.example`. At minimum set `NEXT_PUBLIC_SITE_URL` to your Vercel URL (no trailing slash).
4. Deploy. The network menu shows every network that has a deployment file. Testnet is the default.

## 5. Base App setup (mini app)

The code is ready: the manifest is at `/.well-known/farcaster.json`, and every page carries the `fc:miniapp` card tags. Both were checked against the official schema in `@farcaster/miniapp-core`. What's left is proving you own the domain:

1. Deploy to Vercel first, and set `NEXT_PUBLIC_SITE_URL` to that exact URL. The signature is tied to the domain, so use the domain you'll submit.
2. Follow Base's current mini app guide (docs.base.org, "Mini Apps") to **sign your domain** with your Base App / Farcaster account. It gives you three values: `header`, `payload`, `signature`.
3. Put them in Vercel as `FARCASTER_HEADER`, `FARCASTER_PAYLOAD`, `FARCASTER_SIGNATURE` and redeploy. If the guide asks for an owner address, also set `BASE_BUILDER_OWNER`.
4. Open `https://your-site/.well-known/farcaster.json` to check the values are there, then use Base's preview tool from the guide.
5. Test: cast a creator's profile link in Base App. It should show the card with a **Back them** button.

Notes:
- Base App's built-in wallet may not support Base Sepolia. If it doesn't, the app says so and suggests switching network. The free testnet demo still works in any browser.
- The Base App username and ID a creator saves come from Base App itself and aren't independently verified. The app labels them as Base App usernames, not as verified accounts.

## Vibeathon submission checklist

Submit at app.vibestarter.xyz/vibeathon/submit, signed in with the wallet you applied with, **before Mon 9 Nov 2026, 22:00 UTC (11pm in Lagos)**. You can edit your entry until then.

- **Project name:** Backing
- **Tagline:** "Back creators with money you keep: your USDC stays yours, its yield pays them."
- **Live URL:** your Vercel URL (the testnet demo works end to end)
- **What it does / what to try:**
  1. Sign in (Base Account works with a passkey), tap **Get 1,000 test USDC**.
  2. Open **Discover**, pick a creator, back them with 100 tUSDC and a note. Watch "Earned from backers" tick up and a window light up.
  3. Your **Feed** now follows them. Open **My backing** and withdraw. You get 100% back.
  4. Open **Studio**, create a profile, post an update, claim your yield.
  5. In Base App: cast a creator's profile link and back them from the card.
- **AI tools:** Claude (Cowork) for the contracts, app and tests, plus the [unslop](https://github.com/heydamir/unslop) design skill by Damir Sokolovsky for the visual pass.
- **Optional:** repo link, a 60–90s video of the flow above, a screenshot, your X handle, a Fundable score link.

**Demo moment:** two windows, a creator's Studio and a fan. The fan backs with a note, the note appears in the feed, a window lights up, and "Ready to claim" starts ticking. The fan withdraws everything, the ticker freezes, and the fan's wallet shows the full principal back.

## Coming next

- Read creators' real Base App casts into the feed (needs a data provider and a small server)
- Verified Base App identity with Quick Auth
- Notifications when someone backs you or a creator posts
- An indexer for scale (the app reads the contract directly, which is fine for hundreds of creators)
- Multiple vaults per creator, and a mainnet launch with an audit

## Security notes and known limits

- Unaudited hackathon code. Principal sits in a third-party ERC-4626 vault: smart-contract, curator and liquidity risk all apply. If the vault takes a loss, yield stops until it recovers. Withdrawals are first come, first served.
- Updates, notes and profiles are public, on-chain and can't be deleted. Hide abusive wallets from the site with `NEXT_PUBLIC_HIDDEN_ADDRESSES`. Picture links are shown as-is (https only).
- Creators can't back themselves. Anyone can donate vault shares to the contract; donations become creator yield.
- Regulatory framing: fans keep 100% of principal and earn no return; creators receive the yield on capital fans choose to lend them. Don't market it as an investment.

## Credits

Visual direction made with [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0.
