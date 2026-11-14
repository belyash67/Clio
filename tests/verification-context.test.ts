import { afterEach, expect, it, vi } from "vitest";
import { forgetVerificationEmail, getVerificationEmail, rememberVerificationEmail, subscribeVerificationEmail } from "../src/lib/pending-verification";

afterEach(() => vi.unstubAllGlobals());

it("сохраняет email между страницами вкладки и уведомляет форму без передачи адреса в URL", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("window", new EventTarget());
  const update = vi.fn();
  const unsubscribe = subscribeVerificationEmail(update);
  rememberVerificationEmail("viewer@example.invalid");
  expect(getVerificationEmail()).toBe("viewer@example.invalid");
  expect(update).toHaveBeenCalledTimes(1);
  forgetVerificationEmail();
  expect(getVerificationEmail()).toBe("");
  expect(update).toHaveBeenCalledTimes(2);
  unsubscribe();
  rememberVerificationEmail("another@example.invalid");
  expect(update).toHaveBeenCalledTimes(2);
});

it("сохраняет возможность работы формы, если браузер запрещает хранилище", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => { throw new Error("storage unavailable"); },
    setItem: () => { throw new Error("storage unavailable"); },
    removeItem: () => { throw new Error("storage unavailable"); },
  });
  expect(() => rememberVerificationEmail("viewer@example.invalid")).not.toThrow();
  expect(getVerificationEmail()).toBe("");
  expect(() => forgetVerificationEmail()).not.toThrow();
});
