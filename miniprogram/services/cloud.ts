export type ApiError = {
  code: string;
  message: string;
  requestId?: string;
  retryable: boolean;
};

export type ApiSuccess<T> = { ok: true; data: T; requestId: string };
export type ApiFailure = { ok: false; error: ApiError; requestId: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type Identity = { userId: string; isNew: boolean };

export async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  if (!wx.cloud) {
    return failure("CLOUD_UNAVAILABLE", "当前基础库不支持云开发，请升级微信后重试。", false);
  }

  try {
    const response = await wx.cloud.callFunction<ApiResponse<T>>({
      name: "api",
      data: { action, payload }
    });
    const result = response.result;
    if (!result || typeof result !== "object" || !("ok" in result)) {
      return failure("INVALID_RESPONSE", "服务返回格式无效，请稍后重试。", true);
    }
    return result;
  } catch (_error) {
    return failure("NETWORK_OR_FUNCTION_ERROR", "云函数调用失败，请检查网络与云环境后重试。", true);
  }
}

function failure(code: string, message: string, retryable: boolean): ApiFailure {
  return { ok: false, error: { code, message, retryable }, requestId: "client-unavailable" };
}
