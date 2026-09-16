const cloud = require("wx-server-sdk");
const { errorResponse, successResponse } = require("./modules/response");
const { bootstrapIdentity, resolveIdentity } = require("./modules/identity");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const requestId = typeof event.requestId === "string" ? event.requestId : `req_${Date.now()}`;
  if (event.action !== "identity.get" && event.action !== "identity.bootstrap") {
    return errorResponse("ACTION_NOT_FOUND", "请求的功能尚未开放。", requestId, false);
  }

  const context = cloud.getWXContext();
  if (!context.OPENID) {
    return errorResponse("IDENTITY_CONTEXT_MISSING", "无法验证微信身份，请确认小程序与云环境已关联。", requestId, false);
  }

  try {
    const input = {
      openid: context.OPENID,
      allowlist: process.env.COUPLE_OA_ALLOWED_OPENIDS,
      bootstrapToken: process.env.COUPLE_OA_BOOTSTRAP_TOKEN,
      submittedToken: event.payload && event.payload.bootstrapToken,
      users: createUsersRepository(db)
    };
    const identity = event.action === "identity.bootstrap"
      ? await bootstrapIdentity(input)
      : await resolveIdentity(input);
    return successResponse(identity, requestId);
  } catch (error) {
    if (error && error.code) {
      return errorResponse(error.code, error.message, requestId, Boolean(error.retryable));
    }
    // 不记录 OpenID、调用正文或白名单；生产环境应接入仅含 requestId 的受控错误日志。
    return errorResponse("INTERNAL_ERROR", "身份服务暂不可用，请稍后重试。", requestId, true);
  }
};

function createUsersRepository(database) {
  const collection = database.collection("users");
  return {
    async getByOpenId(openid) {
      const result = await collection.where({ _id: openid }).limit(1).get();
      return result.data[0] || null;
    },
    async create(user) {
      // _id 仅在服务端使用，以同一 OpenID 覆盖写实现首次身份建档的幂等性。
      await collection.doc(user._id).set({ data: user });
    }
  };
}
