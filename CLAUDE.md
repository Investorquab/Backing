# Backing — notes for Claude Code

Read this whole file before doing anything. Then follow **How to work this session** at the bottom: audit first, plan with me second, build third.

## Who you're working with

- I'm quadri (GitHub: Investorquab), in Lagos (UTC+1), on **Windows**.
- **I'm a beginner. Guide me step by step.** Say which terminal to use (PowerShell or Git Bash), give exact commands, and explain in plain words what each step does.
- Keep things simple. I asked for a simple app on purpose.
- **The UI must not copy X / Twitter.** It has its own look (see Design).

## The project

**Backing** is my entry for Vibestarter **Vibeathon 02** (theme: "Night shift").

**Deadline: Mon 9 Nov 2026, 22:00 UTC (11pm Lagos).** Submit at app.vibestarter.xyz/vibeathon/submit with my wallet. Required: name, one-line tagline, **a live URL to a working app**, what it does and what to try, and the AI tools used.

Judging (each judge scores 1–10, weighted to a total out of 100):

| Criterion | Weight | Question |
| --- | --- | --- |
| Execution | 30 | Does the live app work end to end? |
| Launch potential | 25 | Real users, a reason to exist, a path from MVP to product |
| Originality | 20 | Fresh idea, or a familiar one done a new way |
| Craft & UX | 15 | Design, copy, responsiveness, feel |
| Vibecoding leverage | 10 | How well AI tools were used |

**The app is not live anywhere yet.** Getting a working live URL matters more than any new feature.

### What it does

Fans back creators with USDC instead of tipping.

- The USDC goes into an ERC-4626 lending vault (Morpho on mainnet; a demo vault on testnet).
- **The fan's principal stays theirs** and can be withdrawn any time.
- **The yield goes to the creator**, who claims it each epoch.

The app around that:

- **Wallet = account.** A profile has a username, Base name, picture, bio and link.
- **Feed** with Everyone / People I back tabs. Anyone with a profile can post text plus a picture.
- **Back** button on every post and profile. Withdraw all or some any time.
- **Profile pages** at `/u/[name]`: posts, backers, who they back, live earnings.
- **"Back them too" invite links** (`?ref=address`). The referrer's count is stored on-chain.
- **Notifications**, **search** and **portfolio**: earnings and claims, who you back (with loyalty badges), and how income can grow.
- The same code runs as a **Base App mini app**.

## Stack and layout

```
contracts/   Foundry, Solidity 0.8.26, via_ir, OpenZeppelin 5.1
  src/Backing.sol        everything on-chain: profiles, posts, backing, yield, claims, invites, activity
  src/mocks/             MockUSDC (faucet) + MockYieldVault (sped-up yield, simulateLoss). Testnet/local only
  script/Deploy.s.sol    MODE=demo (mocks) or MODE=live VAULT=0x… ; writes web/src/deployments/<chainId>.json
  script/Seed.s.sol      sample creators, fans, posts, backings (SEED_IMAGE_BASE for pictures)
  test/                  34 tests: unit + fuzz, 12 attack tests, 4 invariants, 1 fork test
web/         Next.js 15, React 19, wagmi 2, viem 2, TanStack Query 5, Tailwind 4, lucide-react
  src/app/               / (feed), /search, /notifications, /portfolio, /profile/edit, /u/[name], /security
  src/app/api/upload     wallet-signed picture uploads → Vercel Blob (local dev: public/uploads)
  src/app/api/card       share-card image for Base App / social previews
  src/app/.well-known/farcaster.json   mini app manifest
  src/lib/hooks.ts       all contract reads + useTx (chain switch, 30% gas buffer)
scripts-local.sh   local Anvil chain + deploy + seed in one command
README.md, SECURITY.md
```

There is **no backend and no database**. Everything lives on-chain except pictures, which are in Vercel Blob.

Networks:

- Local Anvil (31337)
- Base Sepolia (84532), the free demo
- Base (8453), real USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## Commands

- **Contracts (Git Bash):**
  ```
  export PATH="$HOME/.foundry/bin:$PATH"
  cd contracts && forge test
  ```
- **Local chain (Git Bash):**
  ```
  taskkill //IM anvil.exe //F
  MY_WALLET=0x… bash scripts-local.sh
  ```
  The `kill: No such process` message at the end is harmless on Windows.
- **Web (PowerShell):**
  ```
  cd web
  npm ci --fetch-timeout=600000 --fetch-retries=5
  npm run dev
  ```
