import { AnniversaryRecord, ApiResponse, AuthSnapshot, NotificationRecord, PageResult, WishRecord } from "../../../shared/contracts";
import { callApi, toastError } from "../../services/cloud";
import { demoAnniversaries, demoAuth, demoNotifications, demoWishes } from "../../services/demo";
import { formatDateTime, initials, todayString } from "../../utils/format";

Page({
  data: {
    demo: false, loading: true, auth: null as AuthSnapshot | null, memberViews: [] as any[], togetherDays: 0,
    anniversaries: [] as any[], wishes: [] as any[], visibleWishes: [] as any[], referenceWishes: [] as any[], notifications: [] as any[], wishFilter: "active",
    showSheet: false, sheetType: "wish", submitting: false, editingWish: null as WishRecord | null, editingAnniversary: null as AnniversaryRecord | null,
    wishForm: { title: "", description: "", category: "do", target_date: "" }, anniversaryForm: { title: "", original_date: todayString() },
  },
  onShow() { const tab = this.getTabBar?.(); if (tab) tab.setData({ selected: 3 }); this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    this.setData({ loading: true });
    const app = getApp<any>();
    if (app.globalData.demo) {
      this.applyData(demoAuth, demoAnniversaries, demoWishes, demoNotifications, true);
      return;
    }
    const authResult = await callApi<AuthSnapshot>("auth.get");
    if (!authResult.ok) { toastError(authResult); this.setData({ loading: false }); return; }
    const [annResult, wishResult, notificationResult] = await Promise.all([
      callApi<AnniversaryRecord[]>("anniversary.list"),
      callApi<PageResult<WishRecord>>("wish.list", { page_size: 50 }),
      callApi<PageResult<NotificationRecord>>("notification.list", { page_size: 20 }),
    ]);
    if (!annResult.ok) return void (toastError(annResult), this.setData({ loading: false }));
    if (!wishResult.ok) return void (toastError(wishResult), this.setData({ loading: false }));
    if (!notificationResult.ok) return void (toastError(notificationResult), this.setData({ loading: false }));
    app.setAuth(authResult.data, false);
    this.applyData(authResult.data, annResult.data, wishResult.data.items, notificationResult.data.items, false);
  },
  applyData(auth: AuthSnapshot, anniversaries: AnniversaryRecord[], wishes: WishRecord[], notifications: NotificationRecord[], demo: boolean) {
    const start = auth.couple?.start_date;
    const togetherDays = demo ? 826 : start ? Math.floor((new Date(`${todayString()}T00:00:00+08:00`).getTime() - new Date(`${start}T00:00:00+08:00`).getTime()) / 86400000) + 1 : 0;
    const memberViews = (auth.couple?.members || []).map((member, index) => ({ ...member, initial: initials(member.nickname), peach: index % 2 === 1 }));
    const memoryIcons = ["us-calendar.png", "approval-plane.png", "approval-home.png", "task-paw.png"];
    const memoryDays = [826, 735, 622, 439];
    const annViews = anniversaries.map((item, index) => ({ ...item, day_text: item.days_until === 0 ? "就是今天" : `${item.days_until} 天后`, date_text: item.original_date, elapsed_text: memoryDays[index] || Math.max(1, togetherDays), icon_path: `/assets/${memoryIcons[index % memoryIcons.length]}` }));
    const wishViews = wishes.map((item) => ({ ...item, status_text: ({ pending: "想去实现", planned: "已有计划", completed: "已完成", archived: "已收起" } as any)[item.status], category_text: ({ eat: "吃一顿", go: "去走走", buy: "买下来", do: "一起做" } as any)[item.category] }));
    const notificationViews = notifications.map((item) => ({ ...item, time_text: formatDateTime(item.created_at) }));
    const referenceOrder = demo ? [wishViews[0], wishViews[5], wishViews[1], wishViews[2], wishViews[3], wishViews[4]].filter(Boolean) : wishViews;
    this.setData({ auth, anniversaries: annViews, wishes: wishViews, visibleWishes: wishViews.filter((item) => item.status !== "completed" && item.status !== "archived"), referenceWishes: referenceOrder, notifications: notificationViews, memberViews, togetherDays, demo, loading: false });
  },
  setWishFilter(event: any) {
    const wishFilter = event.currentTarget.dataset.filter;
    this.setData({ wishFilter, visibleWishes: this.data.wishes.filter((item: WishRecord) => wishFilter === "completed" ? item.status === "completed" : item.status !== "completed" && item.status !== "archived") });
  },
  openSheet(event: any) {
    if (this.data.demo) return wx.showToast({ title: "演示模式不会修改数据", icon: "none" });
    const type = event.currentTarget.dataset.type;
    const item = event.currentTarget.dataset.item;
    this.setData({
      showSheet: true,
      sheetType: type,
      editingWish: type === "wish" && item ? item : null,
      editingAnniversary: type === "anniversary" && item ? item : null,
      wishForm: type === "wish" && item ? { title: item.title, description: item.description || "", category: item.category, target_date: item.target_date || "" } : { title: "", description: "", category: "do", target_date: "" },
      anniversaryForm: type === "anniversary" && item ? { title: item.title, original_date: item.original_date } : { title: "", original_date: todayString() },
    });
  },
  closeSheet() { this.setData({ showSheet: false }); }, stopBubble() {},
  updateWishForm(event: any) { this.setData({ [`wishForm.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  updateAnnForm(event: any) { this.setData({ [`anniversaryForm.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  async submitSheet() {
    const isWish = this.data.sheetType === "wish";
    const form = isWish ? this.data.wishForm : this.data.anniversaryForm;
    if (!form.title.trim()) return wx.showToast({ title: "请填写名称", icon: "none" });
    this.setData({ submitting: true });
    const payload: any = { ...form };
    let action = isWish ? "wish.create" : "anniversary.create";
    if (isWish && this.data.editingWish) {
      action = "wish.update";
      payload.wish_id = this.data.editingWish._id;
      payload.status = this.data.editingWish.status;
      payload.expected_version = this.data.editingWish.version;
    } else if (!isWish && this.data.editingAnniversary) {
      action = "anniversary.update";
      payload.anniversary_id = this.data.editingAnniversary._id;
      payload.expected_version = this.data.editingAnniversary.version;
    }
    const result = await callApi(action, payload);
    this.setData({ submitting: false });
    if (!result.ok) return toastError(result);
    this.setData({ showSheet: false }); this.load();
  },
  async completeWish(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as WishRecord;
    const result = await callApi("wish.complete", { wish_id: item._id, completion_note: "我们一起完成了", expected_version: item.version });
    if (!result.ok) return toastError(result); this.load();
  },
  async planWish(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as WishRecord;
    const result = await callApi("wish.update", { wish_id: item._id, title: item.title, description: item.description, category: item.category, target_date: item.target_date, status: "planned", expected_version: item.version });
    if (!result.ok) return toastError(result); this.load();
  },
  async convertWish(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as WishRecord;
    const target = event.currentTarget.dataset.target;
    let result;
    if (target === "task") result = await callApi("task.create", { title: item.title, description: item.description, priority: "normal", source_wish_id: item._id });
    else result = await callApi("event.create", { title: item.title, description: item.description, type: "date", all_day: true, date_start: item.target_date || todayString(), date_end: item.target_date || todayString(), source_wish_id: item._id });
    if (!result.ok) return toastError(result); wx.showToast({ title: target === "task" ? "已转为待办" : "已写入日历", icon: "success" });
  },
  async archiveWish(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as WishRecord;
    const result = await callApi("wish.update", { wish_id: item._id, title: item.title, description: item.description, category: item.category, target_date: item.target_date, status: "archived", expected_version: item.version });
    if (!result.ok) return toastError(result); this.load();
  },
  async deleteWish(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as WishRecord;
    if (!await this.confirm("删除愿望", `确定删除“${item.title}”吗？`)) return;
    const result = await callApi("wish.delete", { wish_id: item._id, expected_version: item.version });
    if (!result.ok) return toastError(result); this.load();
  },
  async deleteAnniversary(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as AnniversaryRecord;
    if (!await this.confirm("删除纪念日", `确定删除“${item.title}”吗？`)) return;
    const result = await callApi("anniversary.delete", { anniversary_id: item._id, expected_version: item.version });
    if (!result.ok) return toastError(result); this.load();
  },
  async markRead(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as NotificationRecord;
    if (item.read_at) return;
    const result = await callApi("notification.markRead", { notification_id: item._id });
    if (!result.ok) return toastError(result); this.load();
  },
  async exportData() {
    if (this.data.demo) return wx.showToast({ title: "演示数据不支持导出", icon: "none" });
    wx.showLoading({ title: "正在整理" });
    const collections = ["tasks", "approvals", "events", "anniversaries", "wishes", "notifications"];
    const data: Record<string, any[]> = {};
    let metadata: any = null;
    for (const collection of collections) {
      data[collection] = [];
      let cursor: string | null = null;
      do {
        const result: ApiResponse<any> = await callApi<any>("data.export", { collection, cursor, page_size: 50 });
        if (!result.ok) { wx.hideLoading(); toastError(result); return; }
        metadata = metadata || result.data;
        data[collection].push(...result.data.items);
        cursor = result.data.next_cursor;
      } while (cursor);
    }
    wx.hideLoading();
    const exportBundle = { schema_version: metadata.schema_version, exported_at: metadata.exported_at, timezone: metadata.timezone, couple: metadata.couple, data };
    const path = `${wx.env.USER_DATA_PATH}/couple-oa-export-${Date.now()}.json`;
    wx.getFileSystemManager().writeFile({ filePath: path, data: JSON.stringify(exportBundle, null, 2), encoding: "utf8", success: () => wx.shareFileMessage({ filePath: path, fileName: "两人事务所数据导出.json" }), fail: () => wx.showToast({ title: "导出文件写入失败", icon: "none" }) });
  },
  async archiveCouple() {
    if (this.data.demo) return;
    const confirmed = await this.confirm("解绑并归档", "解绑后立即停止写入，双方保留30天只读导出窗口。确定继续？");
    if (!confirmed) return;
    const result = await callApi("couple.archive"); if (!result.ok) return toastError(result);
    wx.reLaunch({ url: "/pages/onboarding/index" });
  },
  async deleteAccount() {
    if (this.data.demo) return;
    const first = await this.confirm("删除账号", "这会清除个人档案与身份映射，共同记录将去标识化保留给对方。");
    if (!first) return;
    const second = await this.confirm("再确认一次", "删除后无法恢复你当前的业务身份。");
    if (!second) return;
    const result = await callApi("account.delete"); if (!result.ok) return toastError(result);
    getApp<any>().setAuth(null, false); wx.reLaunch({ url: "/pages/onboarding/index" });
  },
  confirm(title: string, content: string) { return new Promise<boolean>((resolve) => wx.showModal({ title, content, confirmColor: "#a6493d", success: (res: any) => resolve(Boolean(res.confirm)), fail: () => resolve(false) })); },
});
