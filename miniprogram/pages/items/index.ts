import { ApprovalRecord, PageResult, TaskRecord } from "../../../shared/contracts";
import { callApi, toastError } from "../../services/cloud";
import { demoApprovals, demoTasks } from "../../services/demo";
import { formatDateTime, todayString } from "../../utils/format";

const TASK_SCOPES = ["mine", "all", "completed"];
const APPROVAL_SCOPES = ["pending", "sent", "all"];

Page({
  data: {
    demo: false, tab: "task", filterIndex: 0, loading: true, loadingMore: false,
    filters: ["今天", "明天", "未来"], items: [] as any[], nextCursor: null as string | null, authUserId: "",
    approvalTypes: ["约会", "外出", "娱乐", "支出", "其他"], approvalTypeKeys: ["date", "outing", "entertainment", "purchase", "other"], approvalTypeIndex: 0,
    showSheet: false, submitting: false, editingTask: null as TaskRecord | null, assigneeOptions: [{ label: "共同待办", value: "" }] as any[], assigneeIndex: 0,
    form: { title: "", description: "", priority: "normal", due_date: "", assignee_id: "", template_key: "date", reply_date: "" },
  },
  onShow() {
    const tabBar = this.getTabBar?.();
    if (tabBar) tabBar.setData({ selected: 1 });
    const app = getApp<any>();
    const auth = app.globalData.auth;
    const assigneeOptions = [{ label: "共同待办", value: "" }, ...(auth?.couple?.members || []).map((member: any) => ({ label: member.nickname, value: member.user_id }))];
    this.setData({ authUserId: auth?.user?.user_id || (app.globalData.demo ? "demo_me" : ""), assigneeOptions });
    const stored = wx.getStorageSync("items_tab");
    if (stored) { wx.removeStorageSync("items_tab"); this.setData({ tab: stored, filterIndex: 0, filters: stored === "task" ? ["今天", "明天", "未来"] : ["待我回应", "我发起的", "全部"] }); }
    this.load(true);
  },
  onPullDownRefresh() { this.load(true).finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.nextCursor && !this.data.demo) this.load(false); },
  switchTab(event: any) {
    const tab = event.currentTarget.dataset.tab;
    this.setData({ tab, filterIndex: 0, filters: tab === "task" ? ["今天", "明天", "未来"] : ["待我回应", "我发起的", "全部"] });
    this.load(true);
  },
  chooseFilter(event: any) { this.setData({ filterIndex: Number(event.currentTarget.dataset.index) }); this.load(true); },
  decorate(records: any[]) {
    const demo = Boolean(getApp<any>().globalData.demo);
    const taskIcons = ["task-breakfast.png", "task-cart.png", "task-book.png", "task-fitness.png", "task-gift.png", "task-paw.png"];
    const taskTimes = ["08:00", "18:30", "21:00", "19:00", "全天", "17:30"];
    const approvalIcons = ["approval-plane.png", "approval-home.png", "approval-cheers.png", "approval-book.png"];
    const approvalNotes = ["想和你一起去看西湖的春天～♡", "想记录下我们更多的日常呀～♡", "好久没见他们了，一起去吧？♡", "想和你一起变成更好的我们♡"];
    return records.map((item, index) => ({
      ...item,
      time_text: demo ? (this.data.tab === "task" ? taskTimes[index % taskTimes.length] : ["2025年4月10日 14:26", "2025年4月9日 20:18", "2025年4月8日 11:03", "2025年4月6日 09:15"][index % 4]) : item.due_at ? formatDateTime(item.due_at) : item.reply_deadline ? `回复截止 ${formatDateTime(item.reply_deadline)}` : "没有截止时间",
      status_text: ({ todo: "待开始", doing: "进行中", done: "已完成", cancelled: "已取消", pending: "待回应", approved: "已同意", rejected: "再商量", expired: "已过期" } as any)[item.status] || item.status,
      icon_path: `/assets/${this.data.tab === "task" ? taskIcons[index % taskIcons.length] : approvalIcons[index % approvalIcons.length]}`,
      note_text: approvalNotes[index % approvalNotes.length],
    }));
  },
  async load(reset: boolean) {
    const demo = Boolean(getApp<any>().globalData.demo);
    if (demo) {
      const source = this.data.tab === "task" ? [demoTasks[0], demoTasks[1], demoTasks[4], demoTasks[3], demoTasks[2], demoTasks[5]] : demoApprovals;
      this.setData({ demo: true, loading: false, items: this.decorate(source), nextCursor: null });
      return;
    }
    this.setData(reset ? { loading: true } : { loadingMore: true });
    const scopes = this.data.tab === "task" ? TASK_SCOPES : APPROVAL_SCOPES;
    const action = this.data.tab === "task" ? "task.list" : "approval.list";
    const result = await callApi<PageResult<TaskRecord | ApprovalRecord>>(action, { scope: scopes[this.data.filterIndex], cursor: reset ? undefined : this.data.nextCursor, page_size: 20 });
    if (!result.ok) { toastError(result); this.setData({ loading: false, loadingMore: false }); return; }
    const items = this.decorate(reset ? result.data.items : [...this.data.items, ...result.data.items]);
    this.setData({ items, nextCursor: result.data.next_cursor, loading: false, loadingMore: false });
  },
  openCreate() {
    if (this.data.demo) return wx.showToast({ title: "演示模式不会修改数据", icon: "none" });
    this.setData({ showSheet: true, editingTask: null, assigneeIndex: 0, form: { title: "", description: "", priority: "normal", due_date: "", assignee_id: "", template_key: "date", reply_date: "" } });
  },
  openEditTask(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as TaskRecord;
    const assigneeIndex = Math.max(0, this.data.assigneeOptions.findIndex((option: any) => option.value === (item.assignee_id || "")));
    this.setData({ showSheet: true, editingTask: item, assigneeIndex, form: { title: item.title, description: item.description, priority: item.priority, due_date: item.due_at ? todayString(new Date(item.due_at)) : "", assignee_id: item.assignee_id || "", template_key: "date", reply_date: "" } });
  },
  closeSheet() { this.setData({ showSheet: false }); },
  stopBubble() {},
  updateForm(event: any) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  updateAssignee(event: any) { const index = Number(event.detail.value); this.setData({ assigneeIndex: index, "form.assignee_id": this.data.assigneeOptions[index].value }); },
  updateApprovalType(event: any) {
    const index = Number(event.detail.value);
    this.setData({ approvalTypeIndex: index, "form.template_key": this.data.approvalTypeKeys[index] });
  },
  async submit() {
    const form = this.data.form;
    if (!String(form.title).trim()) return wx.showToast({ title: "请填写标题", icon: "none" });
    this.setData({ submitting: true });
    const isTask = this.data.tab === "task";
    const payload: any = { title: form.title, description: form.description };
    if (isTask) {
      payload.priority = form.priority;
      payload.due_at = form.due_date ? new Date(`${form.due_date}T20:00:00+08:00`).getTime() : null;
      payload.assignee_id = form.assignee_id || null;
    } else {
      payload.content = form.description;
      delete payload.description;
      payload.template_key = form.template_key;
      payload.reply_deadline = form.reply_date ? new Date(`${form.reply_date}T23:59:59+08:00`).getTime() : null;
    }
    let action = isTask ? "task.create" : "approval.submit";
    if (isTask && this.data.editingTask) { action = "task.update"; payload.task_id = this.data.editingTask._id; payload.expected_version = this.data.editingTask.version; }
    const result = await callApi(action, payload);
    this.setData({ submitting: false });
    if (!result.ok) return toastError(result);
    this.setData({ showSheet: false });
    wx.showToast({ title: isTask ? (this.data.editingTask ? "待办已修改" : "待办已添加") : "申请已提交", icon: "success" });
    this.load(true);
  },
  async transitionTask(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as TaskRecord;
    const target = event.currentTarget.dataset.target;
    const result = await callApi<TaskRecord>("task.transition", { task_id: item._id, target_status: target, expected_version: item.version });
    if (!result.ok) return toastError(result);
    this.load(true);
  },
  async deleteTask(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as TaskRecord;
    const confirmed = await new Promise<boolean>((resolve) => wx.showModal({ title: "删除待办", content: `确定删除“${item.title}”吗？`, success: (res: any) => resolve(Boolean(res.confirm)), fail: () => resolve(false) }));
    if (!confirmed) return;
    const result = await callApi("task.delete", { task_id: item._id, expected_version: item.version });
    if (!result.ok) return toastError(result); this.load(true);
  },
  async decideApproval(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as ApprovalRecord;
    const decision = event.currentTarget.dataset.decision;
    const result = await callApi<ApprovalRecord>("approval.decide", { approval_id: item._id, decision, decision_comment: decision === "rejected" ? "我们再一起商量一下吧" : "", expected_version: item.version });
    if (!result.ok) return toastError(result);
    this.load(true);
  },
  async cancelApproval(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as ApprovalRecord;
    const result = await callApi("approval.cancel", { approval_id: item._id, expected_version: item.version });
    if (!result.ok) return toastError(result);
    this.load(true);
  },
  async copyApproval(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as ApprovalRecord;
    const result = await callApi("approval.submit", { template_key: item.template_key, title: item.title, content: item.content, start_at: item.start_at, end_at: item.end_at, reply_deadline: null });
    if (!result.ok) return toastError(result);
    wx.showToast({ title: "已复制重提", icon: "success" }); this.load(true);
  },
  async approvalToEvent(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as ApprovalRecord;
    const payload: any = { title: item.title, description: item.content, type: "date", source_approval_id: item._id };
    if (item.start_at) { payload.all_day = false; payload.start_at = item.start_at; payload.end_at = item.end_at; }
    else { const date = new Date(); const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0"); payload.all_day = true; payload.date_start = `${y}-${m}-${d}`; payload.date_end = payload.date_start; }
    const result = await callApi("event.create", payload);
    if (!result.ok) return toastError(result);
    wx.showToast({ title: "已写入日历", icon: "success" });
  },
});
