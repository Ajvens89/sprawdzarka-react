import { Navigate, useLocation } from "react-router-dom";
import { LEGACY_ROUTE_REDIRECTS } from "../../navigation/modules";
import { NotFoundPage } from "./NotFoundPage";

export function LegacyMagazynRedirect(): JSX.Element {
  const { pathname } = useLocation();
  const target = LEGACY_ROUTE_REDIRECTS[pathname];

  if (!target) {
    return <NotFoundPage />;
  }

  return <Navigate to={target} replace />;
}
