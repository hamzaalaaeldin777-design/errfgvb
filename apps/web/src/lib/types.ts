export type PlanId = "free" | "pro" | "enterprise";

export type User = {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  role: "developer" | "admin";
  plan: PlanId;
};

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  requestCount?: number;
  lastUsedAt?: string | null;
  createdAt?: string;
  status: "active" | "revoked" | "disabled";
};

export type DashboardOverview = {
  user: User;
  plan: {
    label: string;
    dailyLimit: number | null;
    price: string;
    tagline: string;
  };
  usage: {
    today: number;
    limit: number | null;
    remaining: number | null;
    sevenDayTotal: number;
    daily: Array<{ day: string; total: number }>;
    topEndpoints: Array<{ endpoint: string; total: number }>;
  };
  keys: ApiKeyRecord[];
};

export type AdminUsersResponse = {
  users: Array<
    User & {
      status: string;
      createdAt: string;
      requestCountToday: number;
      keys: ApiKeyRecord[];
    }
  >;
};

export type AdminUsageResponse = {
  endpoints: Array<{ endpoint: string; total: number }>;
  topConsumers: Array<{ email: string; plan: PlanId; total: number }>;
  recentRequests: Array<{
    endpoint: string;
    method: string;
    status_code: number;
    response_time_ms: number;
    created_at: string;
    email?: string | null;
    key_prefix?: string | null;
  }>;
};

