import { z } from "zod";

export type TStartInstantMeetingInputSchema = {
  timeZone: string;
};

export const ZStartInstantMeetingInputSchema: z.ZodType<TStartInstantMeetingInputSchema> = z.object({
  timeZone: z.string(),
});
