import { expect, it } from "vitest";
import { PRIVACY_VERSION, privacyEvidence, validPrivacyConsent } from "../src/lib/privacy";

it("не принимает неявное, неполное или устаревшее подтверждение", () => {
  const accepted = { processingConsent: true, transferConsent: true, privacyVersion: PRIVACY_VERSION };
  expect(validPrivacyConsent(accepted)).toBe(true);
  for (const invalid of [null, {}, { ...accepted, processingConsent: "true" }, { ...accepted, transferConsent: false }, { ...accepted, privacyVersion: "old" }]) expect(validPrivacyConsent(invalid)).toBe(false);
  const evidence = privacyEvidence();
  expect(evidence.consentVersion).toBe(PRIVACY_VERSION);
  expect(evidence.consentAcceptedAt).toBeInstanceOf(Date);
  expect(JSON.parse(evidence.consentSnapshot).sections.length).toBeGreaterThan(0);
});
