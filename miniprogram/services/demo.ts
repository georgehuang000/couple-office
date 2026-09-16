import { ApprovalRecord, AuthSnapshot, Dashboard, EventRecord, NotificationRecord, TaskRecord, WishRecord, AnniversaryRecord } from "../../shared/contracts";

const now = Date.now();
const day = 86_400_000;

export const demoAuth: AuthSnapshot = {
  user: { user_id: "demo_me", nickname: "小宇", avatar_key: "sage", couple_id: "demo_couple", status: "active" },
  couple: {
    _id: "demo_couple", name: "两人事务所", status: "active", start_date: "2024-02-14", timezone: "Asia/Shanghai",
    member_ids: ["demo_me", "demo_partner"],
    members: [
      { user_id: "demo_me", nickname: "小宇", avatar_key: "sage" },
      { user_id: "demo_partner", nickname: "美美", avatar_key: "peach" },
    ],
    version: 1,
  },
  is_new: false,
};

export const demoTasks: TaskRecord[] = [
  { _id: "dt1", title: "一起做早餐", description: "开启元气满满的一天", creator_id: "demo_me", assignee_id: null, due_at: now + 60 * 60 * 1000, priority: "normal", status: "done", completed_by: "demo_partner", completed_at: now, version: 2, created_at: now - day, updated_at: now },
  { _id: "dt2", title: "下班一起去超市", description: "买点食材，周末做火锅", creator_id: "demo_partner", assignee_id: "demo_me", due_at: now + 6 * 60 * 60 * 1000, priority: "normal", status: "todo", completed_by: null, completed_at: null, version: 1, created_at: now - day, updated_at: now - day },
  { _id: "dt3", title: "给他准备生日礼物", description: "偷偷制造一个小惊喜", creator_id: "demo_me", assignee_id: "demo_me", due_at: now + 3 * day, priority: "important", status: "doing", completed_by: null, completed_at: null, version: 2, created_at: now - day, updated_at: now },
  { _id: "dt4", title: "一起去健身", description: "自律一点，一起变更好", creator_id: "demo_partner", assignee_id: "demo_me", due_at: now + 8 * 60 * 60 * 1000, priority: "normal", status: "todo", completed_by: null, completed_at: null, version: 1, created_at: now - day, updated_at: now },
  { _id: "dt5", title: "一起看《浪漫的体质》", description: "吃点零食，窝在沙发上", creator_id: "demo_me", assignee_id: null, due_at: now + 9 * 60 * 60 * 1000, priority: "normal", status: "todo", completed_by: null, completed_at: null, version: 1, created_at: now - day, updated_at: now },
  { _id: "dt6", title: "带豆豆去遛弯", description: "和小家伙一起晒太阳", creator_id: "demo_partner", assignee_id: null, due_at: now + 7 * 60 * 60 * 1000, priority: "normal", status: "todo", completed_by: null, completed_at: null, version: 1, created_at: now - day, updated_at: now },
];

export const demoApprovals: ApprovalRecord[] = [
  { _id: "da1", template_key: "date", title: "旅行计划申请", content: "五一去杭州看春天", applicant_id: "demo_partner", approver_id: "demo_me", start_at: now + 12 * day, end_at: now + 14 * day, reply_deadline: now + 2 * day, status: "pending", decision_comment: "", decided_at: null, version: 1, created_at: now - day, updated_at: now - day },
  { _id: "da2", template_key: "purchase", title: "大额支出申请", content: "购买拍立得相机", applicant_id: "demo_partner", approver_id: "demo_me", start_at: null, end_at: null, reply_deadline: null, status: "pending", decision_comment: "", decided_at: null, version: 1, created_at: now - 2 * day, updated_at: now - 2 * day },
  { _id: "da3", template_key: "entertainment", title: "周末聚会申请", content: "周六和朋友一起聚餐", applicant_id: "demo_partner", approver_id: "demo_me", start_at: null, end_at: null, reply_deadline: null, status: "pending", decision_comment: "", decided_at: null, version: 1, created_at: now - 3 * day, updated_at: now - 3 * day },
  { _id: "da4", template_key: "other", title: "课程报名申请", content: "一起报瑜伽课", applicant_id: "demo_partner", approver_id: "demo_me", start_at: null, end_at: null, reply_deadline: null, status: "pending", decision_comment: "", decided_at: null, version: 1, created_at: now - 4 * day, updated_at: now - 4 * day },
];

