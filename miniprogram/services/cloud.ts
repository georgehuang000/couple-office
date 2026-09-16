import { ApiFailure, ApiResponse } from "../../shared/contracts";
import { isCloudEnvironmentConfigured } from "../config/env";

export function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function callApi<T>(
  action: string,
  payload: Record<string, unknown> = {},
  options: { requestId?: string } = {},
): Promise<ApiResponse<T>> {
  const requestId = options.requestId || createRequestId();
  if (!isCloudEnvironmentConfigured()) {
    return failure("CLOUD_UNCONFIGURED", "开发云环境尚未创建，当前展示只读演示数据。", false, requestId);
  }
  if (!wx.cloud) return failure("CLOUD_UNAVAILABLE", "当前微信版本不支持云开发，请升级后重试。", false, requestId);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      // A transport failure may happen after the server committed. The single
      // retry intentionally reuses request_id so server-side dedup returns the
      // first result instead of repeating a write.
      const response = await wx.cloud.callFunction({ name: "api", data: { action, request_id: requestId, payload } });
      const result = response.result as ApiResponse<T>;
      if (!result || typeof result !== "object" || !("ok" in result)) return failure("INVALID_RESPONSE", "服务返回格式无效，请稍后重试。", true, requestId);
      return result;
    } catch (_error) {
      if (attempt === 1) return failure("NETWORK_OR_FUNCTION_ERROR", "云函数调用失败，请检查网络与开发环境后重试。", true, requestId);
    }
  }
  return failure("NETWORK_OR_FUNCTION_ERROR", "云函数调用失败，请稍后重试。", true, requestId);
}

export function failure(code: string, message: string, retryable: boolean, requestId = createRequestId()): ApiFailure {
  return { ok: false, error: { code, message, retryable }, request_id: requestId, server_time: Date.now() };
}

export function shouldUseDemo(result: ApiResponse<unknown>): boolean {
  return !result.ok && ["CLOUD_UNCONFIGURED", "IDENTITY_NOT_ALLOWED", "IDENTITY_ALLOWLIST_UNCONFIGURED"].includes(result.error.code);
}

export function toastError(result: ApiFailure): void {
  wx.showToast({ title: result.error.message, icon: "none", duration: 2600 });
}
