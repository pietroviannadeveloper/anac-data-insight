export type AnalysisStatus = "pending" | "processing" | "completed" | "error";
export type SpreadsheetType = "ciclos" | "generic" | "pdf" | "unknown";
export type ActivityStatus = "realizado" | "agendado" | "sem-agendamento";
export type CriticalityLabel = "Regular" | "Atenção" | "Crítico" | "Muito crítico";

export interface Analysis {
  id: string;
  original_filename: string;
  file_type: "csv" | "xlsx" | "xls" | "pdf";
  detected_type: SpreadsheetType;
  status: AnalysisStatus;
  total_rows: number;
  total_columns: number;
  indicators?: Record<string, unknown>;
  description?: string;
  tags?: string[];
  parent_analysis_id?: string;
  version?: number;
  created_by?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface CicloIndicators {
  total_atividades: number;
  realizadas: number;
  agendadas: number;
  sem_agendamento: number;
  sem_giaso: number;
  sem_pcdp: number;
  sem_processo: number;
  locais_indefinidos: number;
  pcdp_duplicada: number;
  multiplas_pcdps: number;
  taxa_execucao: number;
  taxa_agendamento: number;
  pendencias_criticas: number;
}

export interface AIAnalysis {
  id: string;
  analysis_id: string;
  resumo_executivo: string;
  principais_achados: string[];
  riscos_operacionais: string[];
  recomendacoes: string[];
  plano_acao: Array<{
    prioridade: "Alta" | "Média" | "Baixa";
    acao: string;
    justificativa: string;
  }>;
  perguntas_sugeridas: string[];
  created_at: string;
}
