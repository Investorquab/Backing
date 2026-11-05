# Backing

**Back creators with money you keep.** Fans stake USDC behind a creator on Base instead of tipping. The USDC goes into an audited ERC-4626 lending vault. The creator gets the yield, the fan's principal stays theirs, and the fan can take it back.

> Your capital works the night shift.

Built for Vibestarter Vibeathon 02 ("Night shift"). It runs as a social website and as a **Base App mini app** from the same code, and it plugs into **X**.

## What you can do

- **Sign in with a wallet.** No password: Base Account (Face ID or fingerprint), a browser wallet, or WalletConnect. Inside Base App you're signed in automatically.
- **Home feed, like X.** *Everyone* and *Following* tabs. Following shows posts from creators you back. Every post has **Back** (where a like would be), **comments** and **share**.
- **Back a creator** from any post or profile:
  - pick an amount
  - pick a length: 1 hour, 1 day, 1 week, 1 month, or ongoing
  - optionally **lock** it for that length, as a stronger promise
  - add a public note

  Flexible backings can be withdrawn any time. When a timed backing ends, it can be closed and the money goes back to the fan.
- **Comments.** Anyone signed in can comment. People who back that creator get a lit-window **Backer** badge.
- **Notifications.** Who backed you, comments on your posts, milestones, and timed backings that have ended.
- **Profiles, like X.** A banner, picture, bio, X link, stats, a live earnings counter, and tabs for **Posts**, **Backers** (with their notes) and **About**.
- **Studio** for creators:
  - claim yield each epoch
  - **post with a picture**, a link, or **one of your X posts**
  - upload a profile picture and banner
  - **link your X account**
- **Discover.** Search by name or **@X username**. If someone isn't on Backing yet, **Invite on X** opens a ready-made post tagging them.
- **Base App.** Profile and post links show as cards with a "Back them" button. One-tap casting, haptics, and "Add to your apps".
- **Security page** at `/security` summarising how we tried to break the contract (see [SECURITY.md](SECURITY.md)).

Everything except picture uploads lives on-chain: profiles, posts, comments, backings and the activity feed. There's no database.

## How X works here (no paid API)

- **Link your X:** Studio gives you a short code (`bk-xxxxxxxx`). You post it from your X account and paste the post's link. Our server reads that public post through X's free oEmbed endpoint and checks the author and the code. Only your wallet can save the handle to your profile, so a match proves the same person controls both. Linked accounts get a check mark.
- **X posts in the feed:** paste one of your X post links into a Backing post. It shows as a card with the post's text and a "View on X" link, and backers can Back you right from it.
- **Invite on X / share on X** use X's standard "post" links.

Pulling *all* of a creator's X posts in automatically would need X's paid developer API and a server. It's listed under "Coming next".

## Repo layout

```
contracts/            Foundry project
  src/Backing.sol       staking, yield attribution, timed/locked backings, profiles, posts, comments, activity
  src/mocks/            Test USDC (faucet) + demo ERC-4626 vault with sped-up yield. Testnet/local only
  script/Deploy.s.sol   MODE=demo (mocks) or MODE=live (real vault). Writes web/src/deployments/<chainId>.json
  script/Seed.s.sol     4 sample creators, posts with pictures, comments and backings
  test/                 43 tests: unit, attacks, fuzzing and invariants (see SECURITY.md)
web/                  Next.js 15 + wagmi 2 + viem + Tailwind 4 + Farcaster mini app SDK
  src/app/              / (feed), /discover, /notifications, /me, /creator (studio), /c/[address], /p/[id], /security
  src/app/api/upload    picture uploads (wallet-signed) to Vercel Blob
  src/app/api/x/*       X post previews and X account linking, via X's public oEmbed
  src/app/api/card      share card image (3:2) for Base App and social previews
  public/demo/          four demo pictures used by the seed script
scripts-local.sh      one-command local chain + deploy + seed
```

## Prerequisites

- Node 20+ and npm
- Foundry, installed from **Git Bash** or WSL on Windows: `curl -L https://foundry.paradigm.xyz | bash`, then `foundryup`

> **Never paste a private key or seed phrase into a chat, an issue, a commit or a `.env` file that gets pushed.** The commands below use Foundry's encrypted keystore.

## 1. Run it locally

```bash
# terminal 1 (Git Bash): tests, then a local chain with sample data
cd contracts && forge test        # 43 tests should pass
cd .. && MY_WALLET=0xYourWalletAddress bash scripts-local.sh

# terminal 2 (PowerShell or any shell): the app
cd web
npm ci
npm run dev                       # http://localhost:3000
```

In your wallet, add a network with RPC `http://127.0.0.1:8545` and chain ID `31337`. Pick **Local** in the network menu, sign in with **Browser wallet**, and tap **Get 1,000 test USDC**.

- **Pictures in local dev** are saved in `web/public/uploads` (git-ignored). No Blob store is needed.
- **Demo post pictures:** run the seed with `SEED_IMAGE_BASE=http://localhost:3000/demo` (the local script does this).

## 2. Deploy the testnet demo (Base Sepolia)

