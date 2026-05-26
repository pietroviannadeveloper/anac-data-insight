from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class UploadResponse(BaseModel):
    id: str
    original_filename: str
    file_type: str
    size_bytes: int
    message: str


class AnalysisCreate(BaseModel):
    upload_id: str


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    detected_type: str
    status: str
    total_rows: int
    total_columns: int
    indicators: Optional[dict] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class PaginatedAnalysesResponse(BaseModel):
    items: list[AnalysisResponse]
    total: int
    page: int
    per_page: int


class PreviewResponse(BaseModel):
    columns: list[str]
    dtypes: list[str]
    rows: list[dict]
    total_rows: int
    total_columns: int


class AlertItem(BaseModel):
    type: str  # "error" | "warning" | "info"
    category: str
    message: str
    count: int


class AlertsResponse(BaseModel):
    alerts: list[AlertItem]
    total_critical: int


class TreatedDataRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    item: Optional[str] = None
    atividade: Optional[str] = None
    gerencia: Optional[str] = None
    setor: Optional[str] = None
    regulado: Optional[str] = None
    cidade: Optional[str] = None
    mes: Optional[str] = None
    mes_agendado: Optional[str] = None
    mes_realizado: Optional[str] = None
    giaso: Optional[str] = None
    processo: Optional[str] = None
    pcdp: Optional[str] = None
    prioridade: Optional[str] = None
    status: Optional[str] = None
    sem_giaso: int = 0
    sem_pcdp: int = 0
    sem_processo: int = 0
    local_indefinido: int = 0


class TreatedDataResponse(BaseModel):
    items: list[TreatedDataRow]
    total: int
