import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockServiceExecute } = vi.hoisted(() => {
  const mockServiceExecute = vi.fn();
  return { mockServiceExecute };
});

vi.mock("@calcom/features/bookings/lib/service/StartInstantMeetingService", () => ({
  StartInstantMeetingService: vi.fn(function () {
    return { execute: mockServiceExecute };
  }),
}));

import { startInstantMeetingHandler } from "./startInstantMeeting.handler";

function createMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    email: "host@example.com",
    name: "Host User",
    username: "hostuser",
    timeZone: "UTC",
    locale: "en",
    ...overrides,
  } as unknown as NonNullable<TrpcSessionUser>;
}

describe("startInstantMeeting.handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns booking data on success", async () => {
    mockServiceExecute.mockResolvedValue({
      bookingUid: "uid-123",
      bookingId: 42,
      meetingUrl: "https://cal.app.com/video/uid-123",
      meetingPassword: "secret",
    });

    const result = await startInstantMeetingHandler({
      ctx: { user: createMockUser() },
      input: { timeZone: "America/New_York" },
    });

    expect(result.bookingUid).toBe("uid-123");
    expect(result.bookingId).toBe(42);
    expect(result.meetingUrl).toBe("https://cal.app.com/video/uid-123");
    expect(result.meetingPassword).toBe("secret");

    expect(mockServiceExecute).toHaveBeenCalledWith({
      userId: 1,
      timeZone: "America/New_York",
    });
  });

  it("throws CONFLICT TRPCError when host is busy", async () => {
    mockServiceExecute.mockRejectedValue(new ErrorWithCode(ErrorCode.InstantMeetingHostBusy, "Host is busy"));

    await expect(
      startInstantMeetingHandler({
        ctx: { user: createMockUser() },
        input: { timeZone: "UTC" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws PRECONDITION_FAILED TRPCError when no calendar", async () => {
    mockServiceExecute.mockRejectedValue(
      new ErrorWithCode(ErrorCode.InstantMeetingNoCalendar, "No calendar")
    );

    await expect(
      startInstantMeetingHandler({
        ctx: { user: createMockUser() },
        input: { timeZone: "UTC" },
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("throws PRECONDITION_FAILED TRPCError when video unavailable", async () => {
    mockServiceExecute.mockRejectedValue(
      new ErrorWithCode(ErrorCode.InstantMeetingVideoUnavailable, "Video unavailable")
    );

    await expect(
      startInstantMeetingHandler({
        ctx: { user: createMockUser() },
        input: { timeZone: "UTC" },
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rethrows unexpected errors", async () => {
    mockServiceExecute.mockRejectedValue(new Error("Something unexpected"));

    await expect(
      startInstantMeetingHandler({
        ctx: { user: createMockUser() },
        input: { timeZone: "UTC" },
      })
    ).rejects.toThrow("Something unexpected");
  });
});
