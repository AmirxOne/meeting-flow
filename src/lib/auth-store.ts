"use client";

import { create } from "zustand";
import { api } from "@/lib/api";

export interface Me {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  branchId: string | null;
  isSuperAdmin: boolean;
  isPlatformAdmin?: boolean;
  orgId?: string;
  orgSlug?: string;
  roles: { key: string; name: string }[];
  permissions: string[];
}

interface AuthState {
  me: Me | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  can: (perm: string) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  me: null,
  loaded: false,
  refresh: async () => {
    try {
      const data = await api<{ user: Me | null }>("/api/auth/me");
      set({ me: data.user, loaded: true });
    } catch {
      set({ me: null, loaded: true });
    }
  },
  logout: async () => {
    await api("/api/auth/login", { method: "DELETE" }).catch(() => {});
    set({ me: null });
    window.location.href = "/login";
  },
  can: (perm) => {
    const me = get().me;
    if (!me) return false;
    if (me.isSuperAdmin) return true;
    return me.permissions.includes(perm);
  },
}));
