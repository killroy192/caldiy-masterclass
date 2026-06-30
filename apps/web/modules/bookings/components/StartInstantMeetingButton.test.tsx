import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockMutateAsync, mockInvalidate, mockCopyToClipboard } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockInvalidate: vi.fn(),
  mockCopyToClipboard: vi.fn(),
}));

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@calcom/lib/hooks/useCopy", () => ({
  useCopy: () => ({
    isCopied: false,
    copyToClipboard: mockCopyToClipboard,
    resetCopyStatus: vi.fn(),
    fetchAndCopyToClipboard: vi.fn(),
  }),
}));

vi.mock("@calcom/ui/components/toast", () => ({
  showToast: vi.fn(),
}));

vi.mock("@calcom/ui/components/button", () => ({
  Button: ({ children, onClick, disabled, loading, ...props }: any) => (
    <button onClick={onClick} disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@calcom/trpc/react", () => ({
  trpc: {
    viewer: {
      loggedInViewerRouter: {
        startInstantMeeting: {
          useMutation: () => ({
            mutateAsync: mockMutateAsync,
            isPending: false,
            data: undefined,
            reset: vi.fn(),
          }),
        },
      },
    },
    useUtils: () => ({
      viewer: {
        bookings: {
          get: { invalidate: mockInvalidate },
        },
      },
    }),
  },
}));

import { StartInstantMeetingButton } from "./StartInstantMeetingButton";

describe("StartInstantMeetingButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders idle state with start_meeting label", () => {
    render(<StartInstantMeetingButton />);
    expect(screen.getByRole("button", { name: /start_meeting/i })).toBeInTheDocument();
  });

  it("calls mutation with browser timezone on click", async () => {
    mockMutateAsync.mockResolvedValue({
      bookingUid: "uid-1",
      bookingId: 1,
      meetingUrl: "https://cal.app.com/video/uid-1",
    });

    render(<StartInstantMeetingButton />);
    fireEvent.click(screen.getByRole("button", { name: /start_meeting/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        timeZone: expect.any(String),
      });
    });
  });

  it("shows success panel with join and copy controls after mutation succeeds", async () => {
    mockMutateAsync.mockResolvedValue({
      bookingUid: "uid-1",
      bookingId: 1,
      meetingUrl: "https://cal.app.com/video/uid-1",
    });

    render(<StartInstantMeetingButton />);
    fireEvent.click(screen.getByRole("button", { name: /start_meeting/i }));

    await waitFor(() => {
      expect(screen.getByText("instant_meeting_started")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /join_meeting/i })).toHaveAttribute(
      "href",
      "https://cal.app.com/video/uid-1"
    );
    expect(screen.getByRole("button", { name: /copy_meeting_link/i })).toBeInTheDocument();
  });

  it("shows error toast when mutation fails", async () => {
    const { showToast } = await import("@calcom/ui/components/toast");
    mockMutateAsync.mockRejectedValue({ message: "instant_meeting_host_busy" });

    render(<StartInstantMeetingButton />);
    fireEvent.click(screen.getByRole("button", { name: /start_meeting/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("instant_meeting_host_busy", "error");
    });
  });
});
