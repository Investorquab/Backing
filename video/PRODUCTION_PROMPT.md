# BACKING — MASTER DEMO VIDEO PRODUCTION PROMPT

## A ~2:20 cinematic product film for Vibeathon 02 ("Night shift")

You are acting as a world-class product filmmaker, creative director, documentary-style
commercial director, senior motion designer, sound designer, male voiceover director, and a
technically rigorous web3 product storyteller.

Your task is to create a polished, cinematic, **technically accurate** demonstration video for
**Backing**, a live app where fans back creators with USDC instead of tipping — the fan's deposit
stays theirs and is withdrawable any time, while only the *yield* goes to the creator.

This is not a request for a storyboard alone. Inspect the repository, understand the real product,
design the narrative, produce the assets, generate the voiceover, edit and render the video, inspect
the finished output, and fix issues before declaring it complete.

The finished film should feel like a sophisticated fintech product film — not a template hackathon
video, a generic blockchain ad, an AI slideshow, or a screen recording with narration.

Primary audience: **Vibeathon 02 judges** (Execution, Launch potential, Originality, Craft & UX,
Vibecoding leverage). Secondary: onchain creators and Base/Farcaster builders.

The video must land three things:

1. The problem is real and instantly understandable (support today either vanishes or is risky).
2. Backing has a distinctive, **working** solution: back with money you keep, creators earn the yield.
3. It is worth backing and building on — shown through the real app, not claims.

---

# PART 1 — NON-NEGOTIABLE REQUIREMENTS

## Deliverable

* Target duration: ~2 minutes 20 seconds. Acceptable: 2:00–2:40.
* 1920 × 1080, 16:9, 30 fps.
* MP4, H.264 video, AAC audio.
* Clear natural male narration, mixed music, restrained sound design.
* Presentation-ready for a competitive build competition.

Primary filename: `Backing_Vibeathon02_Master.mp4`
Output folder: `video/` (keep assets, narration, music attribution, render scripts, storyboard and
notes in subfolders). Do **not** deliver only a script, storyboard, screenshots, or an un-rendered,
un-inspected file.

## Mandatory voice direction

**The narrator must sound like a real adult man speaking naturally — not a voice assistant.**

Voice: adult male, warm, grounded, conversational, medium-to-low register (not forced-deep), clear
English with a broadly understandable accent, relaxed confidence, natural phrasing and emphasis,
moderate pace with intentional pauses. It should sound like a founder who understands the idea
explaining it to a smart friend.

Avoid: robotic TTS cadence, corporate-announcer polish, trailer-deep voices, synthetic enthusiasm,
uniform pitch, every sentence ending on the same downward note, over-pronounced technical terms,
phone-system AI voices.

### Voice workflow

1. Write the final spoken script first.
2. Pick the best natural male voice available in the environment.
3. Generate a short test passage and evaluate it; reject anything robotic or theatrical.
4. Generate the full narration in sections for consistent pronunciation; keep one consistent voice
   identity and loudness throughout.
5. Assemble with natural pauses. Avoid heavy denoise, reverb, or pitch-shifting that sounds synthetic.
6. If no natural voice tool exists, do not silently ship an obviously robotic one — document the
   limitation and recommend an alternative. Do not claim a voice sounds natural just because synthesis
   completed.

---

# PART 2 — UNDERSTAND THE PRODUCT BEFORE FILMING

Live app (Base Sepolia **testnet**): `https://backing-base.vercel.app`
Repository: `https://github.com/Investorquab/Backing`
Build competition: Vibestarter Vibeathon 02, theme **"Night shift"**.

Before filming, inspect the real repo and running app. Read `CLAUDE.md`, `README.md`,
`SECURITY.md`, `contracts/src/Backing.sol`, the mocks and deploy/seed scripts, `contracts/test/`,
and `web/src/` (feed, profile, back, withdraw, Farcaster integration, hooks). **Verify every claim
against the code** — do not assume this brief is perfect.

Known facts to verify, not trust blindly:

* **Chain / status:** Live on **Base Sepolia testnet (84532)** today. It is a working demo with test
  USDC — **not yet on mainnet**. Do not imply mainnet is live.
