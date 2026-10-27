import { describe, it, expect } from "vitest";
import {
  validatePhotoFile,
  MAX_PHOTO_SOURCE_BYTES,
} from "../src/features/meals/photoValidation";
describe("meal photo input boundaries", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"])
    it(`accepts ${type}`, () =>
      expect(() => validatePhotoFile({ type, size: 1234 })).not.toThrow());
  it("rejects scriptable SVG and disguised unsupported files", () => {
    expect(() =>
      validatePhotoFile({ type: "image/svg+xml", size: 100 }),
    ).toThrow("JPG");
    expect(() => validatePhotoFile({ type: "text/html", size: 100 })).toThrow(
      "JPG",
    );
  });
  it("accepts the stated 10 MB boundary and rejects larger files", () => {
    expect(() =>
      validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_SOURCE_BYTES }),
    ).not.toThrow();
    expect(() =>
      validatePhotoFile({
        type: "image/jpeg",
        size: MAX_PHOTO_SOURCE_BYTES + 1,
      }),
    ).toThrow("10 MB");
  });
  it("rejects empty files", () =>
    expect(() => validatePhotoFile({ type: "image/png", size: 0 })).toThrow(
      "ว่างเปล่า",
    ));
});
