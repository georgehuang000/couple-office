import { CLOUDBASE_ENV_ID, isCloudEnvironmentConfigured } from "./config/env";

App({
  onLaunch() {
    if (!isCloudEnvironmentConfigured()) {
      return;
    }
    if (!wx.cloud) {
      return;
    }
    wx.cloud.init({ env: CLOUDBASE_ENV_ID, traceUser: true });
  }
});

