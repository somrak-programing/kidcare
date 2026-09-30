import { expect, test } from "vitest";
import { groupUpcoming, type UpcomingItem } from "./upcoming";

const item = (id: string, date: string): UpcomingItem => ({ kind: "dose", id, childId: "c", date, title: id });

test("groups by overdue / next 7 days / later and sorts ascending", () => {
  const g = groupUpcoming(
    [item("later", "2026-11-01"), item("soon2", "2026-10-07"), item("od", "2026-09-01"), item("soon1", "2026-09-30"), item("l0", "2026-10-08")],
    "2026-09-30",
  );
  expect(g.overdue.map((i) => i.id)).toEqual(["od"]);
  expect(g.soon.map((i) => i.id)).toEqual(["soon1", "soon2"]);
  expect(g.later.map((i) => i.id)).toEqual(["l0", "later"]);
});

test("same day sorted by time, untimed first", () => {
  const a = { ...item("a", "2026-10-01"), time: "13:00" };
  const b = { ...item("b", "2026-10-01"), time: "09:00" };
  const c = item("c", "2026-10-01");
  expect(groupUpcoming([a, b, c], "2026-09-30").soon.map((i) => i.id)).toEqual(["c", "b", "a"]);
});
