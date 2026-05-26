import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: { value: number; label: string };
  icon: LucideIcon;
  color?: "blue" | "green" | "amber" | "red" | "gray";
}

const colorMap = {
  blue: "bg-blue-50 text-[#003A70]",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  gray: "bg-gray-100 text-gray-600",
};

export default function MetricCard({
  title,
  value,
  unit,
  trend,
  icon: Icon,
  color = "blue",
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn("p-2.5 rounded-lg flex-shrink-0", colorMap[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          {title}
        </p>
        <p className="text-2xl font-bold text-gray-900">
          {value}
          {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
        </p>
        {trend && (
          <p className="text-xs text-gray-400 mt-0.5">
            {trend.value >= 0 ? "+" : ""}
            {trend.value} {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
