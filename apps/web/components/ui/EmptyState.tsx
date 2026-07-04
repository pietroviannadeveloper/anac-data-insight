import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className
      )}
    >
      {Icon && (
        <div className="relative mb-5 animate-empty-float">
          <div className="absolute inset-0 -m-3 rounded-full border border-dashed border-white/15" />
          <div className="w-14 h-14 bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center">
            <Icon className="w-7 h-7 text-blue-300/50" />
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-blue-200/50 max-w-xs">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-5 py-2 bg-white text-[#003A70] text-sm font-semibold rounded-lg hover:bg-blue-50 hover:-translate-y-px active:scale-[0.98] transition-all shadow-lg shadow-black/20"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
