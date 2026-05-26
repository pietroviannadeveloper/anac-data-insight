import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

type AlertType = "error" | "warning" | "info";

interface AlertBadgeProps {
  type: AlertType;
  message: string;
  className?: string;
}

const alertConfig: Record<AlertType, { icon: typeof AlertCircle; classes: string }> = {
  error: {
    icon: AlertCircle,
    classes: "bg-red-50 text-red-700 border-red-200",
  },
  warning: {
    icon: AlertTriangle,
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  info: {
    icon: Info,
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

export default function AlertBadge({ type, message, className }: AlertBadgeProps) {
  const { icon: Icon, classes } = alertConfig[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
        classes,
        className
      )}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {message}
    </span>
  );
}