* **Testnet contracts** (confirm against `web/src/deployments/84532.json`): Backing
  `0xf84dC7cE8b303c3A8a1C56E8028D3932D0A906E3`, USDC
  `0xDbc14C35702d21dA80BC876ff67D6d831aFe84B0`, demo vault
  `0x31B7ACa90fc77266C73A76f4EFBA7417f953aE30`.
* **Mainnet vault (chosen, wired, not yet deployed):** Moonwell Flagship USDC on Base
  `0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca`, an established ERC-4626 vault, ~4.3% APY, verified to
  charge **no** deposit/withdraw fees. The testnet runs a **sped-up demo vault** so a month of yield
  is visible in seconds.
* **Contract:** Solidity 0.8.26, OpenZeppelin 5.1. A test suite covering unit, fuzz, invariant and
  attack tests plus a mainnet fork test — **confirm the exact count with `forge test`** (around 32).
  No admin, no upgrades, no fees; `nonReentrant` on everything that moves money; a constructor guard
  that refuses any vault charging deposit/withdraw fees; a `DepositLoss` guard that blocks the
  ERC-4626 inflation attack; vault losses shared pro-rata.
* **App surfaces:** Feed with **Everyone / People I back / On Farcaster** tabs (the last shows *real*
  Farcaster casts from Base builders, each backable in place), a Back button everywhere, Withdraw
  (all or partial) any time, profiles at `/u/[name]`, "back them too" invite links, notifications,
  search/discover, portfolio, and the same code as a Base App mini app.
* **Third-party credibility:** scored **FUNDABLE (82/100)** by Vibestarter's own Fundable tool.
  Receipt image: `video/assets/fundable-score.png`.

Produce, before filming:

* `video/FACTS.md` — verified facts vs. unverified claims.
* `video/CAPABILITIES.md` — implemented & demonstrated / implemented but not shown / planned / not
  supported. The film must never present planned work (e.g. mainnet) as live.
* `video/STORYBOARD.md`, `video/VOICEOVER.md`, `video/SHOT_LIST.md`.

---

# PART 3 — THE CORE STORY

**One line:** Back the creators you follow with USDC that stays yours — they earn the yield, you keep
your money.

**Tagline:** *"Back the creators you follow, with money you keep."*
**Secondary:** *"Support that costs you nothing."*

**The central insight:** Supporting creators today forces a bad trade. A tip is gone the moment it's
sent. A creator coin can pump and dump and take the trust with it. Both ask the fan to give something
up. Backing removes the trade: you stake USDC behind a creator, it earns yield in an onchain lending
vault on Base, the creator claims that yield, and your deposit stays yours — withdraw it in full,
any time. Support becomes recurring, principal-safe, and it costs the fan nothing but the upside.

**The emotional arc:**
1. Recognition — "I follow people I'd love to support."
2. Friction — "But tipping is money gone, and coins are a gamble."
3. Discovery — "What if supporting them cost me nothing?"
4. Proof — "This is a real, working app, and I can see the loop."
5. Possibility — "This could be the way fans fund creators on Base."

Make the film about the *experience* Backing enables, not blockchain in the abstract.

---

# PART 4 — VISUAL CREATIVE DIRECTION

## Creative concept: THE LIT WINDOW ("Night shift")

The signature image is a **lit window at night**. A dark building — or a quiet city skyline — where a
window warms to amber the moment a creator gets backed. Backing someone is keeping their light on
through the night shift. The recurring motion is: USDC flows in → a window lights amber → the
creator's earnings tick upward → the fan's principal stays whole and can slide back out untouched.
Let that one mechanism be the visual spine of the whole film.

## Brand identity (use the real one — pull exact tokens from `web/src/app/globals.css`)

* Dark ink neutrals for backgrounds and surfaces (near-black, soft charcoal).
* One accent: **lamp amber `#f0a83a`** — used for emphasis and the lit windows, never everywhere.
* Signature marks: the **WindowMark** (the lit-window glyph) and the **TheBlock** motif on profiles.
* Type: **Instrument Sans** for text, **Geist Mono** for numbers, addresses and figures.
* The look is quiet and confident: no gradients, no glows, no gradient text, no emoji labels, no
  bold-everything.

## Style