- **Before any commit:**
  - `forge test`
  - in `web/`: `npx tsc --noEmit` and `npx next build`

## Rules

1. **Ask before adding anything that needs a backend**: a server, a database, an indexer, cron jobs, paid APIs, or new third-party accounts or keys. Explain why it's needed, what it costs, and what the simpler option is. Then wait for my answer.
2. **Ask before changing `Backing.sol`.**
   - It's tested and close to deploy, and any change means redeploying and reseeding.
   - If you change it, keep all 34 tests passing, add tests for the change, and keep the contract under 24KB.
   - Don't weaken the safety properties below.
3. **Never ask me for a private key, seed phrase, password or API secret, and never put one in a file or commit.**
   - Deploys use Foundry's encrypted keystore: `cast wallet import deployer --interactive`, then `--account deployer`.
   - If I paste a secret by mistake, tell me to delete it and rotate it.
4. **Don't deploy to Base mainnet** unless I explicitly ask. Even then, start with $1–5. The contract is unaudited.
5. **Commit in small steps** with clear messages. Tell me when to push.
6. **Prefer finishing and polishing over new features.** Deadline first.

### Contract safety properties (don't break these)

- A backer can always withdraw exactly what they put in. Never more. Never less, unless the vault itself loses money.
- Creators only ever get yield.
- A vault loss is shared pro-rata: every exit pays `value / owed`, so leaving first doesn't help.
- Yield while nothing is backed goes to `reserve`, not to the next backer.
- `back` reverts with `DepositLoss` if the vault shares come back short. This blocks the ERC-4626 inflation attack.
- `nonReentrant` on everything that moves money. No admin, no upgrades, no fees.

## Design

The direction came from the [unslop](https://github.com/heydamir/unslop) skill.

- Dark ink neutrals and one accent: lamp amber `#f0a83a`.
- A "lit window" signature: WindowMark, and TheBlock visual on profiles.
- Instrument Sans for text, Geist Mono for numbers.
- No gradients, no glows, no bold-everything, no emoji labels.
- Component classes (`.btn`, `.surface`, `.input`) live in `@layer components` in `globals.css`.
- The layout is a single 680px column, with a top bar on desktop and a tab bar on mobile.

## Known open items

- **Not live.** Vercel is not set up. It needs:
  - Root Directory = `web`
  - `NEXT_PUBLIC_SITE_URL`
  - a Blob store for uploads
- **Base Sepolia not deployed or seeded.** The seed needs `SEED_IMAGE_BASE=https://<site>/demo`.
- **Base App** domain signing isn't done (the `FARCASTER_*` env vars). The steps weren't verified against Base's current docs.
- **No real Morpho vault address chosen or verified** for mainnet.
- Unbounded view arrays (`getPeople`, `getBackers`). Fine for a hackathon; an indexer would be needed at scale.
- **Coming next (deliberately left out of v1):** comments, timed or locked backing, X account linking, push notifications.

---

## How to work this session

### Step 1: Audit (no code changes yet)

Read the code and run the checks, then give me a short report ranked by importance. Mark each finding as **must fix before deadline**, **should fix** or **later**. Cover:

1. **Does it run?**
   - `forge test`, `npx tsc --noEmit`, `npx next build`
   - the local flow: connect, profile, faucet, back, withdraw, post with picture, claim, invite link, notifications, search, portfolio
2. **Contract:** correctness and safety against the properties above, gas, and anything a judge or user could break.
3. **Frontend:**
   - bugs, broken states, loading and error states, empty states
   - mobile at 390px wide, accessibility, confusing copy
4. **Deploy readiness:**
   - what's missing to get a live URL on Vercel plus Base Sepolia
   - env vars, Blob, image hosts, the mini app manifest
5. **Score against the judging criteria:** where we'd lose points and the cheapest way to win them back.

Explain the report in plain words. I'm a beginner.

### Step 2: Plan together

Propose a plan that fits the time left before **Mon 9 Nov, 22:00 UTC**:

- Put **going live first**, then fixes, then polish.
- Give each item a rough time and say why it matters for judging.
- Clearly flag anything that would need a backend, an external account, a key or money, and **ask me** before including it.
- Ask me anything you need to decide. Then wait until I approve the plan.

### Step 3: Build

- Work through the approved plan in small, tested commits.
- After each step, tell me what changed, what to run, and what I should see.
- Walk me through the Vercel and Base Sepolia deploy click by click when we get there.
