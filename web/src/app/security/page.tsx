import type { Metadata } from "next";

export const metadata: Metadata = { title: "Security" };

const ATTACKS: [string, string][] = [
  ["Bank run after a vault loss", "Everyone takes the same haircut. Leaving first doesn't push the loss onto others"],
  ["Small vault loss", "Absorbed by the reserve before any principal is touched"],
  ["Idle-yield sniping", "Growth while nothing is backed goes to the reserve, not to whoever backs next"],
  ["Reentrancy through a malicious vault", "Blocked on every function that moves money"],
  ["ERC-4626 inflation attack", "Deposits that come back short are refused"],
  ["Donating to move the share price", "Becomes creator yield. Backers still exit exactly whole"],
  ["Rounding drain over many tiny backings", "No profit, other backers untouched"],
  ["Squatting a username", "Usernames are unique; only the owner can release one"],
  ["Faking invites", "Referring yourself, or a wallet with no profile, counts for nothing"],
  ["Withdrawing someone else's principal", "Impossible"],
  ["Claiming twice or early", "One claim per epoch"],
];

export default function Security() {
  return (
    <>
      <h1 className="text-[22px] font-medium">Security</h1>
      <p className="mt-1 text-fg-2">How we tried to break Backing</p>
      <div className="mt-5 flex flex-col gap-6 text-[15px]">
        <p className="text-fg-2">
          Backing is unaudited hackathon code. Before deploying, we attacked the contract on purpose: 34 automated tests, including a fuzz test run 2,000 times and four
          invariants checked across 30,720 random actions each, with vault gains and losses mixed in. Three issues turned up during earlier testing and were fixed before deployment
        </p>
        <section>
          <h2 className="mb-2 text-[17px] font-medium">The promises</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-fg-2">
            <li>A backer always gets back exactly what they put in. Never more, and never less unless the vault itself loses money</li>
            <li>Creators only ever receive yield</li>
            <li>A vault loss is shared equally by everyone</li>
            <li>Nobody can move or redirect anyone else&apos;s money. There is no admin and no upgrade key</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-[17px] font-medium">Attacks we tried</h2>
          <dl className="divide-line rounded-[14px] border border-[var(--line)]">
            {ATTACKS.map(([k, v]) => (
              <div key={k} className="px-4 py-3">
                <dt className="font-medium">{k}</dt>
                <dd className="mt-0.5 text-[14px] text-fg-2">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="text-fg-2">
          <h2 className="mb-2 text-[17px] font-medium text-fg">Known limits</h2>
          <p>
            Your principal sits in a third-party vault (Morpho on mainnet), so a problem there affects all backers equally. Keep amounts small until an independent audit. The full
            write-up is in SECURITY.md in the repository, and anyone can run the tests with <span className="num rounded-[4px] bg-raised px-1.5 py-0.5 text-[13px] text-fg">forge test</span>
          </p>
        </section>
      </div>
    </>
  );
}
