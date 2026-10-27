import { ArrowRight, LoaderCircle, UserRound } from "lucide-react";
export type AccountSlug = "mix" | "name";
export const accounts: {
  slug: AccountSlug;
  name: string;
  description: string;
}[] = [
  { slug: "mix", name: "มิก", description: "เปิดบันทึกของมิก" },
  { slug: "name", name: "เนม", description: "เปิดบันทึกของเนม" },
];
export function AccountPicker({
  onSelect,
  busy,
}: {
  onSelect: (slug: AccountSlug) => void;
  busy: AccountSlug | null;
}) {
  return (
    <div
      className="account-picker"
      aria-label="เลือกบัญชีของคุณ"
      aria-busy={Boolean(busy)}
    >
      {accounts.map((account) => (
        <button
          key={account.slug}
          className={`account-choice ${account.slug}`}
          aria-label={`เลือกบัญชี ${account.name}`}
          disabled={busy !== null}
          onClick={() => onSelect(account.slug)}
        >
          <span className="avatar">
            <UserRound size={23} />
          </span>
          <span className="account-choice-copy">
            <b>{account.name}</b>
            <small>{account.description}</small>
          </span>
          {busy === account.slug ? (
            <LoaderCircle className="account-spinner" size={20} />
          ) : (
            <ArrowRight size={20} />
          )}
        </button>
      ))}
    </div>
  );
}
