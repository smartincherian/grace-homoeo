import { vi, beforeEach, afterEach, test, expect } from "vitest";
import { resizeLogo } from "./resizeLogo";

const drawImage = vi.fn();
let dims = { w: 1024, h: 512 };
let dataUrl = "data:image/webp;base64,AAAA";
let canvasSize: { w: number; h: number } | undefined;

beforeEach(() => {
  drawImage.mockReset();
  dataUrl = "data:image/webp;base64,AAAA";
  dims = { w: 1024, h: 512 };
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = dims.w;
      naturalHeight = dims.h;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      canvasSize = { w: this.width, h: this.height };
      return { drawImage } as unknown as CanvasRenderingContext2D;
    } as never,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
    () => dataUrl,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const file = (type: string, size = 10) =>
  new File([new Uint8Array(size)], "l", { type });

test("rejects non-images", async () => {
  await expect(resizeLogo(file("text/plain"))).rejects.toThrow("not-image");
});

test("rejects files over 5 MB", async () => {
  await expect(resizeLogo(file("image/png", 6_000_000))).rejects.toThrow(
    "too-large",
  );
});

test("scales to fit 256 and returns the data URL", async () => {
  await expect(resizeLogo(file("image/png"))).resolves.toBe(dataUrl);
  expect(canvasSize).toEqual({ w: 256, h: 128 });
});

test("falls back to png when webp is unsupported", async () => {
  const spy = HTMLCanvasElement.prototype.toDataURL as unknown as ReturnType<
    typeof vi.fn
  >;
  spy.mockImplementation((type?: string) =>
    type === "image/webp"
      ? "data:image/png;base64,BBBB"
      : "data:image/png;base64,CCCC",
  );
  await expect(resizeLogo(file("image/jpeg"))).resolves.toBe(
    "data:image/png;base64,CCCC",
  );
});

test("rejects too-large output", async () => {
  dataUrl = "data:image/webp;base64," + "A".repeat(200001);
  await expect(resizeLogo(file("image/webp"))).rejects.toThrow("too-large");
});
