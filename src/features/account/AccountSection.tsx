import { useId } from "react";
import { useMemory } from "../../creature/memory/memoryStore";
import { useTranslation } from "../../i18n/useTranslation";
import { signIn, signOut, useAccount } from "./accountStore";

/** Ajustes › Cuenta: Google sign-in so what Jev remembers follows the visitor. Absent when the build has no Supabase. */
export function AccountSection() {
  const t = useTranslation();
  const { status, email, failed } = useAccount();
  const memory = useMemory();
  const titleId = useId();
  if (status === "unavailable") return null;

  return (
    <section className="settings__group" aria-labelledby={titleId}>
      <h3 id={titleId}>{t.account}</h3>
      <p className="settings__help">{t.accountHelp}</p>
      {status === "signedIn" && <p className="settings__status" role="status">{t.accountSignedIn} {email}</p>}
      {status === "signedIn" && memory.status === "offline" && <p className="settings__error">{t.memoryOffline}</p>}
      {failed && <p className="settings__error" role="alert">{t.accountFailed}</p>}
      <div className="settings__actions">
        {status === "signedIn"
          ? <button type="button" onClick={() => void signOut()}>{t.accountSignOut}</button>
          : (
            <button type="button" className="settings__primary" disabled={status === "connecting"} onClick={() => void signIn()}>
              {status === "connecting" ? t.accountConnecting : t.accountSignIn}
            </button>
          )}
      </div>
    </section>
  );
}
