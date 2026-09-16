import { AuthSnapshot, Dashboard, TaskRecord } from "../../../shared/contracts";
import { callApi, shouldUseDemo, toastError } from "../../services/cloud";
import { demoAuth, demoDashboard } from "../../services/demo";
import { formatDateTime, initials } from "../../utils/format";

type JoinRequest = { _id: string; applicant: { nickname: string; avatar_key: string } };

Page({
  data: { loading: true, demo: false, auth: null as AuthSnapshot | null, dashboard: null as Dashboard | null, waiting: false, inviteCode: "", invitationId: "", joinRequests: [] as JoinRequest[], greeting: "早上好" },
  onShow() {
    const tab = this.getTabBar?.();
    if (tab) tab.setData({ selected: 0 });
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    const hour = new Date().getHours();
    const greeting = hour < 11 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
    const app = getApp<any>();
    if (app.globalData.demo) {
      this.setData({ loading: false, demo: true, auth: demoAuth, dashboard: this.decorateDashboard(demoDashboard), greeting });
      return;
    }
    const authResult = await callApi<AuthSnapshot>("auth.get");
    if (!authResult.ok) {
      if (shouldUseDemo(authResult)) {
        app.setAuth(demoAuth, true);
        this.setData({ loading: false, demo: true, auth: demoAuth, dashboard: this.decorateDashboard(demoDashboard), greeting });
      } else {
        toastError(authResult);
        this.setData({ loading: false, greeting });
      }
      return;
    }
    app.setAuth(authResult.data, false);
    if (!authResult.data.user.couple_id) return void wx.reLaunch({ url: "/pages/onboarding/index" });
    if (authResult.data.couple?.status === "waiting") {
      const coupleResult = await callApi<any>("couple.get");
      this.setData({ loading: false, auth: authResult.data, waiting: true, joinRequests: coupleResult.ok ? (coupleResult.data.pending_join_requests || []) : [], greeting });
      return;
    }
    const result = await callApi<Dashboard>("dashboard.get");
    if (!result.ok) {
      toastError(result);
      this.setData({ loading: false, auth: authResult.data, greeting });
      return;
    }
    this.setData({ loading: false, auth: authResult.data, dashboard: this.decorateDashboard(result.data), waiting: false, greeting });
  },
  decorateDashboard(data: Dashboard) {
    return {
      ...data,
      today_tasks: data.today_tasks.map((task) => ({ ...task, due_text: task.due_at ? formatDateTime(task.due_at) : "今日完成" })),
      upcoming_events: data.upcoming_events.map((event) => ({ ...event, time_text: event.all_day ? `${event.date_start} 全天` : formatDateTime(event.start_at) })),
      member_views: (data.couple.members || []).map((member, index) => ({ ...member, initials: initials(member.nickname), peach: index % 2 === 1 })),
    };
  },
  async completeTask(event: any) {
    if (this.data.demo) return wx.showToast({ title: "演示模式不会修改数据", icon: "none" });
    const task = event.currentTarget.dataset.task as TaskRecord;
    const result = await callApi<TaskRecord>("task.transition", { task_id: task._id, target_status: task.status === "done" ? "todo" : "done", expected_version: task.version });
    if (!result.ok) return toastError(result);
    wx.showToast({ title: "已更新", icon: "success" });
    this.load();
  },
  async createInvite() {
    if (this.data.demo) return;
    const result = await callApi<{ invitation_id: string; code: string }>("invite.create");
    if (!result.ok) return toastError(result);
    this.setData({ inviteCode: result.data.code, invitationId: result.data.invitation_id });
  },
  copyInvite() { if (this.data.inviteCode) wx.setClipboardData({ data: this.data.inviteCode }); },
  async revokeInvite() {
    if (!this.data.invitationId) return;
    const result = await callApi("invite.revoke", { invitation_id: this.data.invitationId });
    if (!result.ok) return toastError(result);
    this.setData({ inviteCode: "", invitationId: "" });
    wx.showToast({ title: "邀请已撤销", icon: "success" });
  },
  async decideJoin(event: any) {
    const { id, decision } = event.currentTarget.dataset;
    const result = await callApi(decision === "confirm" ? "join.confirm" : "join.reject", { join_request_id: id });
    if (!result.ok) return toastError(result);
    wx.showToast({ title: decision === "confirm" ? "已同意加入" : "已拒绝", icon: "success" });
    this.load();
  },
  goItems(event: any) { wx.setStorageSync("items_tab", event.currentTarget.dataset.tab || "task"); wx.switchTab({ url: "/pages/items/index" }); },
  goCalendar() { wx.switchTab({ url: "/pages/calendar/index" }); },
});