The version judges can try for free. It uses Test USDC and a demo vault at 3,650% a year, so income visibly moves. The UI labels this, and "a month" figures use a realistic 5%.

```bash
cd contracts
cast wallet import deployer --interactive      # once; the key is stored encrypted
# fund that address with a little Base Sepolia ETH (Coinbase Developer Platform faucet)

forge script script/Deploy.s.sol --rpc-url base_sepolia --account deployer --broadcast
SEED_IMAGE_BASE=https://YOUR-SITE.vercel.app/demo \
forge script script/Seed.s.sol --rpc-url base_sepolia --account deployer --broadcast --slow --gas-estimate-multiplier 200
```

This writes `web/src/deployments/84532.json`. Commit and push it.

- **Redeploying** is fine: a new contract starts empty. Run Seed again for sample content.
- **Claims** open every 2 minutes on the demo (`EPOCH_SECONDS` overrides this).

## 3. Deploy on Base mainnet (real USDC, real vault)

1. **Pick a vault.** Open a USDC vault on Base in the Morpho app. Cross-check the address on basescan.org. Prefer a large, established curator.
2. **Check it:**
   ```bash
   cast call $VAULT "asset()(address)" --rpc-url base   # must be 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   cast call $VAULT "totalAssets()(uint256)" --rpc-url base
   BASE_RPC_URL=https://mainnet.base.org VAULT=$VAULT forge test --match-contract Fork -vv
   ```
3. **Deploy:**
   ```bash
   MODE=live VAULT=$VAULT forge script script/Deploy.s.sol --rpc-url base --account deployer --broadcast
   ```
   The script refuses if the vault isn't USDC or is empty. Set `NEXT_PUBLIC_VAULT_NAME`.
4. **Smoke test with $1–5.** This contract is unaudited.

## 4. Put the site online (Vercel)

1. Push to GitHub with the `deployments/*.json` files committed.
2. In Vercel: **Add New → Project**, import the repo, **Root Directory = `web`**.
3. Set the env vars from `web/.env.example`. At minimum, `NEXT_PUBLIC_SITE_URL` = your Vercel URL (no trailing slash).
4. **Picture uploads:** in the Vercel project, open **Storage → Create → Blob**, and connect it to the project. That adds `BLOB_READ_WRITE_TOKEN` for you. Redeploy. Check Vercel's free-tier limits for Blob.
5. Deploy.

## 5. Base App setup (mini app)

The manifest is at `/.well-known/farcaster.json`, and pages carry the `fc:miniapp` card tags. Both were validated against `@farcaster/miniapp-core`'s schema.

1. Deploy to Vercel and set `NEXT_PUBLIC_SITE_URL` to that exact URL.
2. Follow Base's current mini app guide (docs.base.org, "Mini Apps") to **sign your domain** with your Base App / Farcaster account. You'll get `header`, `payload` and `signature`.
3. Put them in Vercel as `FARCASTER_HEADER`, `FARCASTER_PAYLOAD`, `FARCASTER_SIGNATURE` (plus `BASE_BUILDER_OWNER` if the guide asks), and redeploy.
4. Cast a creator's profile link in Base App. It should show a card with **Back them**.

Base App's wallet may not support Base Sepolia. If it doesn't, the app says so. The testnet demo always works in a browser.

## Vibeathon submission checklist

Submit at app.vibestarter.xyz/vibeathon/submit with the wallet you applied with, **before Mon 9 Nov 2026, 22:00 UTC (11pm in Lagos)**. You can edit until then.

- **Project name:** Backing
- **Tagline:** "Back creators with money you keep: your USDC stays yours, its yield pays them."
- **Live URL:** your Vercel URL
- **What to try:**
  1. Sign in (Base Account works with a passkey), tap **Get 1,000 test USDC**.
  2. On **Home**, open a post and tap **Back**. Pick 100 tUSDC, **1 week**, tick **Lock**, add a note. The post's Back count goes up and a window lights up on their profile.
  3. Comment on the post. You get a **Backer** badge.
  4. Open **Following**: it now shows that creator. Open **My backing** to see the lock.
  5. Open **Studio**: create a profile, upload a picture, link your X, post with a picture, claim yield.
  6. **Discover**: search an @X username that isn't on Backing and tap **Invite on X**.
  7. Read **/security**: how we tried to break it.
- **AI tools:** Claude (Cowork) for the contracts, app, tests and security testing, plus the [unslop](https://github.com/heydamir/unslop) design skill by Damir Sokolovsky for the visual pass.
- **Optional:** repo link, a 60–90s video, a screenshot, your X handle, a Fundable score link.

## Coming next

- Automatic import of creators' X posts (X developer API plus a server)
- Verified Base App identity with Quick Auth
- Push notifications
- An indexer for scale
- Moving pictures to IPFS
- An independent audit before larger mainnet amounts

## Security

See [SECURITY.md](SECURITY.md): 43 tests including 12 attack tests, fuzzing and invariants. Three issues were found and fixed during that testing. Unaudited: keep mainnet amounts small.

## Credits

Visual direction made with [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0.
