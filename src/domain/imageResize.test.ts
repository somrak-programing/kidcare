import { expect, test } from "vitest";
import { fitWithin } from "./imageResize";

test("keeps small images", () => expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 }));
test("scales landscape by width", () => expect(fitWithin(4032, 3024, 1600)).toEqual({ w: 1600, h: 1200 }));
test("scales portrait by height", () => expect(fitWithin(3024, 4032, 1600)).toEqual({ w: 1200, h: 1600 }));
