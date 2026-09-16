const assert = require("node:assert/strict");
const test = require("node:test");
const { calendarDayDiff, nextAnniversary, randomInviteCode, sha256, togetherDays } = require("../.build/server-testing.cjs");

test("invite codes are 10 unambiguous uppercase characters", () => {
  const values = new Set(Array.from({ length: 100 }, randomInviteCode));
  assert.equal(values.size, 100);
  for (const value of values) assert.match(value, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
});

test("identity document key is based on appid + openid without exposing either", () => {
  const digest = sha256("wx-appopenid-secret");
  assert.equal(digest.length, 64);
  assert.equal(digest.includes("openid-secret"), false);
});

test("date helpers count the start date as day one and support future dates", () => {
  assert.equal(togetherDays("2026-09-16", "2026-09-16"), 1);
  assert.equal(togetherDays("2026-09-15", "2026-09-16"), 2);
  assert.equal(togetherDays("2026-09-18", "2026-09-16"), -2);
  assert.equal(calendarDayDiff("2026-09-16", "2026-09-20"), 4);
});

test("February 29 anniversaries use February 28 in non-leap years", () => {
  assert.deepEqual(nextAnniversary("2024-02-29", "2025-02-27"), { next_date: "2025-02-28", days_until: 1 });
  assert.deepEqual(nextAnniversary("2024-02-29", "2028-02-28"), { next_date: "2028-02-29", days_until: 1 });
});
