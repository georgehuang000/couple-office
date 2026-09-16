/**
 * 每个环境维护自己的副本。不要在这里放 AppSecret、OpenID 或任何私密白名单。
 */
export const CLOUDBASE_ENV_ID = "YOUR_CLOUDBASE_ENV_ID";
export const REVIEW_DEMO_ENABLED = true;
export const SUBSCRIPTION_MESSAGES_ENABLED = false;

export function isCloudEnvironmentConfigured(): boolean {
  return Boolean(CLOUDBASE_ENV_ID) && !CLOUDBASE_ENV_ID.startsWith("YOUR_");
}