Aim for: premium fintech restraint, calm cinematic lighting, elegant motion graphics, carefully
composed real product UI, precise geometric animation, beautiful type and negative space, clear
hierarchy, a warm-amber-on-dark palette, authentic onchain evidence.

Avoid: purple/blue blockchain gradients, neon crypto imagery, floating coins, stock footage of people
at laptops, futuristic cityscapes, glowing effects, 3D token renders, fake dashboards, glitch/hacking
visuals, endless scrolling code, PowerPoint-looking slides, unreadable walls of text.

The film should feel expensive because of restraint, not excess. Amber is a highlight against dark,
not a wash.

---

# PART 5 — FILM STRUCTURE

Build `STORYBOARD.md` before rendering. Timings are a guide; adjust slightly for natural narration and
convincing demos. The draft narration below is a starting point — refine it, don't read it robotically.

## SCENE 1 — THE HOOK · 0:00–0:12
Open immediately, no multi-second logo intro. A dark skyline at night; one window is lit amber.
Headline resolves cleanly:
**THE CREATORS YOU FOLLOW ARE UP LATE TOO.**
Then: **SUPPORTING THEM SHOULDN'T COST YOU EVERYTHING.**
*VO (curious, warm):* "The people you follow are building at 2am. You'd back them if you could — but
every way to do it asks you to give your money away."

## SCENE 2 — THE FRICTION · 0:12–0:32
Two quiet, honest vignettes. A **tip**: USDC leaves the fan and simply disappears — nothing left.
A **creator coin**: a line spikes, then dumps; the amber dims. No fabricated numbers.
On-screen: **A TIP IS GONE THE MOMENT IT'S SENT.** / **A COIN CAN DUMP AND TAKE THE TRUST WITH IT.**
*VO:* "A tip is spent once and it's gone. A creator coin can pump, then dump, and take the
relationship down with it. Both ask the fan to lose something."

## SCENE 3 — INTRODUCING BACKING · 0:32–0:46
Transition to the product. Real WindowMark and wordmark. A clean path forms:
**YOU → USDC in an onchain vault → THE CREATOR EARNS THE YIELD.** A window lights amber.
On-screen: **BACKING** / *Back the creators you follow, with money you keep.*
*VO:* "Backing is different. You stake USDC behind a creator. It's not a gift — it's a deposit that
stays yours."

## SCENE 4 — THE LOOP (the mechanism) · 0:46–1:14
The most important explanatory section. Four short, legible steps, each with restrained motion:
1. **Back** — a fan puts USDC behind a creator (the window lights amber).
2. **It earns** — the USDC is supplied to an audited lending vault on Base and earns yield.
3. **They claim** — the creator claims that yield each epoch; their earnings tick up.
4. **You withdraw** — the fan slides their full principal back out, any time, untouched.
On-screen, compact: **BACK · IT EARNS · THEY CLAIM · YOU WITHDRAW**
*VO:* "Your deposit earns yield in a lending vault on Base. The creator claims that yield every
epoch. And your money? Still yours — pull it back in full whenever you want. The support costs you
nothing but the upside."
Keep it honest: the fan's principal is never spent; only the yield moves to the creator.

## SCENE 5 — THE REAL PRODUCT · 1:14–1:44
Prove it exists. Use **real captures** from `backing-base.vercel.app` — never invented UI.
Show the strongest verified flow: connect wallet → a profile/feed → press **Back** on a creator →
the creator's live earnings begin to tick (the demo vault is sped-up, so this is visible) → open
**Portfolio** showing "your money is still yours" with yield sent → **Withdraw** returns the full
principal. Then cut to the **On Farcaster** tab showing **real** Base-builder casts, each with a
Back / Invite action — proof the feed is real, not mock. Clean browser frames, no personal data, no
devtools, no stray tabs. Smooth crops and camera moves; never fake a balance, tx hash or status.
On-screen: **LIVE ON BASE. REAL CREATORS. REAL WITHDRAWALS.**

