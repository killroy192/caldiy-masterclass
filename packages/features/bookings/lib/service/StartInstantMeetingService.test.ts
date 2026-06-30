import { prisma } from "@calcom/prisma/__mocks__/prisma";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import { BookingStatus } from "@calcom/prisma/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@calcom/prisma", () => ({
  default: prisma,
  prisma,
}));

const { mockEnsureAvailableUsers } = vi.hoisted(() => {
  const mockEnsureAvailableUsers = vi.fn();
  return { mockEnsureAvailableUsers };
});

vi.mock("../handleNewBooking/ensureAvailableUsers", () => ({
  ensureAvailableUsers: (...args: unknown[]) => mockEnsureAvailableUsers(...args),
}));

const { mockEventManagerCreate } = vi.hoisted(() => {
  const mockEventManagerCreate = vi.fn();
  return { mockEventManagerCreate };
});

vi.mock("../EventManager", () => ({
  default: vi.fn(function () {
    return { create: mockEventManagerCreate };
  }),
}));

vi.mock("../getAllCredentialsForUsersOnEvent/getAllCredentials", () => ({
  getAllCredentialsIncludeServiceAccountKey: vi.fn().mockResolvedValue([]),
}));

vi.mock("../getAllCredentialsForUsersOnEvent/refreshCredentials", () => ({
  refreshCredentials: vi.fn().mockImplementation((creds) => Promise.resolve(creds)),
}));

vi.mock("@calcom/i18n/server", () => ({
  getTranslation: vi.fn().mockResolvedValue((key: string, opts?: Record<string, string>) => {
    if (opts?.name) return `${key} — ${opts.name}`;
    return key;
  }),
}));

import { StartInstantMeetingService } from "./StartInstantMeetingService";

const MOCK_USER_ID = 42;
const MOCK_TIMEZONE = "America/New_York";

function mockUserWithCalendar() {
  prisma.user.findUnique.mockResolvedValue({
    id: MOCK_USER_ID,
    email: "host@example.com",
    name: "Test Host",
    username: "testhost",
    locale: "en",
    timeZone: "America/New_York",
    destinationCalendar: { id: 1, integration: "google_calendar", externalId: "cal@gmail.com" },
    credentials: [],
  } as any);
}

function mockUserWithoutCalendar() {
  prisma.user.findUnique.mockResolvedValue({
    id: MOCK_USER_ID,
    email: "host@example.com",
    name: "Test Host",
    username: "testhost",
    locale: "en",
    timeZone: "America/New_York",
    destinationCalendar: null,
    credentials: [],
  } as any);
}

function mockDailyVideoEnabled() {
  prisma.app.findUnique.mockResolvedValue({
    enabled: true,
    keys: { api_key: "test-daily-key", scale_plan: "false" },
  } as any);
}

function mockDailyVideoDisabled() {
  prisma.app.findUnique.mockResolvedValue({
    enabled: false,
    keys: {},
  } as any);
}

function mockDailyVideoMissingKeys() {
  prisma.app.findUnique.mockResolvedValue({
    enabled: true,
    keys: {},
  } as any);
}

function mockExistingEventType() {
  prisma.eventType.findFirst.mockResolvedValue({
    id: 10,
    title: "Instant meeting",
    slug: "instant-meeting",
    length: 30,
    hidden: true,
    locations: [{ type: "integrations:daily" }],
    userId: MOCK_USER_ID,
    beforeEventBuffer: 0,
    afterEventBuffer: 0,
    bookingLimits: null,
    durationLimits: null,
    recurringEvent: null,
    restrictionScheduleId: null,
    useBookerTimezone: false,
    metadata: null,
  } as any);
}

function mockBookingCreate() {
  prisma.booking.create.mockResolvedValue({
    id: 100,
    uid: "mock-booking-uid",
    title: "instant_meeting_with_title — Test Host",
    startTime: new Date(),
    endTime: new Date(Date.now() + 30 * 60 * 1000),
    status: BookingStatus.ACCEPTED,
    location: "integrations:daily",
  } as any);
}

function mockEventManagerSuccess() {
  mockEventManagerCreate.mockResolvedValue({
    results: [
      {
        type: "daily_video",
        success: true,
        uid: "daily-uid",
        createdEvent: { url: "https://cal.app.com/video/mock-uid" },
      },
    ],
    referencesToCreate: [
      {
        type: "daily_video",
        uid: "daily-uid",
        meetingId: "daily-meeting-id",
        meetingPassword: "daily-pass",
        meetingUrl: "https://cal.app.com/video/mock-uid",
      },
    ],
  });
}

function mockBookingUpdate() {
  prisma.booking.update.mockResolvedValue({
    id: 100,
    uid: "mock-booking-uid",
    metadata: { videoCallUrl: "https://cal.app.com/video/mock-uid" },
  } as any);
}

