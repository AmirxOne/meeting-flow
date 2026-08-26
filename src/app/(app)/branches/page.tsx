"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Phone, User } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardBody, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { faNum } from "@/lib";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  manager: { id: string; fullName: string } | null;
  floors: { id: string; name: string; number: number }[];
  _count: { rooms: number; users: number };
}

export default function BranchesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: Branch[] }>("/api/branches"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <SkeletonBlock className="h-8 w-32" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-44" />
          ))}
        </div>
      </div>
    );
  }

  const branches = data?.branches ?? [];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <h1 className="text-lg font-bold">شعب</h1>
      {branches.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 className="h-10 w-10" />} title="شعبه‌ای ثبت نشده" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {branches.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[15px] font-bold">{b.name}</p>
                  <div className="mt-2 space-y-1.5 text-[12px] text-ink-soft">
                    {b.address && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {b.address}
                      </p>
                    )}
                    {b.phone && (
                      <p className="flex items-center gap-1.5" dir="ltr">
                        <Phone className="h-3.5 w-3.5" />
                        <span dir="ltr">{b.phone}</span>
                      </p>
                    )}
                    {b.manager && (
                      <p className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        مدیر: {b.manager.fullName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="badge badge-gray">{faNum(b._count.rooms)} اتاق</span>
                <span className="badge badge-gray">{faNum(b._count.users)} کاربر</span>
                {b.floors.map((f) => (
                  <span key={f.id} className="badge badge-gray">
                    {f.name}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