## SCENE 6 — WHY BASE + FARCASTER · 1:44–2:00
Explain the fit, briefly. Base: cheap gas and native USDC make the deposit-earn-withdraw loop
practical for small amounts. Lending on Base (e.g. **Moonwell Flagship USDC**, ~4.3% APY, no fees) is
where the real yield comes from. Farcaster: Backing plugs into where creators already post, so it's a
funding layer on top of the social graph, not another feed to maintain.
On-screen: **BUILT ON BASE. PLUGGED INTO FARCASTER.**
*VO:* "Base makes the loop cheap enough to matter, and the yield comes from real onchain lending.
Backing sits on top of where creators already are, on Farcaster."

## SCENE 7 — SAFE WITH YOUR MONEY · 2:00–2:16
Quiet, highly legible layout. Three guarantees enforced by the contract (verify first):
1. **Your principal is always withdrawable, to the cent** — the contract can never take more than the
   vault earns.
2. **No admin, no upgrades, no fees** — with a re-entrancy guard on everything that moves money, and a
   guard that refuses any vault that skims a fee.
3. **Tested hard** — unit, fuzz, invariant and attack tests, plus a mainnet fork test (show the real
   count from `forge test`).
Honest disclosure, legible not alarmist: **Unaudited. Testnet demo. Use small amounts.**
Avoid "unhackable", "perfectly secure", "guaranteed". Show the contract/repo link where appropriate.

## SCENE 8 — CREDIBILITY + CLOSE · 2:16–2:25
Briefly show the **Fundable receipt** as third-party validation: the FUNDABLE stamp and 82/100
(`video/assets/fundable-score.png`), on screen just long enough to read, framed cleanly — not the
centerpiece, a credibility beat. Then return to the skyline: more windows warm to amber as creators
get backed.
Headline: **BACK THE CREATORS YOU FOLLOW. WITH MONEY YOU KEEP.**
End card (readable, restrained):
`backing-base.vercel.app` · `github.com/Investorquab/Backing` · Vibeathon 02 — Night shift
Resolve cleanly, no confetti, no long thank-you screen. Leave time to read the links.

---

# PART 6 — VOICEOVER WRITING RULES

Write spoken English, not documentation. A technically informed founder explaining something useful.
Use contractions; prefer short sentences and varied rhythm; explain simply.

Ban phrases like: "in today's rapidly evolving landscape", "revolutionizing DeFi", "seamless and
frictionless", "unlocking unprecedented opportunities", "the future is here", "game-changing", "a
groundbreaking paradigm shift".

Don't read the UI word-for-word or narrate every animation; complement the visuals. Target roughly
**300–340 spoken words** and leave breathing room for the demo. Pick the few details that best explain
the loop, prove the build, and establish Base/Farcaster relevance — don't cram the whole brief in.

Before recording, produce a table: Scene · exact narration · estimated duration · visual action ·
on-screen text · pronunciation notes. Check spoken claims match the footage. Pronounce consistently:
"Backing", "USDC" (letters), "Base", "Farcaster", "Moonwell", "ERC-4626", "Vibeathon". Never have the
voice read contract addresses or long hashes — show those on screen.

---

# PART 7 — MUSIC & SOUND

Premium, restrained: minimal electronic pulse, warm ambient texture, light percussion, subtle low
end, a controlled build, no competing melody, no epic-trailer orchestra, no dubstep/cyberpunk.
Begin with quiet ambience; add a light pulse in the loop section; keep the demo precise and
confident; resolve the close without an explosion. Subtle, tactile SFX for: a backing (a soft warm
"on" as the window lights), yield ticking, a confirmed withdrawal. Don't make transactions sound like
arcade actions. Mix narration clearly above the music; check levels, avoid clipping and harsh
sibilance. Use only music licensed for this use; record attribution.

---

# PART 8 — PRODUCT CAPTURE & MOTION

Use the live app and repo as the source of truth. Capture real screenshots/recordings at high
resolution from `backing-base.vercel.app` (or a clean local build). Hide sensitive info. Do not fake
UI, balances, or status. The demo uses **test** USDC on Sepolia — that's ideal; you can show real
testnet actions freely. Build reusable, consistent motion components for: fan/wallet, USDC deposit,
the vault, the lit window, the creator's earnings, the withdraw path, and the On-Farcaster feed.
Motion should communicate causality (deposit → window lights → creator earns; withdraw → principal
returns whole). Use the amber-on-dark palette consistently. The animation must read even for someone
who's never heard of ERC-4626; keep technical labels available but secondary.

