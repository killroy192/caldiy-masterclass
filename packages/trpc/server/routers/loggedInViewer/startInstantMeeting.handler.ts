import { StartInstantMeetingService } from "@calcom/features/bookings/lib/service/StartInstantMeetingService";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";
import { TRPCError } from "@trpc/server";
import type { TStartInstantMeetingInputSchema } from "./startInstantMeeting.schema";

type Options = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TStartInstantMeetingInputSchema;
};

const errorCodeToTrpcCode: Record<string, "CONFLICT" | "PRECONDITION_FAILED"> = {
  [ErrorCode.InstantMeetingHostBusy]: "CONFLICT",
  [ErrorCode.InstantMeetingNoCalendar]: "PRECONDITION_FAILED",
  [ErrorCode.InstantMeetingVideoUnavailable]: "PRECONDITION_FAILED",
};

export const startInstantMeetingHandler = async ({ ctx, input }: Options) => {
  const { user } = ctx;

  const service = new StartInstantMeetingService();

  try {
    return await service.execute({
      userId: user.id,
      timeZone: input.timeZone,
    });
  } catch (err) {
    if (err instanceof ErrorWithCode) {
      const trpcCode = errorCodeToTrpcCode[err.code];
      if (trpcCode) {
        throw new TRPCError({ code: trpcCode, message: err.message });
      }
    }
    throw err;
  }
};
