export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  request_id: string;
  server_time: number;
};

export type ApiFailure = {
  ok: false;
  error: ApiError;
  request_id: string;
  server_time: number;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type UserProfile = {
  user_id: string;
  nickname: string;
  avatar_key: string;
  couple_id: string | null;
  status: "active" | "deleted";
  archived_exports?: Array<{ couple_id: string; export_until: number }>;
};

export type AuthSnapshot = {
  user: UserProfile;
  couple: CoupleSummary | null;
  is_new: boolean;
};

export type CoupleSummary = {
  _id: string;
  name: string;
  status: "waiting" | "active" | "archived";
  start_date: string | null;
  timezone: string;
  member_ids: string[];
  members?: Array<Pick<UserProfile, "user_id" | "nickname" | "avatar_key">>;
  version: number;
};

export type TaskStatus = "todo" | "doing" | "done" | "cancelled";
export type TaskRecord = {
  _id: string;
  title: string;
  description: string;
  creator_id: string;
  assignee_id: string | null;
  due_at: number | null;
  priority: "normal" | "important";
  status: TaskStatus;
  completed_by: string | null;
  completed_at: number | null;
  source_wish_id?: string | null;
  version: number;
  created_at: number;
  updated_at: number;
};

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";
export type ApprovalRecord = {
  _id: string;
  template_key: string;
  title: string;
  content: string;
  applicant_id: string;
  approver_id: string;
  start_at: number | null;
  end_at: number | null;
  reply_deadline: number | null;
  status: ApprovalStatus;
  decision_comment: string;
  decided_at: number | null;
  version: number;
  created_at: number;
  updated_at: number;
};

export type EventRecord = {
  _id: string;
  title: string;
  description: string;
  type: string;
  all_day: boolean;
  start_at: number | null;
  end_at: number | null;
  date_start: string | null;
  date_end: string | null;
  creator_id: string;
  source_approval_id: string | null;
  source_wish_id: string | null;
  version: number;
  created_at: number;
  updated_at: number;
};

export type AnniversaryRecord = {
  _id: string;
  title: string;
  original_date: string;
  recurrence: "yearly";
  leap_day_policy: "february_28";
  creator_id: string;
  next_date?: string;
  days_until?: number;
  version: number;
};

export type WishStatus = "pending" | "planned" | "completed" | "archived";
export type WishRecord = {
  _id: string;
  title: string;
  description: string;
  category: "eat" | "go" | "buy" | "do";
  status: WishStatus;
  target_date: string | null;
  creator_id: string;
  completed_by: string | null;
  completed_at: number | null;
  version: number;
  created_at: number;
  updated_at: number;
};

export type NotificationRecord = {
  _id: string;
  type: string;
  resource_type: string;
  resource_id: string;
  preview: string;
  read_at: number | null;
  created_at: number;
};

export type Dashboard = {
  couple: CoupleSummary;
  today_tasks: TaskRecord[];
  pending_approvals: ApprovalRecord[];
  upcoming_events: EventRecord[];
  next_anniversary: AnniversaryRecord | null;
  unread_count: number;
  together_days: number | null;
};

export type PageResult<T> = {
  items: T[];
  next_cursor: string | null;
};