---

# PART 9 — PROOF & FACTUAL ACCURACY

The strongest proof is the working app. Use concise on-screen evidence over long claim lists.

Verify against the code before stating: the test suite and its count, the no-admin/no-upgrades/no-fees
properties, the fee-vault and `DepositLoss` guards, the withdraw-exact-principal guarantee, and the
Moonwell vault details.

Do **not** fabricate: user counts, volume, adoption, partnerships, revenue, testimonials, audit
results, or performance numbers. The seeded demo creators and backings are **sample data** — never
present them as real traction. Do **not** claim mainnet is live; it is wired and ready, testnet is
what's live. Keep security language specific and honest ("unaudited, testnet, use small amounts").
The Fundable 82/100 is real third-party output — show the receipt as-is, don't inflate it.

---

# PART 10 — TECHNICAL WORKFLOW

Inspect the environment for: browser automation/screen capture, audio generation, video editing/
compositing, FFmpeg, SVG/vector animation, audio mixing, frame extraction. Prefer existing tools;
don't install a heavy stack without reason; document trade-offs if a tool is missing.

Phases: **A Audit** (produce `FACTS.md`, `CAPABILITIES.md`) → **B Narrative** (`STORYBOARD.md`,
`VOICEOVER.md`, `SHOT_LIST.md`, check timing) → **C Voice test** (sample, evaluate, revise) →
**D Visual production** (motion assets, real captures, transitions, timeline) → **E Render** (export
the MP4) → **F Inspect** (extract frames from open/transitions/demo/proof/close; check layout,
readability, color, artifacts, misleading frames; verify duration, codec, resolution, fps, audio) →
**G Revise** (fix, re-render, re-inspect). Don't treat the first render as final if defects remain.
Don't claim to have generated/auditioned audio or rendered/inspected video if you didn't.

---

# PART 11 — FINAL QUALITY CHECKLIST

**Story:** first 10s create curiosity · problem clear without crypto knowledge · the back→earn→claim→
withdraw loop explained correctly · real app proves the build · Base/Farcaster relevance specific ·
ending memorable and short.
**Voice:** adult male · natural, conversational · no robotic delivery · correct pronunciation · no
rushed technical passages · narration fits the timeline and sits above the music.
**Visuals:** correct Backing brand (amber `#f0a83a`, dark ink, Instrument Sans/Geist Mono, WindowMark)
· no fake UI · no unreadable code · no clutter · smooth transitions · correct links/addresses · strong
final frame.
**Accuracy:** no unsupported guarantees · no invented traction · demo data not shown as real ·
mainnet not claimed as live · honest security disclosure · Fundable receipt shown truthfully.
**Technical:** MP4 plays start to finish · correct 1080p/16:9/30fps · audio present and synced · no
black frames or clipped narration · correct duration · assets and scripts organized and regeneratable.

---

# PART 12 — REQUIRED DELIVERABLES

1. `Backing_Vibeathon02_Master.mp4`
2. `FACTS.md`
3. `CAPABILITIES.md`
4. `STORYBOARD.md`
5. `VOICEOVER.md`
6. `SHOT_LIST.md`
7. `README.md` (how to reproduce the video)
8. The voiceover audio file
9. The editable/regeneratable project and supporting assets, where practical

On completion, report: exact output path · actual duration · resolution/fps · audio format · voice
method used · whether narration was actually auditioned · which product flows were shown · which claims
were verified · what remains unverified · whether the render was inspected · any remaining limitations.
If a requirement couldn't be met, say so plainly and deliver the best available version. Do not claim
success for work not actually performed.

---

# FINAL CREATIVE DIRECTION

Backing's story isn't that crypto is revolutionary. It's that the people you follow are up late
building, and until now supporting them meant giving your money away or gambling on a coin. Backing
lets you keep your money and still fund them — your deposit earns, they take the yield, you withdraw
whenever. Show the friction. Light the window. Prove the loop in the real app. Explain why Base and
Farcaster make it practical. End on a skyline of windows warming to amber, and the sense that this is
simply how fans should fund creators.

Throughout, the narrator should sound like a real person who gets the problem — not a machine reading
a script.
