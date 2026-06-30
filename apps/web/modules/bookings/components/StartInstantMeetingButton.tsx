"use client";

import { useCopy } from "@calcom/lib/hooks/useCopy";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { showToast } from "@calcom/ui/components/toast";
import { useState } from "react";

type MeetingResult = {
  bookingUid: string;
  bookingId: number;
  meetingUrl: string;
  meetingPassword?: string;
};

export function StartInstantMeetingButton() {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const { copyToClipboard } = useCopy();
  const [result, setResult] = useState<MeetingResult | null>(null);

  const mutation = trpc.viewer.loggedInViewerRouter.startInstantMeeting.useMutation();

  const handleClick = async () => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await mutation.mutateAsync({ timeZone });
      setResult(data);
      void utils.viewer.bookings.get.invalidate();
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? t("something_went_wrong");
      showToast(message, "error");
    }
  };

  const handleCopy = () => {
    if (!result?.meetingUrl) return;
    copyToClipboard(result.meetingUrl, {
      onSuccess: () => showToast(t("link_copied"), "success"),
    });
  };

  if (result) {
    return (
      <div className="flex items-center gap-2" data-testid="instant-meeting-success">
        <span className="font-medium text-emphasis text-sm">{t("instant_meeting_started")}</span>
        <a
          href={result.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          role="link"
          aria-label={t("join_meeting")}
          className="inline-flex items-center rounded-md bg-success px-3 py-1.5 font-medium text-inverted text-sm hover:bg-success/90">
          {t("join_meeting")}
        </a>
        <Button color="secondary" size="sm" onClick={handleCopy} aria-label={t("copy_meeting_link")}>
          {t("copy_meeting_link")}
        </Button>
      </div>
    );
  }

  return (
    <Button
      color="primary"
      size="sm"
      StartIcon="video"
      loading={mutation.isPending}
      disabled={mutation.isPending}
      onClick={handleClick}>
      {t("start_meeting")}
    </Button>
  );
}
