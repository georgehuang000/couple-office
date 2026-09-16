import { EventRecord, PageResult } from "../../../shared/contracts";
import { callApi, toastError } from "../../services/cloud";
import { demoEvents } from "../../services/demo";
import { formatTime, monthGrid, todayString } from "../../utils/format";

function dateForEvent(event: EventRecord): string {
  return event.all_day ? String(event.date_start) : todayString(new Date(Number(event.start_at)));
}

Page({
  data: {
    demo: false, loading: true, year: 0, month: 0, monthLabel: "", selectedDate: "", days: [] as any[], events: [] as any[], selectedEvents: [] as any[], futureEvents: [] as any[],
    weekdays: ["日", "一", "二", "三", "四", "五", "六"], showSheet: false, submitting: false, editingEvent: null as EventRecord | null, form: { title: "", description: "", date: "", time: "19:00", all_day: false, type: "date" },
  },
  onLoad() {
    const now = new Date();
    this.setData({ year: now.getFullYear(), month: now.getMonth(), selectedDate: todayString(now), "form.date": todayString(now) });
  },
  onShow() {
    const tab = this.getTabBar?.();
    if (tab) tab.setData({ selected: 2 });
    this.load();
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  monthBounds() {
    const first = todayString(new Date(this.data.year, this.data.month, 1));
    const last = todayString(new Date(this.data.year, this.data.month + 1, 0));
    return { first, last };
  },
  async load() {
    this.setData({ loading: true });
    const demo = Boolean(getApp<any>().globalData.demo);
    let events: EventRecord[] = [];
    if (demo) {
      events = demoEvents;
      this.setData({ year: 2025, month: 3, selectedDate: "2025-04-18", "form.date": "2025-04-18" });
    }
    else {
      const { first, last } = this.monthBounds();
      const result = await callApi<PageResult<EventRecord>>("event.list", { from_date: first, to_date: last, page_size: 50 });
      if (!result.ok) { toastError(result); this.setData({ loading: false }); return; }
      events = result.data.items;
    }
    this.setData({ demo, loading: false, events: this.decorateEvents(events) });
    this.rebuildCalendar();
  },
  decorateEvents(events: EventRecord[]) {
    const icons: Record<string, string> = { de1: "event-movie.png", de2: "event-pot.png", de3: "event-tree.png", de4: "event-cake.png" };
    return events.map((event) => ({ ...event, date_key: dateForEvent(event), time_text: event.all_day ? "全天" : formatTime(event.start_at), type_text: event.type === "date" ? "约会" : event.type === "life" ? "日常" : "记录", icon_path: `/assets/${icons[event._id] || "event-tree.png"}`, date_text: event.all_day ? event.date_start : `${todayString(new Date(Number(event.start_at))).slice(5).replace("-", "月")}日` }));
  },
  rebuildCalendar() {
    const eventDates = new Set(this.data.events.map((event: any) => event.date_key));
    const today = todayString();
    const days = monthGrid(this.data.year, this.data.month).map((day) => ({ ...day, selected: day.date === this.data.selectedDate, today: day.date === today, hasEvent: eventDates.has(day.date) }));
    const selectedEvents = this.data.events.filter((event: any) => {
      if (event.all_day) return event.date_start <= this.data.selectedDate && event.date_end >= this.data.selectedDate;
      return event.date_key === this.data.selectedDate;
    });
    const futureEvents = this.data.events.filter((event: any) => event.date_key > this.data.selectedDate).slice(0, 2);
    this.setData({ days, selectedEvents, futureEvents, monthLabel: `${this.data.year}年${this.data.month + 1}月` });
  },
  changeMonth(event: any) {
    const delta = Number(event.currentTarget.dataset.delta);
    const next = new Date(this.data.year, this.data.month + delta, 1);
    const selectedDate = todayString(next);
    this.setData({ year: next.getFullYear(), month: next.getMonth(), selectedDate, "form.date": selectedDate });
    this.load();
  },
  selectDay(event: any) { const date = event.currentTarget.dataset.date; this.setData({ selectedDate: date, "form.date": date }); this.rebuildCalendar(); },
  openCreate() {
    if (this.data.demo) return wx.showToast({ title: "演示模式不会修改数据", icon: "none" });
    this.setData({ showSheet: true, editingEvent: null, form: { title: "", description: "", date: this.data.selectedDate, time: "19:00", all_day: false, type: "date" } });
  },
  openEdit(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as EventRecord;
    const start = item.all_day ? null : new Date(Number(item.start_at));
    this.setData({
      showSheet: true,
      editingEvent: item,
      form: {
        title: item.title,
        description: item.description || "",
        date: item.all_day ? String(item.date_start) : todayString(start!),
        time: item.all_day ? "19:00" : `${String(start!.getHours()).padStart(2, "0")}:${String(start!.getMinutes()).padStart(2, "0")}`,
        all_day: item.all_day,
        type: item.type,
      },
    });
  },
  closeSheet() { this.setData({ showSheet: false }); }, stopBubble() {},
  updateForm(event: any) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  toggleAllDay(event: any) { this.setData({ "form.all_day": event.detail.value }); },
  async submit() {
    const form = this.data.form;
    if (!form.title.trim()) return wx.showToast({ title: "请填写日程标题", icon: "none" });
    const payload: any = { title: form.title, description: form.description, type: form.type, all_day: form.all_day };
    if (form.all_day) { payload.date_start = form.date; payload.date_end = form.date; }
    else payload.start_at = new Date(`${form.date}T${form.time}:00+08:00`).getTime();
    this.setData({ submitting: true });
    let action = "event.create";
    if (this.data.editingEvent) {
      action = "event.update";
      payload.event_id = this.data.editingEvent._id;
      payload.expected_version = this.data.editingEvent.version;
    }
    const result = await callApi<EventRecord>(action, payload);
    this.setData({ submitting: false });
    if (!result.ok) return toastError(result);
    this.setData({ showSheet: false }); wx.showToast({ title: this.data.editingEvent ? "日程已修改" : "日程已添加", icon: "success" }); this.load();
  },
  async deleteEvent(event: any) {
    if (this.data.demo) return;
    const item = event.currentTarget.dataset.item as EventRecord;
    const confirm = await new Promise<boolean>((resolve) => wx.showModal({ title: "删除日程", content: `确定删除“${item.title}”吗？`, success: (res: any) => resolve(Boolean(res.confirm)), fail: () => resolve(false) }));
    if (!confirm) return;
    const result = await callApi("event.delete", { event_id: item._id, expected_version: item.version });
    if (!result.ok) return toastError(result);
    this.load();
  },
});
