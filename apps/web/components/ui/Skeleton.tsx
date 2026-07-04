"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    className={cn(
      "animate-pulse rounded-md bg-white/8",
      className
    )}
  />
);

export const SkeletonCard = () => (
  <div className="bg-white/4 rounded-xl border border-white/8 p-5 space-y-3">
    <Skeleton className="h-3 w-24" />
    <Skeleton className="h-7 w-16" />
    <Skeleton className="h-2 w-32" />
  </div>
);

export const SkeletonTable = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2">
    <div className="flex gap-4 px-4 py-2">
      {[40, 120, 80, 80, 60].map((w, i) => (
        <Skeleton key={i} className="h-3" style={{ width: w }} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 px-4 py-3 border-t border-white/5">
        {[40, 120, 80, 80, 60].map((w, j) => (
          <Skeleton key={j} className="h-3" style={{ width: w }} />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonDashboard = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
    <Skeleton className="h-56 w-full rounded-xl" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  </div>
);
