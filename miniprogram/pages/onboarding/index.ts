import { ApiResponse, AuthSnapshot, CoupleSummary } from "../../../shared/contracts";
import { REVIEW_DEMO_ENABLED } from "../../config/env";
import { callApi, shouldUseDemo, toastError } from "../../services/cloud";
import { demoAuth } from "../../services/demo";
import { todayString } from "../../utils/format";

type AppState = { globalData: { auth: AuthSnapshot | null; demo: boolean }; setAuth(auth: AuthSnapshot | null, demo?: boolean): void };

Page({
  data: {
    loading: true,
    demoAvailable: REVIEW_DEMO_ENABLED,
    errorText: "",
    auth: null as AuthSnapshot | null,
    nickname: "",
    avatarKey: "sage",
    avatars: ["sage", "peach", "sun", "moon"],
    mode: "create" as "create" | "join",
    coupleName: "两人事务所",
    startDate: todayString(),
    inviteCode: "",
    generatedCode: "",
    generatedInvitationId: "",
    bootstrapToken: "",
    showDeveloper: false,
  },

  onLoad() { this.loadIdentity(); },

  async loadIdentity() {
    this.setData({ loading: true, errorText: "" });
    const result = await callApi<AuthSnapshot>("auth.get");
    if (result.ok) {
      getApp<AppState>().setAuth(result.data, false);
      if (result.data.user.couple_id || result.data.couple) {
        wx.switchTab({ url: "/pages/workbench/index" });
        return;
      }
      this.setData({ loading: false, auth: result.data, nickname: result.data.user.nickname || "" });
      return;
    }
    if (shouldUseDemo(result)) {
      this.setData({ loading: false, errorText: result.error.message });
      return;
    }
    this.setData({ loading: false, errorText: result.error.message });
  },

  enterDemo() {
    getApp<AppState>().setAuth(demoAuth, true);
    wx.switchTab({ url: "/pages/workbench/index" });
  },

  setField(event: any) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  selectAvatar(event: any) { this.setData({ avatarKey: event.currentTarget.dataset.value }); },
  setMode(event: any) { this.setData({ mode: event.currentTarget.dataset.mode }); },
  setStartDate(event: any) { this.setData({ startDate: event.detail.value }); },
  toggleDeveloper() { this.setData({ showDeveloper: !this.data.showDeveloper }); },

  async saveProfile() {
    if (!this.data.nickname.trim()) {
      wx.showToast({ title: "请先填写你的称呼", icon: "none" });
      return false;
    }
    const result = await callApi<any>("user.updateProfile", { nickname: this.data.nickname, avatar_key: this.data.avatarKey });
    if (!result.ok) { toastError(result); return false; }
    const auth = { ...this.data.auth!, user: result.data, is_new: false };
    getApp<AppState>().setAuth(auth, false);
    this.setData({ auth });
    wx.showToast({ title: "称呼已保存", icon: "success" });
    return true;
  },

  async createSpace() {
    if ((!this.data.auth || this.data.auth.is_new) && !await this.saveProfile()) return;
    const result = await callApi<CoupleSummary>("couple.create", { name: this.data.coupleName, start_date: this.data.startDate });
    if (!result.ok) return toastError(result);
    const invite = await callApi<{ invitation_id: string; code: string }>("invite.create");
    if (!invite.ok) return toastError(invite);
    const auth = { ...this.data.auth!, couple: result.data, user: { ...this.data.auth!.user, couple_id: result.data._id } };
    getApp<AppState>().setAuth(auth, false);
    this.setData({ auth, generatedCode: invite.data.code, generatedInvitationId: invite.data.invitation_id });
  },

  copyInvite() {
    wx.setClipboardData({ data: this.data.generatedCode });
  },

  async revokeInvite() {
    const result = await callApi("invite.revoke", { invitation_id: this.data.generatedInvitationId });
    if (!result.ok) return toastError(result);
    this.setData({ generatedCode: "", generatedInvitationId: "" });
    wx.showToast({ title: "邀请已撤销", icon: "success" });
  },

  async joinSpace() {
    if ((!this.data.auth || this.data.auth.is_new) && !await this.saveProfile()) return;
    const result = await callApi<{ join_request_id: string }>("join.request", { code: String(this.data.inviteCode).toUpperCase() });
    if (!result.ok) return toastError(result);
    wx.showModal({ title: "申请已送达", content: "对方确认后，你们就会进入同一个双人空间。", showCancel: false });
  },

  async bootstrap() {
    const result = await callApi<AuthSnapshot>("auth.bootstrap", { bootstrap_token: this.data.bootstrapToken });
    if (!result.ok) return toastError(result);
    getApp<AppState>().setAuth(result.data, false);
    this.setData({ auth: result.data, errorText: "", bootstrapToken: "" });
    wx.showModal({ title: "开发身份已建立", content: "请在云端 users 集合登记两个 OpenID 白名单后，立即关闭临时初始化令牌。", showCancel: false });
  },

  async exportArchived(event: any) {
    const coupleId = event.currentTarget.dataset.id;
    wx.showLoading({ title: "正在整理" });
    const collections = ["tasks", "approvals", "events", "anniversaries", "wishes", "notifications"];
    const data: Record<string, any[]> = {};
    let metadata: any = null;
    for (const collection of collections) {
      data[collection] = [];
      let cursor: string | null = null;
      do {
        const result: ApiResponse<any> = await callApi("data.export", { couple_id: coupleId, collection, cursor, page_size: 50 });
        if (!result.ok) { wx.hideLoading(); toastError(result); return; }
        metadata = metadata || result.data; data[collection].push(...result.data.items); cursor = result.data.next_cursor;
      } while (cursor);
    }
    wx.hideLoading();
    const bundle = { schema_version: metadata.schema_version, exported_at: metadata.exported_at, timezone: metadata.timezone, couple: metadata.couple, data };
    const path = `${wx.env.USER_DATA_PATH}/couple-oa-archive-${Date.now()}.json`;
    wx.getFileSystemManager().writeFile({ filePath: path, data: JSON.stringify(bundle, null, 2), encoding: "utf8", success: () => wx.shareFileMessage({ filePath: path, fileName: "两人事务所历史导出.json" }), fail: () => wx.showToast({ title: "导出文件写入失败", icon: "none" }) });
  },

  goWorkbench() { wx.switchTab({ url: "/pages/workbench/index" }); }
});
