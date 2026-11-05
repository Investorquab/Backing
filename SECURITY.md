# Backing security notes

**Status: unaudited hackathon code.** The tests below are our own attempt to break the contract. They raise confidence, but they are not an audit. Keep mainnet amounts small until an independent audit is done.

## What the contract promises

1. **A backer can always get back exactly what they put in.** Never more: backers earn no return. Never less, unless the underlying vault itself loses money.
2. **Creators only receive yield.** That's the yield on capital backing them, while that backing is active.
3. **If the vault loses money, everyone shares the loss equally.** Withdrawing first doesn't help you.
4. **Nobody can move or redirect someone else's money.**

## How we tried to break it

`contracts/test/` has 43 tests. Run them with `cd contracts && forge test`.

### Attack tests (`test/Attacks.t.sol`)

| # | Attack | Result |
| --- | --- | --- |
| 1 | **Bank run after a vault loss.** Three backers, the vault loses 10%, they leave one by one | **Fixed during testing.** Every exit now pays `value / owed`, so all three get 90%. Before the fix, the first two would have got 100% and the last would have absorbed the whole loss |
| 2 | **Small loss** | Hits the reserve first, so backers' principal is untouched |
| 3 | **Idle-yield sniping.** Everyone leaves, a creator's unclaimed balance keeps growing, then the creator backs themselves from a second wallet to capture that growth | **Fixed during testing.** Growth with nothing backed goes to the reserve |
| 4 | **Reentrancy.** A malicious vault calls back into Backing during deposit and withdraw | Blocked by `nonReentrant` on every function that moves money |
| 4b | **ERC-4626 inflation attack.** Donate into an empty vault so the next deposit rounds down to almost no shares | **Fixed during testing.** `back` reverts with `DepositLoss` if the shares received are worth less than the deposit (0.001% tolerance). The demo vault also uses virtual shares and is pre-seeded at deploy |
| 5 | **Donating to the vault** to move the share price | Becomes creator yield; backers still exit exactly whole |
| 6 | **USDC sent straight to the contract** | Ignored. It isn't counted and can't be withdrawn by anyone |
| 7 | **Rounding drain.** 150 tiny in/out cycles | No profit, and the other backer is untouched |
| 8 | **Closing someone's ended backing to redirect it** | The money always goes to the backer, never to the caller |
| 9 | **Withdrawing someone else's principal** | Reverts |
| 10 | **Double claim / early claim** | Reverts (one claim per epoch) |
| 11 | **Creator claiming during a shortfall** | Takes the same haircut as backers |

### Random-sequence testing

- **`testFuzz_solvency`:** 30 random actions per run, including timed and locked backings, early exits, closes and claims. Afterwards every backer exits with exactly their deposit, and every creator receives exactly what the app showed them. Run 2,000 times with no failure.
- **Invariant suite** (`test/Invariant.t.sol`): a handler fires random backings (any duration, locked or not), withdrawals, closes, claims, time jumps, vault donations and **vault losses**. After every call it checks four properties:
  1. Fans never withdraw more than they deposited.
  2. Positions, creator totals and `totalPrincipal` always agree.
  3. With no loss, the vault always holds what is owed, give or take a few wei of rounding.
  4. The reserve is always backed by real surplus.

  Run 256 × 120 calls (30,720 per property) with "any revert is a failure" switched on: **0 failures, 0 reverts.**

## Design choices that limit risk

- **No admin, no upgrades, no fees.** Nobody can pause the contract, change the vault, or take money. The vault address is fixed at deploy.
- **The deploy script checks the vault.** It refuses unless `vault.asset()` is USDC and the vault already holds assets.
- **`health()`** shows the vault's value, what is owed, and the reserve, so anyone can check solvency on BaseScan.
- **Timed backings.** Yield earned after a backing ends moves from the creator to the reserve when the position is next touched. Anyone can `close` an ended backing, and the app closes yours when you open it.
- **Locks only ever extend,** never shorten. A lock never stops `close` after the end time.

## Known limits (accepted for v1)

- **Vault risk.** Principal sits in a third-party ERC-4626 vault (Morpho on mainnet). A bug or bad debt there is shared by all backers (see #1). Withdrawals can also wait if the vault is temporarily fully lent out.
- **End-time precision.** Yield after a backing's end time is split from the creator's share by time (linear interpolation). If the creator claims before the backing is closed, they can keep that small amount. It's yield only, and it never touches principal.
- **Rounding dust.** A few wei per operation stays in the vault, which favours solvency.
- **Unbounded views.** `getBackers` and `getPositions` return whole arrays. They're fine for hundreds of backers per creator, but an indexer is needed beyond that.
- **Public content.** Posts, comments and profiles are public and permanent. The website can hide wallets (`NEXT_PUBLIC_HIDDEN_ADDRESSES`), but the chain keeps everything.
- **X handles** are checked by the website against a public X post, not by the contract.

## Reporting a problem

Open a GitHub issue without exploit details, or contact the maintainer directly. Please don't test on mainnet with other people's funds.
