import { getTranslation } from "@calcom/i18n/server";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import logger from "@calcom/lib/logger";
import prisma from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";
import type { CalendarEvent } from "@calcom/types/Calendar";
import { z } from "zod";
import EventManager from "../EventManager";
import { getAllCredentialsIncludeServiceAccountKey } from "../getAllCredentialsForUsersOnEvent/getAllCredentials";
import { refreshCredentials } from "../getAllCredentialsForUsersOnEvent/refreshCredentials";
import { ensureAvailableUsers } from "../handleNewBooking/ensureAvailableUsers";
import type { IsFixedAwareUser } from "../handleNewBooking/types";

const log = logger.getSubLogger({ prefix: ["StartInstantMeetingService"] });

const dailyAppKeysSchema = z.object({
  api_key: z.string(),
  scale_plan: z.string().default("false"),
});

const INSTANT_MEETING_DURATION = 30;

type ExecuteInput = {
  userId: number;
  timeZone: string;
};

type ExecuteResult = {
  bookingUid: string;
  bookingId: number;
  meetingUrl: string;
  meetingPassword?: string;
};

export class StartInstantMeetingService {
  async execute(input: ExecuteInput): Promise<ExecuteResult> {
    const { userId, timeZone } = input;

    // 1. Load user with destination calendar
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        locale: true,
        timeZone: true,
        destinationCalendar: true,
        credentials: {
          select: {
            id: true,
            type: true,
            key: true,
            userId: true,
            teamId: true,
            appId: true,
            invalid: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    if (!user) {
      throw new ErrorWithCode(ErrorCode.NotFound, "User not found");
    }

    if (!user.destinationCalendar) {
      throw new ErrorWithCode(ErrorCode.InstantMeetingNoCalendar, "No destination calendar connected");
    }

    // 2. Check Cal Video availability
    const dailyApp = await prisma.app.findUnique({
      where: { slug: "daily-video" },
      select: { enabled: true, keys: true },
    });

    const keysResult = dailyAppKeysSchema.safeParse(dailyApp?.keys);
    if (!dailyApp?.enabled || !keysResult.success) {
      throw new ErrorWithCode(ErrorCode.InstantMeetingVideoUnavailable, "Cal Video is not available");
    }

    // 3. Compute time window
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + INSTANT_MEETING_DURATION * 60 * 1000);

    // 4. Find or create hidden event type
    let eventType = await prisma.eventType.findFirst({
      where: { userId, slug: "instant-meeting", hidden: true },
      select: {
        id: true,
        title: true,
        slug: true,
        length: true,
        hidden: true,
        locations: true,
        userId: true,
        beforeEventBuffer: true,
        afterEventBuffer: true,
        bookingLimits: true,
        durationLimits: true,
        recurringEvent: true,
        restrictionScheduleId: true,
        useBookerTimezone: true,
        metadata: true,
      },
    });

    if (!eventType) {
      eventType = await prisma.eventType.create({
        data: {
          title: "Instant meeting",
          slug: "instant-meeting",
          length: INSTANT_MEETING_DURATION,
          hidden: true,
          locations: [{ type: "integrations:daily" }],
          owner: { connect: { id: userId } },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          length: true,
          hidden: true,
          locations: true,
          userId: true,
          beforeEventBuffer: true,
          afterEventBuffer: true,
          bookingLimits: true,
          durationLimits: true,
          recurringEvent: true,
          restrictionScheduleId: true,
          useBookerTimezone: true,
          metadata: true,
        },
      });
    }

    // 5. Conflict check
    const hostUser: IsFixedAwareUser = {
      ...user,
      isFixed: true,
      credentials: user.credentials as any,
    } as unknown as IsFixedAwareUser;

    try {
      await ensureAvailableUsers(
        {
          ...eventType,
          users: [hostUser],
        } as any,
        {
          dateFrom: startTime.toISOString(),
          dateTo: endTime.toISOString(),
          timeZone,
        },
        log as any
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.message === ErrorCode.NoAvailableUsersFound) {
        throw new ErrorWithCode(ErrorCode.InstantMeetingHostBusy, "Host is busy for the next 30 minutes");
      }
      throw err;
    }

    // 6. Build CalendarEvent
    const t = await getTranslation(user.locale ?? "en", "common");
    const uid = `instant-${Date.now()}-${userId}`;
    const iCalUID = `${uid}@Cal.diy`;

    const calEvent: CalendarEvent = {
      type: eventType.title,
      title: t("instant_meeting_with_title", { name: user.name || user.email }),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      organizer: {
        email: user.email,
        name: user.name || "",
        timeZone: user.timeZone || timeZone,
        language: { translate: t, locale: user.locale || "en" },
        id: user.id,
      },
      attendees: [],
      location: "integrations:daily",
      destinationCalendar: [user.destinationCalendar],
      uid,
    };

    // 7. Create booking row
    const booking = await prisma.booking.create({
      data: {
        uid,
        title: calEvent.title,
        startTime,
        endTime,
        status: BookingStatus.ACCEPTED,
        location: "integrations:daily",
        eventType: { connect: { id: eventType.id } },
        user: { connect: { id: userId } },
        destinationCalendar: { connect: { id: user.destinationCalendar.id } },
        iCalUID,
        creationSource: "WEBAPP",
      },
      select: { id: true, uid: true },
    });

    // 8-10. Load credentials, create via EventManager, persist references
    try {
      const allCredentials = await getAllCredentialsIncludeServiceAccountKey(
        { id: user.id, username: user.username, email: user.email, credentials: user.credentials as any },
        { userId: eventType.userId, metadata: eventType.metadata as any }
      );

      const refreshedCredentials = await refreshCredentials(allCredentials);

      const eventManager = new EventManager({
        credentials: refreshedCredentials,
        destinationCalendar: user.destinationCalendar,
      });

      const { results, referencesToCreate } = await eventManager.create(calEvent);

      const videoResult = results.find((r) => r.type.includes("video") || r.type.includes("daily"));
      const meetingUrl =
        (calEvent as any).videoCallData?.url ||
        videoResult?.createdEvent?.url ||
        referencesToCreate.find((r) => r.meetingUrl)?.meetingUrl ||
        "";
      const meetingPassword =
        videoResult?.createdEvent?.password ||
        referencesToCreate.find((r) => r.meetingPassword)?.meetingPassword ||
        undefined;

      // 10. Persist references + metadata
      await prisma.booking.update({
        where: { uid: booking.uid },
        data: {
          location: calEvent.location || "integrations:daily",
          metadata: { videoCallUrl: meetingUrl },
          references: {
            createMany: { data: referencesToCreate },
          },
        },
      });

      return {
        bookingUid: booking.uid,
        bookingId: booking.id,
        meetingUrl,
        meetingPassword: meetingPassword ?? undefined,
      };
    } catch (err) {
      // 11. Rollback on failure
      log.error("Failed to create video/calendar event, rolling back booking", { bookingId: booking.id });
      await prisma.booking.delete({ where: { id: booking.id } });
      throw err;
    }
  }
}
