import { expect, it } from "vitest";
import { authErrorMessage } from "../src/lib/auth-errors";

it("отличает ошибку сервера от неверного пароля и неподтверждённой почты", () => {
  expect(authErrorMessage({ status: 500 })).toContain("На сервере");
  expect(authErrorMessage({ status: 503 })).toContain("временно недоступны");
  expect(authErrorMessage({ status: 429 })).toContain("Слишком много попыток");
  expect(authErrorMessage({ status: 403, code: "EMAIL_NOT_VERIFIED" })).toContain("подтверди email");
  expect(authErrorMessage({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })).toContain("Проверь email и пароль");
  expect(authErrorMessage({ status: 400, code: "PRIVATE_DATABASE_ERROR" })).not.toContain("PRIVATE_DATABASE_ERROR");
});
