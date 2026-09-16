import { isCloudEnvironmentConfigured } from "../../config/env";
import { callApi, Identity } from "../../services/cloud";

type PageState = "unconfigured" | "idle" | "loading" | "success" | "error";

Page({
  data: {
    state: (isCloudEnvironmentConfigured() ? "idle" : "unconfigured") as PageState,
    statusText: isCloudEnvironmentConfigured()
      ? "环境已配置。可调用云函数验证当前身份。"
      : "环境尚未完成配置：请先填写 CloudBase 环境 ID。",
    userId: "",
    bootstrapToken: ""
  },

  setBootstrapToken(event: { detail: { value: string } }) {
    this.setData({ bootstrapToken: event.detail.value });
  },

  async bootstrapIdentity() {
    if (!isCloudEnvironmentConfigured()) return;
    const token = String(this.data.bootstrapToken).trim();
    if (!token) {
      wx.showToast({ title: "请输入管理员提供的临时初始化令牌", icon: "none" });
      return;
    }
    this.setData({ state: "loading", statusText: "正在建立受控开发身份…", userId: "" });
    const result = await callApi<Identity>("identity.bootstrap", { bootstrapToken: token });
    if (result.ok) {
      this.setData({
        state: "success",
        statusText: "开发身份已建立。请由账号持有人在控制台登记白名单后关闭此入口。",
        userId: result.data.userId,
        bootstrapToken: ""
      });
      return;
    }
    this.setData({ state: "error", statusText: result.error.message, userId: "" });
  },

  async verifyIdentity() {
    if (!isCloudEnvironmentConfigured()) return;
    this.setData({ state: "loading", statusText: "正在通过云端验证当前身份…", userId: "" });
    const result = await callApi<Identity>("identity.get");
    if (result.ok) {
      this.setData({
        state: "success",
        statusText: result.data.isNew ? "可信身份验证成功，已建立最小用户档案。" : "可信身份验证成功。",
        userId: result.data.userId
      });
      return;
    }
    const unconfigured = result.error.code === "IDENTITY_ALLOWLIST_UNCONFIGURED";
    this.setData({
      state: unconfigured ? "unconfigured" : "error",
      statusText: result.error.message,
      userId: ""
    });
  }
});
