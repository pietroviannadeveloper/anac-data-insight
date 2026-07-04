import { FileEdit, Eye, CheckCircle2, XCircle, Archive } from "lucide-react";
import { ApprovalStatus } from "@/types/analysis";

interface ApprovalBadgeProps {
  status: ApprovalStatus;
  className?: string;
}

const CONFIG: Record<ApprovalStatus, { label: string; icon: React.ElementType; cls: string }> = {
  rascunho:      { label: "Rascunho",     icon: FileEdit,     cls: "text-blue-200/70 bg-white/5 border-white/10" },
  em_validacao:  { label: "Em validação", icon: Eye,          cls: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20" },
  aprovado:      { label: "Aprovado",     icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  rejeitado:     { label: "Rejeitado",    icon: XCircle,      cls: "text-red-400 bg-red-400/10 border-red-400/20" },
  arquivado:     { label: "Arquivado",    icon: Archive,      cls: "text-white/30 bg-white/5 border-white/10" },
};

export default function ApprovalBadge({ status, className }: ApprovalBadgeProps) {
  const cfg = CONFIG[status] ?? CONFIG.rascunho;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls} ${className ?? ""}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}
