import { test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const { createSession } = await import("@/lib/auth");

beforeEach(() => {
  vi.clearAllMocks();
});

test("createSession sets an httpOnly cookie with a JWT", async () => {
  await createSession("user-1", "test@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, token, options] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(typeof token).toBe("string");
  expect(token.split(".").length).toBe(3); // valid JWT format
  expect(options.httpOnly).toBe(true);
  expect(options.path).toBe("/");
  expect(options.expires).toBeInstanceOf(Date);
});

test("createSession sets expiry ~7 days in the future", async () => {
  const before = Date.now();
  await createSession("user-1", "test@example.com");
  const after = Date.now();

  const [, , options] = mockCookieStore.set.mock.calls[0];
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  expect(options.expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(options.expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("createSession encodes userId and email in the JWT payload", async () => {
  await createSession("user-42", "alice@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const payload = JSON.parse(atob(token.split(".")[1]));
  expect(payload.userId).toBe("user-42");
  expect(payload.email).toBe("alice@example.com");
});
