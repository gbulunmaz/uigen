import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);
});

describe("useAuth — initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("signIn — happy paths", () => {
  test("redirects to anon work project when user has pending work with messages", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/": { type: "directory" } },
    });
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
        data: { "/": { type: "directory" } },
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("redirects to the most recent project when no anon work exists", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetProjects.mockResolvedValue([
      { id: "project-1" },
      { id: "project-2" },
    ] as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/project-1");
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("creates a new project when user has no projects and no anon work", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "fresh-project-id" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/fresh-project-id");
  });

  test("returns the result from signInAction", async () => {
    const actionResult = { success: true, userId: "u1" };
    mockSignIn.mockResolvedValue(actionResult as any);
    mockGetProjects.mockResolvedValue([{ id: "p1" }] as any);

    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("user@example.com", "pass");
    });

    expect(returnValue).toEqual(actionResult);
  });
});

describe("signIn — failure / error states", () => {
  test("does not redirect when signIn fails", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "wrong-password");
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("returns the failure result", async () => {
    const failResult = { success: false, error: "Invalid credentials" };
    mockSignIn.mockResolvedValue(failResult as any);

    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("user@example.com", "wrong");
    });

    expect(returnValue).toEqual(failResult);
  });

  test("resets isLoading to false after signIn throws", async () => {
    mockSignIn.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("signIn — isLoading", () => {
  test("isLoading is false after a successful signIn completes", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetProjects.mockResolvedValue([{ id: "p1" }] as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("isLoading is false after a failed signIn completes", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "bad creds" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password");
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("signUp — happy paths", () => {
  test("redirects to anon work project when user has pending work with messages", async () => {
    mockSignUp.mockResolvedValue({ success: true } as any);
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "build a button" }],
      fileSystemData: { "/": { type: "directory" } },
    });
    mockCreateProject.mockResolvedValue({ id: "anon-signup-project" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "build a button" }],
        data: { "/": { type: "directory" } },
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-signup-project");
  });

  test("redirects to most recent project when no anon work exists", async () => {
    mockSignUp.mockResolvedValue({ success: true } as any);
    mockGetProjects.mockResolvedValue([{ id: "existing-project" }] as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/existing-project");
  });

  test("creates a new project when user has no projects", async () => {
    mockSignUp.mockResolvedValue({ success: true } as any);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new");
  });

  test("returns the result from signUpAction", async () => {
    const actionResult = { success: true };
    mockSignUp.mockResolvedValue(actionResult as any);
    mockGetProjects.mockResolvedValue([{ id: "p1" }] as any);

    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("new@example.com", "pass");
    });

    expect(returnValue).toEqual(actionResult);
  });
});

describe("signUp — failure / error states", () => {
  test("does not redirect when signUp fails", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email taken" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("taken@example.com", "password");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("returns the failure result", async () => {
    const failResult = { success: false, error: "Email taken" };
    mockSignUp.mockResolvedValue(failResult as any);

    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("taken@example.com", "password");
    });

    expect(returnValue).toEqual(failResult);
  });

  test("resets isLoading to false after signUp throws", async () => {
    mockSignUp.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("user@example.com", "password").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("anon work edge cases", () => {
  test("ignores anon work when messages array is empty", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "existing" }] as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password");
    });

    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing");
  });

  test("ignores anon work when getAnonWorkData returns null", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "existing" }] as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password");
    });

    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing");
  });

  test("includes a generated name when saving anon work as a project", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "named-project" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password");
    });

    const [callArg] = mockCreateProject.mock.calls[0];
    expect(callArg.name).toMatch(/^Design from /);
  });

  test("new project name includes a random number when no anon work and no projects", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "rand-project" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password");
    });

    const [callArg] = mockCreateProject.mock.calls[0];
    expect(callArg.name).toMatch(/^New Design #\d+$/);
  });
});
