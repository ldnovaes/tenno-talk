import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";

import { useOverlayNavigate } from "@/app/router/overlay";
import { paths } from "@/app/router/paths";
import { PageHeader } from "@/components/common/PageHeader";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { EditProfileForm } from "@/features/profile/components/EditProfileForm";
import { usePanel } from "@/layouts/panelContext";

export default function EditProfilePage() {
  const { t } = useTranslation();
  const { username } = useParams();
  const me = useCurrentUser();
  const panel = usePanel();
  const navigate = useNavigate();
  const overlayNavigate = useOverlayNavigate();

  // Only your own profile can be edited (the server enforces it too).
  if (username !== me.username) return <Navigate to={paths.profile(me.username)} replace />;

  const back = () =>
    panel ? overlayNavigate(paths.profile(me.username), { replace: true }) : navigate(-1);
  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={t("profile.edit.title")} onBack={back} />
      <EditProfileForm
        me={me}
        onDone={(newUsername) =>
          panel
            ? overlayNavigate(paths.profile(newUsername), { replace: true })
            : navigate(paths.profile(newUsername), { replace: true })
        }
      />
    </div>
  );
}