describe("StartInstantMeetingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("pre-flight: no destination calendar", () => {
    it("throws InstantMeetingNoCalendar when user has no destination calendar", async () => {
      mockUserWithoutCalendar();

      const service = new StartInstantMeetingService();

      await expect(service.execute({ userId: MOCK_USER_ID, timeZone: MOCK_TIMEZONE })).rejects.toThrow(
        ErrorWithCode
      );

      await expect(service.execute({ userId: MOCK_USER_ID, timeZone: MOCK_TIMEZONE })).rejects.toMatchObject({
        code: ErrorCode.InstantMeetingNoCalendar,
      });

      expect(prisma.booking.create).not.toHaveBeenCalled();
    });
  });

  describe("pre-flight: Cal Video unavailable", () => {
    it("throws InstantMeetingVideoUnavailable when daily-video app is disabled", async () => {
      mockUserWithCalendar();
      mockDailyVideoDisabled();

      const service = new StartInstantMeetingService();

      await expect(service.execute({ userId: MOCK_USER_ID, timeZone: MOCK_TIMEZONE })).rejects.toMatchObject({
        code: ErrorCode.InstantMeetingVideoUnavailable,
      });

      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it("throws InstantMeetingVideoUnavailable when daily-video keys are invalid", async () => {
      mockUserWithCalendar();
      mockDailyVideoMissingKeys();

      const service = new StartInstantMeetingService();

      await expect(service.execute({ userId: MOCK_USER_ID, timeZone: MOCK_TIMEZONE })).rejects.toMatchObject({
        code: ErrorCode.InstantMeetingVideoUnavailable,
      });

      expect(prisma.booking.create).not.toHaveBeenCalled();
    });
  });

  describe("pre-flight: host busy", () => {
    it("throws InstantMeetingHostBusy when ensureAvailableUsers finds conflict", async () => {
      mockUserWithCalendar();
      mockDailyVideoEnabled();
      mockExistingEventType();
      mockEnsureAvailableUsers.mockRejectedValue(new Error(ErrorCode.NoAvailableUsersFound));

      const service = new StartInstantMeetingService();

      await expect(service.execute({ userId: MOCK_USER_ID, timeZone: MOCK_TIMEZONE })).rejects.toMatchObject({
        code: ErrorCode.InstantMeetingHostBusy,
      });

      expect(prisma.booking.create).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    it("creates an ACCEPTED booking with 30-min window and Cal Video references", async () => {
      mockUserWithCalendar();
      mockDailyVideoEnabled();
      mockExistingEventType();
      mockEnsureAvailableUsers.mockResolvedValue([{ id: MOCK_USER_ID, isFixed: true }]);
      mockBookingCreate();
      mockEventManagerSuccess();
      mockBookingUpdate();

      const service = new StartInstantMeetingService();
      const result = await service.execute({ userId: MOCK_USER_ID, timeZone: MOCK_TIMEZONE });

      expect(result.bookingUid).toBe("mock-booking-uid");
      expect(result.bookingId).toBe(100);
      expect(result.meetingUrl).toBe("https://cal.app.com/video/mock-uid");

      expect(prisma.booking.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.booking.create.mock.calls[0][0];
      expect(createCall.data.status).toBe(BookingStatus.ACCEPTED);
      expect(createCall.data.location).toBe("integrations:daily");

      expect(prisma.booking.update).toHaveBeenCalledTimes(1);
      const updateCall = prisma.booking.update.mock.calls[0][0];
      expect(updateCall.data.references?.createMany).toBeDefined();
    });
  });

  describe("rollback on EventManager failure", () => {
    it("deletes booking when EventManager.create throws", async () => {
      mockUserWithCalendar();
      mockDailyVideoEnabled();
      mockExistingEventType();
      mockEnsureAvailableUsers.mockResolvedValue([{ id: MOCK_USER_ID, isFixed: true }]);
      mockBookingCreate();
      mockEventManagerCreate.mockRejectedValue(new Error("Daily room creation failed"));

      const service = new StartInstantMeetingService();

      await expect(service.execute({ userId: MOCK_USER_ID, timeZone: MOCK_TIMEZONE })).rejects.toThrow(
        "Daily room creation failed"
      );

      expect(prisma.booking.delete).toHaveBeenCalledWith({ where: { id: 100 } });
    });
  });

  describe("no InstantMeetingToken side effects", () => {
    it("does not create any InstantMeetingToken", async () => {
      mockUserWithCalendar();
      mockDailyVideoEnabled();
      mockExistingEventType();
      mockEnsureAvailableUsers.mockResolvedValue([{ id: MOCK_USER_ID, isFixed: true }]);
      mockBookingCreate();
      mockEventManagerSuccess();
      mockBookingUpdate();

      const service = new StartInstantMeetingService();
      await service.execute({ userId: MOCK_USER_ID, timeZone: MOCK_TIMEZONE });

      expect(prisma.instantMeetingToken.create).not.toHaveBeenCalled();
    });
  });
});