export const demoEvents: EventRecord[] = [
  { _id: "de1", title: "一起看电影", description: "好电影要一起看才有意义", type: "date", all_day: false, start_at: Date.parse("2025-04-18T19:00:00+08:00"), end_at: Date.parse("2025-04-18T21:00:00+08:00"), date_start: null, date_end: null, creator_id: "demo_me", source_approval_id: null, source_wish_id: null, version: 1, created_at: now - day, updated_at: now - day },
  { _id: "de2", title: "一起做饭", description: "一起做饭，也是一种浪漫", type: "life", all_day: false, start_at: Date.parse("2025-04-18T21:00:00+08:00"), end_at: Date.parse("2025-04-18T22:00:00+08:00"), date_start: null, date_end: null, creator_id: "demo_partner", source_approval_id: null, source_wish_id: null, version: 1, created_at: now, updated_at: now },
  { _id: "de3", title: "去公园散步", description: "一起吹吹风，看看春天的花", type: "life", all_day: false, start_at: Date.parse("2025-04-20T16:00:00+08:00"), end_at: Date.parse("2025-04-20T17:00:00+08:00"), date_start: null, date_end: null, creator_id: "demo_partner", source_approval_id: null, source_wish_id: null, version: 1, created_at: now, updated_at: now },
  { _id: "de4", title: "周年纪念约会", description: "三周年，和你一起更加心动", type: "anniversary", all_day: false, start_at: Date.parse("2025-05-20T18:30:00+08:00"), end_at: Date.parse("2025-05-20T21:00:00+08:00"), date_start: null, date_end: null, creator_id: "demo_me", source_approval_id: null, source_wish_id: null, version: 1, created_at: now, updated_at: now },
];

export const demoAnniversaries: AnniversaryRecord[] = [
  { _id: "dn1", title: "在一起的日子", original_date: "2024-02-14", recurrence: "yearly", leap_day_policy: "february_28", creator_id: "demo_me", next_date: "2027-02-14", days_until: 151, version: 1 },
  { _id: "dn2", title: "第一次旅行", original_date: "2024-05-20", recurrence: "yearly", leap_day_policy: "february_28", creator_id: "demo_partner", next_date: "2027-05-20", days_until: 246, version: 1 },
  { _id: "dn3", title: "第一次一起住", original_date: "2024-09-01", recurrence: "yearly", leap_day_policy: "february_28", creator_id: "demo_me", next_date: "2027-09-01", days_until: 350, version: 1 },
  { _id: "dn4", title: "第一次养宠物", original_date: "2025-03-08", recurrence: "yearly", leap_day_policy: "february_28", creator_id: "demo_partner", next_date: "2027-03-08", days_until: 173, version: 1 },
];

export const demoWishes: WishRecord[] = [
  { _id: "dw1", title: "一起去看樱花", description: "选一个晴天出发", category: "go", status: "completed", target_date: null, creator_id: "demo_partner", completed_by: "demo_me", completed_at: now - 20 * day, version: 2, created_at: now - 60 * day, updated_at: now - 20 * day },
  { _id: "dw2", title: "去一次北海道", description: "冬天看雪和流冰", category: "go", status: "planned", target_date: "2027-01-15", creator_id: "demo_me", completed_by: null, completed_at: null, version: 2, created_at: now - 30 * day, updated_at: now },
  { _id: "dw3", title: "养一只小猫", description: "先做好长期照顾准备", category: "do", status: "pending", target_date: null, creator_id: "demo_partner", completed_by: null, completed_at: null, version: 1, created_at: now - 10 * day, updated_at: now - 10 * day },
  { _id: "dw4", title: "一起拍情侣写真", description: "留住现在的我们", category: "do", status: "pending", target_date: null, creator_id: "demo_me", completed_by: null, completed_at: null, version: 1, created_at: now - 8 * day, updated_at: now - 8 * day },
  { _id: "dw5", title: "存够钱去冰岛看极光", description: "一起等那片光", category: "go", status: "planned", target_date: null, creator_id: "demo_partner", completed_by: null, completed_at: null, version: 1, created_at: now - 6 * day, updated_at: now - 6 * day },
  { _id: "dw6", title: "一起看一场演唱会", description: "把喜欢的歌一起听", category: "do", status: "completed", target_date: null, creator_id: "demo_me", completed_by: "demo_partner", completed_at: now - 5 * day, version: 2, created_at: now - 40 * day, updated_at: now - 5 * day },
];

export const demoNotifications: NotificationRecord[] = [
  { _id: "dm1", type: "approval_received", resource_type: "approval", resource_id: "da1", preview: "收到申请：旅行计划申请", read_at: null, created_at: now - 60 * 60 * 1000 },
  { _id: "dm2", type: "task_completed", resource_type: "task", resource_id: "dt1", preview: "待办已完成：一起做早餐", read_at: now, created_at: now - day },
];

export const demoDashboard: Dashboard = {
  couple: demoAuth.couple!, today_tasks: demoTasks, pending_approvals: demoApprovals, upcoming_events: demoEvents,
  next_anniversary: demoAnniversaries[0], unread_count: 1, together_days: 826,
};
