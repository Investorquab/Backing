# Backing security notes

**Status: unaudited hackathon code.** The tests below are our own attempt to break the contract. They raise confidence, but they are not an audit. Keep mainnet amounts small until an independent audit is done.

## What the contract promises

1. **A backer can always get back exactly what they put in.** Never more, because backers earn no return. Never less, unless the underlying vault itself loses money.
2. **Creators only receive yield.** That's the yield on the money backing them, while it backs them.
3. **If the vault loses money, everyone shares the loss equally.** Withdrawing first doesn't help you.
4. **Nobody can move or redirect someone else's money.**

## How we tried to break it

`contracts/test/` has 34 tests. Run them with `cd contracts && forge test`.

### Attack tests (`test/Attacks.t.sol`)

| # | Attack | Result |
| --- | --- | --- |
| 1 | **Bank run after a vault loss.** Three backers, the vault loses 10%, they leave one by one | Every exit pays `value / owed`, so all three get 90%. Without this, the first to leave would get 100% and the last would absorb the whole loss |
| 2 | **Idle-yield sniping.** Everyone stops backing, a creator's unclaimed balance keeps growing, then the creator backs themselves from a second wallet to capture that growth | Growth while nothing is backed goes to the reserve, not to the next backer |
| 3 | **Reentrancy.** A malicious vault calls back into Backing during deposit and withdraw | Blocked by `nonReentrant` on every function that moves money |
| 4 | **ERC-4626 inflation attack.** Donate into an empty vault so the next deposit rounds down to almost no shares | `back` reverts with `DepositLoss` if the shares received are worth less than the deposit (0.001% tolerance). The demo vault also uses virtual shares and is pre-seeded at deploy |
| 5 | **Donating to the vault** to move the share price | Becomes creator yield. Backers still exit exactly whole |
| 6 | **USDC sent straight to the contract** | Ignored. It isn't counted and nobody can withdraw it |
| 7 | **Rounding drain.** 150 tiny in/out cycles | No profit, and the other backer is untouched |
| 8 | **Withdrawing someone else's principal** | Reverts |
| 9 | **Double claim inside one epoch** | Reverts |
| 10 | **Creator claiming during a shortfall** | Takes the same haircut as backers |
| 11 | **Username squatting.** Taking a name someone already has | Reverts with `UsernameTaken`. A name is only free again after its owner changes it |
| 12 | **Fake referrals.** Referring yourself, or a wallet with no profile | Counts nothing |

### Random-sequence testing

- **`testFuzz_solvency`** (`test/Backing.t.sol`): random backings, withdrawals and claims. Afterwards every backer exits with exactly their deposit, and creators receive what the app showed them. Run 2,000 times with no failure.
- **Invariant suite** (`test/Invariant.t.sol`): a handler fires random backings (with referrers), withdrawals, claims, time jumps, vault donations and **vault losses**. After every call it checks four properties:
  1. Fans never withdraw more than they deposited.
  2. Positions, creator totals and `totalPrincipal` always agree.
  3. With no loss, the vault always holds what is owed, give or take a few wei of rounding.
  4. The reserve is always backed by real surplus.

  Run 256 × 120 calls (30,720 per property) with "any revert is a failure" switched on: **0 failures, 0 reverts.**

## Design choices that limit risk

- **No admin, no upgrades, no fees.** Nobody can pause the contract, change the vault, or take money. The vault address is fixed at deploy.
- **The deploy script checks the vault.** It refuses unless `vault.asset()` is USDC and the vault already holds assets.
- **`health()`** shows the vault's value, what is owed, and the reserve, so anyone can check solvency on BaseScan.
- **A small loss hits the reserve first**, before anyone's principal.

## Known limits (accepted for v1)

- **Vault risk.** Principal sits in a third-party ERC-4626 vault (Morpho on mainnet). A bug or bad debt there is shared by all backers (see #1). Withdrawals can also wait if the vault is temporarily fully lent out.
- **Rounding dust.** A few wei per operation stays in the vault, which favours solvency.
- **Unbounded views.** `getBackers`, `getBacking` and `getPeople` return arrays. They're fine for hundreds of people, but an indexer is needed beyond that.
- **Public content.** Posts and profiles are public and permanent. The website can hide wallets (`NEXT_PUBLIC_HIDDEN_ADDRESSES`), but the chain keeps everything.
- **Base names** in profiles are typed by the user and not verified on-chain.

## Reporting a problem

Open a GitHub issue without exploit details, or contact the maintainer directly. Please don't test on mainnet with other people's funds.
