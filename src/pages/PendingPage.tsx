import { useTranslation } from "../i18n/useTranslation";
import { navigate, type PageRoute } from "../navigation/routes";

export default function PendingPage({ route }: { route: Exclude<PageRoute, "/"> }) {
  const t = useTranslation();
  return (
    <main className="pending-page">
      <h1 id="page-title" data-page-route={route} tabIndex={-1}>{route === "/features" ? t.features : route === "/about" ? t.about : t.notFound}</h1>
      <p>{t.pending}</p>
      <a href="/" onClick={(event) => navigate(event, "/")}>{t.backHome} <span aria-hidden="true">↗</span></a>
    </main>
  );
}
