const assert = require("node:assert/strict");
const test = require("node:test");
const { bootstrapIdentity, parseAllowlist, resolveIdentity, toBusinessUserId } = require("../cloudfunctions/api/modules/identity");

function memoryUsers(initial = []) {
  const records = new Map(initial.map((item) => [item._id, item]));
  return {
    async getByOpenId(openid) { return records.get(openid) || null; },
    async create(user) { records.set(user._id, user); },
    records
  };
}

test("parseAllowlist trims blank values", () => {
  assert.deepEqual([...parseAllowlist(" openid-a, ,openid-b ")], ["openid-a", "openid-b"]);
});

test("identity creates a stable opaque business user id for an allowlisted caller", async () => {
  const users = memoryUsers();
  const result = await resolveIdentity({ openid: "openid-a", allowlist: "openid-a", users, now: () => 100 });
  assert.equal(result.isNew, true);
  assert.equal(result.userId, toBusinessUserId("openid-a"));
  assert.equal(result.userId.includes("openid-a"), false);
  assert.equal(users.records.get("openid-a").createdAt, 100);
});

test("identity returns the existing profile instead of creating another one", async () => {
  const users = memoryUsers([{ _id: "openid-a", userId: "usr_existing" }]);
  const result = await resolveIdentity({ openid: "openid-a", allowlist: "openid-a", users });
  assert.deepEqual(result, { userId: "usr_existing", isNew: false });
  assert.equal(users.records.size, 1);
});

test("identity rejects an unconfigured or unauthorized allowlist", async () => {
  const users = memoryUsers();
  await assert.rejects(
    resolveIdentity({ openid: "openid-a", allowlist: "", users }),
    { code: "IDENTITY_ALLOWLIST_UNCONFIGURED" }
  );
  await assert.rejects(
    resolveIdentity({ openid: "openid-a", allowlist: "openid-b", users }),
    { code: "IDENTITY_NOT_ALLOWED" }
  );
});

test("bootstrap creates an identity only with a configured long-lived server token", async () => {
  const users = memoryUsers();
  const result = await bootstrapIdentity({
    openid: "openid-a", bootstrapToken: "123456789012345678901234", submittedToken: "123456789012345678901234", users
  });
  assert.equal(result.isNew, true);
  await assert.rejects(
    bootstrapIdentity({ openid: "openid-b", bootstrapToken: "", submittedToken: "anything", users }),
    { code: "BOOTSTRAP_DISABLED" }
  );
  await assert.rejects(
    bootstrapIdentity({ openid: "openid-b", bootstrapToken: "123456789012345678901234", submittedToken: "incorrect-token-123456789", users }),
    { code: "BOOTSTRAP_TOKEN_INVALID" }
  );
});
