import { CLOUDBASE_ENV_ID, isCloudEnvironmentConfigured } from "./config/env";
import { AuthSnapshot } from "../shared/contracts";

App({
  globalData: {
    auth: null as AuthSnapshot | null,
    demo: false,
  },
  onLaunch() {
    if (!isCloudEnvironmentConfigured()) {
      return;
    }
    if (!wx.cloud) {
      return;
    }
    wx.cloud.init({ env: CLOUDBASE_ENV_ID, traceUser: true });
  },
  setAuth(auth: AuthSnapshot | null, demo = false) {
    this.globalData.auth = auth;
    this.globalData.demo = demo;
  }
});
