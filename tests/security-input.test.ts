import { describe, expect, it } from "vitest";
import { profileSchema, registrationSchema } from "../src/lib/validation";

describe("границы входных данных", () => {
  it("отклоняет попытку назначить роль или изменить чужой профиль", () => {
    const profile = { name: "Alex", bio: "", profileVisibility: "friends", libraryVisibility: "private", activityVisibility: "private" };
    expect(profileSchema.safeParse(profile).success).toBe(true);
    expect(profileSchema.safeParse({ ...profile, role: "admin" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...profile, userId: "another-user" }).success).toBe(false);
  });
  it("не принимает неизвестную приватность и слишком длинное био", () => {
    expect(profileSchema.safeParse({ name: "Alex", bio: "a".repeat(501), profileVisibility: "public", libraryVisibility: "private", activityVisibility: "private" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Alex", bio: "", profileVisibility: "everyone", libraryVisibility: "private", activityVisibility: "private" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Alex", bio: "", profileVisibility: "private", libraryVisibility: "private", activityVisibility: "private" }).success).toBe(false);
  });
  it("нормализует username и email и проверяет повтор пароля", () => {
    const data = { name: "Alex", username: "Alex_67", email: "Alex@Example.com", password: "long-local-password", confirmPassword: "long-local-password" };
    const parsed = registrationSchema.parse(data);
    expect(parsed.username).toBe("alex_67");
    expect(parsed.email).toBe("alex@example.com");
    expect(registrationSchema.safeParse({ ...data, confirmPassword: "different-password" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...data, username: "admin<script>" }).success).toBe(false);
  });
});
