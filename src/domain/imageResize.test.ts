import { expect, test } from "vitest";
import { fitWithin } from "./imageResize";

test("keeps small images", () => expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 }));
test("scales landscape by width", () => expect(fitWithin(4032, 3024, 1600)).toEqual({ w: 1600, h: 1200 }));
test("scales portrait by height", () => expect(fitWithin(3024, 4032, 1600)).toEqual({ w: 1200, h: 1600 }));
test("exact maxEdge keeps size", () => expect(fitWithin(1600, 900, 1600)).toEqual({ w: 1600, h: 900 }));
test("extreme aspect ratio never yields a zero edge", () => expect(fitWithin(10000, 1, 1600)).toEqual({ w: 1600, h: 1 }));
test("non-positive or non-finite inputs are guarded", () => {
  expect(fitWithin(0, 0, 1600)).toEqual({ w: 1, h: 1 });
  expect(fitWithin(-5, 100, 1600)).toEqual({ w: 1, h: 1 });
  expect(fitWithin(800, 600, 0)).toEqual({ w: 1, h: 1 });
  expect(fitWithin(NaN, 600, 1600)).toEqual({ w: 1, h: 1 });
});
