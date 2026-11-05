# Backing

**Back creators with money you keep.** Fans stake USDC behind a creator on Base instead of tipping. The USDC goes into an audited ERC-4626 lending vault. The creator gets the yield, the fan's principal stays theirs, and the fan can take it back.

> Your capital works the night shift.

Built for Vibestarter Vibeathon 02 ("Night shift"). It runs as a website and as a **Base App mini app** from the same code.

## What you can do

- **Connect a wallet.** Your wallet is your account: Base Account (Face ID or fingerprint), a browser wallet, or WalletConnect. Inside Base App you're connected automatically.
- **Make a profile.** Username, Base name, picture, bio and a link.
- **Feed.** *Everyone* shows every post. *People I back* shows posts from creators you back. Every post has a **Back** button.
- **Post.** Text and a picture.
- **Back someone.** Pick an amount of USDC. It goes into the vault; its yield goes to them. Withdraw all or some of it any time.
- **Profiles.** Anyone's posts, a live earnings counter, who backs them, and who they back.
- **Back them too.** After backing someone, share an invite link. Friends who back through it count on your profile as people you brought.
- **Notifications.** Who backed you, who stopped, milestones, and who your invite brought.
- **Search** people by username or Base name.
- **Portfolio.** Your earnings and claims, everyone you back (with loyalty badges and withdraw), and how your income can grow.
- **Security page** at `/security`, summarising how we tried to break the contract (see [SECURITY.md](SECURITY.md)).

Everything except pictures lives on-chain: profiles, posts, backings and notifications. There's no database.

## Repo layout

```
contracts/            Foundry project
  src/Backing.sol       profiles, posts, backing, yield, claims, invites, activity
  src/mocks/            Test USDC (faucet) + demo ERC-4626 vault with sped-up yield. Testnet/local only
  script/Deploy.s.sol   MODE=demo (mocks) or MODE=live (real vault). Writes web/src/deployments/<chainId>.json
  script/Seed.s.sol     4 sample creators, 3 fans, posts with pictures and backings
  test/                 34 tests: unit, attacks, fuzzing and invariants (see SECURITY.md)
web/                  Next.js 15 + wagmi 2 + viem + Tailwind 4 + Farcaster mini app SDK
  src/app/              / (feed), /search, /notifications, /portfolio, /profile/edit, /u/[name], /security
  src/app/api/upload    picture uploads (wallet-signed) to Vercel Blob
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
cd contracts && forge test        # 34 tests should pass
cd .. && MY_WALLET=0xYourWalletAddress bash scripts-local.sh

# terminal 2 (PowerShell or any shell): the app
cd web
npm ci
npm run dev                       # http://localhost:3000
```

In your wallet, add a network with RPC `http://127.0.0.1:8545` and chain ID `31337`. Pick **Local** in the network menu, connect with **Browser wallet**, and tap **Get 1,000 test USDC** on the Feed. If your wallet complains about a nonce after you restart the local chain, clear its activity data for that network.

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
  1. Connect (Base Account works with a passkey) and tap **Get 1,000 test USDC** on the Feed.
  2. Make a profile: username, picture, bio.
  3. On the Feed, tap **Back** on a post. Back 100 tUSDC. Watch their earnings tick up on their profile.
  4. Copy the **Back them too** invite link and open it in another wallet.
  5. Post something with a picture.
  6. Open **Portfolio**: your backing, withdraw some, and how your income can grow. Open **Notifications** and **Search**.
  7. Read **/security**: how we tried to break it.
- **AI tools:** Claude (Cowork) for the contracts, app, tests and security testing, plus the [unslop](https://github.com/heydamir/unslop) design skill by Damir Sokolovsky for the visual pass.
- **Optional:** repo link, a 60–90s video, a screenshot, your X handle, a Fundable score link.

## Coming next

- Comments, and timed or locked backings
- Linking X accounts
- Verified Base App identity with Quick Auth
- Push notifications
- An indexer for scale
- Moving pictures to IPFS
- An independent audit before larger mainnet amounts

## Security

See [SECURITY.md](SECURITY.md): 34 tests including 12 attack tests, fuzzing and invariants. Unaudited: keep mainnet amounts small.

## Credits

Visual direction made with [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0.
