import { cn } from "@/lib/utils";

type Status = "realizado" | "agendado" | "sem-agendamento" | "critico" | "atencao";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; classes: string }> = {
  realizado: {
    label: "Realizado",
    classes: "bg-green-100 text-green-800 border-green-200",
  },
  agendado: {
    label: "Agendado",
    classes: "bg-blue-100 text-blue-800 border-blue-200",
  },
  "sem-agendamento": {
    label: "Sem Agendamento",
    classes: "bg-gray-100 text-gray-700 border-gray-200",
  },
  critico: {
    label: "Crítico",
    classes: "bg-red-100 text-red-800 border-red-200",
  },
  atencao: {
    label: "Atenção",
    classes: "bg-amber-100 text-amber-800 border-amber-200",
  },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}
