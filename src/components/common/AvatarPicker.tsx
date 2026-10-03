import { Camera, Trash2 } from "lucide-react";
import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fileToSquareDataUrl, validateImageFile } from "@/lib/images";

import { UserAvatar } from "./UserAvatar";

interface AvatarPickerProps {
  userId: string;
  displayName: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

/** Local avatar selection with preview (uploaded to the backend in Phase 8). */
export function AvatarPicker({ userId, displayName, value, onChange }: AvatarPickerProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      toast.error(t(`avatarPicker.${problem}`));
      return;
    }
    onChange(await fileToSquareDataUrl(file));
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar
        user={{ id: userId, displayName: displayName || "?", avatarUrl: value }}
        size="lg"
      />
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Camera className="size-4" aria-hidden />
          {value ? t("onboarding.profile.changeAvatar") : t("onboarding.profile.avatar")}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="size-4" aria-hidden />
            {t("onboarding.profile.removeAvatar")}
          </Button>
        )}
      </div>
    </div>
  );
}
