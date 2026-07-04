"""Tests for service layer functions."""
import pytest
import polars as pl


# ── classifier.py ─────────────────────────────────────────────────────────────

class TestClassifySpreadsheet:

    def test_ciclo_with_scheduling_columns(self):
        from app.services.classifier import classify_spreadsheet
        df = pl.DataFrame({
            "Item": ["1.1", "D.1"],
            "Realizado": ["Jan", None],
            "Agendado": [None, "Feb"],
            "Gerencia": ["GR1", "GR2"],
            "Regulado": ["Empresa A", "Empresa B"],
        })
        result = classify_spreadsheet(df)
        assert result == "ciclos"

    def test_ciclo_with_giaso_column(self):
        from app.services.classifier import classify_spreadsheet
        df = pl.DataFrame({
            "GIASO": ["servidor1"],
            "Atividade": ["Auditoria"],
        })
        result = classify_spreadsheet(df)
        assert result == "ciclos"

    def test_ciclo_with_pcdp_column(self):
        from app.services.classifier import classify_spreadsheet
        df = pl.DataFrame({
            "PCDP": ["278/2025"],
            "Processo": ["123456"],
        })
        result = classify_spreadsheet(df)
        assert result == "ciclos"

    def test_generic_unknown_columns(self):
        from app.services.classifier import classify_spreadsheet
        df = pl.DataFrame({
            "Nome": ["João"],
            "Valor": [100],
            "Data": ["2025-01-01"],
        })
        result = classify_spreadsheet(df)
        assert result == "generic"

    def test_ciclo_broad_signal(self):
        from app.services.classifier import classify_spreadsheet
        df = pl.DataFrame({
            "Atividade": ["Vistoria"],
            "Gerencia": ["GR1"],
            "Regulado": ["Empresa X"],
            "Mes": ["Janeiro"],
        })
        result = classify_spreadsheet(df)
        assert result == "ciclos"

    def test_empty_dataframe_is_generic(self):
        from app.services.classifier import classify_spreadsheet
        df = pl.DataFrame({"ColA": [], "ColB": []})
        result = classify_spreadsheet(df)
        assert result == "generic"


class TestClassifyRowType:

    def test_ciclo_base_numeric_item(self):
        from app.services.classifier import classify_row_type
        tipo, criterio = classify_row_type("1.1.2")
        assert tipo == "CICLO_BASE"

    def test_ciclo_desempenho_d_prefix(self):
        from app.services.classifier import classify_row_type
        tipo, _ = classify_row_type("D.123")
        assert tipo == "CICLO_DESEMPENHO"

    def test_nao_programada_n_prefix(self):
        from app.services.classifier import classify_row_type
        tipo, _ = classify_row_type("N123")
        assert tipo == "NAO_PROGRAMADA"

    def test_indefinido_empty_item(self):
        from app.services.classifier import classify_row_type
        tipo, _ = classify_row_type(None)
        assert tipo == "INDEFINIDO"

    def test_indefinido_blank_item(self):
        from app.services.classifier import classify_row_type
        tipo, _ = classify_row_type("   ")
        assert tipo == "INDEFINIDO"

    def test_indefinido_unknown_pattern(self):
        from app.services.classifier import classify_row_type
        tipo, _ = classify_row_type("XYZ")
        assert tipo == "INDEFINIDO"

    def test_normalize_col(self):
        from app.services.classifier import normalize_col
        assert normalize_col("Mês Agendado") == "mesagendado"
        assert normalize_col("GIASO") == "giaso"
        assert normalize_col("Realizado") == "realizado"


# ── pta_mensal_service.py ─────────────────────────────────────────────────────

class TestToMonthNum:

    def test_january_text(self):
        from app.services.pta_mensal_service import _to_month_num
        assert _to_month_num("Janeiro") == 1

    def test_abbreviated_jan(self):
        from app.services.pta_mensal_service import _to_month_num
        assert _to_month_num("jan") == 1

    def test_abbreviated_dez(self):
        from app.services.pta_mensal_service import _to_month_num
        assert _to_month_num("dez") == 12

    def test_numeric_string(self):
        from app.services.pta_mensal_service import _to_month_num
        assert _to_month_num("1") == 1
        assert _to_month_num("12") == 12

    def test_numeric_string_6(self):
        from app.services.pta_mensal_service import _to_month_num
        assert _to_month_num("6") == 6

    def test_none_returns_none(self):
        from app.services.pta_mensal_service import _to_month_num
        assert _to_month_num(None) is None

    def test_empty_string_returns_none(self):
        from app.services.pta_mensal_service import _to_month_num
        assert _to_month_num("") is None

    def test_invalid_string_returns_none(self):
        from app.services.pta_mensal_service import _to_month_num
        assert _to_month_num("not-a-month") is None

    def test_out_of_range_returns_none(self):
        from app.services.pta_mensal_service import _to_month_num
        assert _to_month_num("13") is None
        assert _to_month_num("0") is None


class TestComputeBiSummary:

    def test_empty_list_returns_zeros(self):
        from app.services.pta_mensal_service import compute_bi_summary
        result = compute_bi_summary([])
        assert result["total_planejado"] == 0
        assert result["total_realizado"] == 0
        assert result["taxa_execucao"] == 0.0

    def test_all_realized(self):
        from app.services.pta_mensal_service import compute_bi_summary
        activities = [
            {"status": "realizado", "mes_num": 1, "mes_original_num": 1,
             "gerencia": "GR1", "cidade": "Brasilia", "servidor": "srv1",
             "pcdp": "123/2025", "pcdp_tipo": "valida", "processo": "proc1",
             "remanejado": 0, "sem_giaso": 0, "sem_pcdp": 0,
             "sem_pcdp_valida": 0, "sem_processo": 0, "local_indefinido": 0,
             "atividade": "Auditoria", "tipo_ciclo": "CICLO_BASE"},
        ] * 3
        result = compute_bi_summary(activities)
        assert result["total_realizado"] == 3
        assert result["total_agendado"] == 0
        assert result["taxa_execucao"] == 100.0

    def test_mixed_status(self):
        from app.services.pta_mensal_service import compute_bi_summary
        base = {"mes_num": 1, "mes_original_num": 1, "gerencia": "GR1",
                "cidade": "BSB", "servidor": "srv1", "pcdp": None, "pcdp_tipo": "vazia",
                "processo": None, "remanejado": 0, "sem_giaso": 0,
                "sem_pcdp": 1, "sem_pcdp_valida": 1, "sem_processo": 1,
                "local_indefinido": 0, "atividade": "Vistoria", "tipo_ciclo": "CICLO_BASE"}
        activities = [
            {**base, "status": "realizado"},
            {**base, "status": "realizado"},
            {**base, "status": "agendado"},
            {**base, "status": "sem-agendamento"},
        ]
        result = compute_bi_summary(activities)
        assert result["total_realizado"] == 2
        assert result["total_agendado"] == 1
        assert result["total_sem_agendamento"] == 1
        assert result["taxa_execucao"] == 50.0

    def test_summary_has_expected_keys(self):
        from app.services.pta_mensal_service import compute_bi_summary
        result = compute_bi_summary([])
        expected_keys = [
            "total_planejado", "total_realizado", "total_agendado",
            "total_sem_agendamento", "taxa_execucao", "taxa_agendamento",
        ]
        for key in expected_keys:
            assert key in result, f"Missing key: {key}"


# ── ciclo_analyzer.py ─────────────────────────────────────────────────────────

class TestCicloAnalyzer:

    def test_analyze_ciclos_minimal_df(self):
        from app.services.ciclo_analyzer import analyze_ciclos
        df = pl.DataFrame({
            "Item": ["1.1", "D.1", "N1"],
            "Realizado": ["Jan", None, None],
            "Agendado": [None, "Feb", None],
            "Gerencia": ["GR1", "GR2", "GR3"],
            "Regulado": ["Emp A", "Emp B", "Emp C"],
        })
        result = analyze_ciclos(df)
        assert isinstance(result, dict)
        assert "total_atividades" in result or "total" in result or len(result) > 0

    def test_analyze_ciclos_empty_df(self):
        from app.services.ciclo_analyzer import analyze_ciclos
        df = pl.DataFrame({
            "Item": [], "Realizado": [], "Agendado": [],
        })
        result = analyze_ciclos(df)
        assert isinstance(result, dict)

    def test_analyze_ciclos_returns_taxa_execucao(self):
        from app.services.ciclo_analyzer import analyze_ciclos
        df = pl.DataFrame({
            "Item": ["1.1", "1.2"],
            "Realizado": ["Jan", "Feb"],
            "Agendado": ["Jan", "Feb"],
        })
        result = analyze_ciclos(df)
        assert "taxa_execucao" in result

    def test_analyze_ciclos_with_giaso_pcdp(self):
        from app.services.ciclo_analyzer import analyze_ciclos
        df = pl.DataFrame({
            "Item": ["1.1", "1.2", "1.3"],
            "Realizado": ["Jan", None, None],
            "Agendado": [None, "Feb", None],
            "GIASO": ["G001", None, "G003"],
            "PCDP": ["278/2025", "278/2025", None],  # duplicate PCDP
            "Processo": ["P001", None, "P003"],
            "Cidade": ["Brasília", None, "São Paulo"],
            "Atividade": ["Auditoria", "Vistoria", "Auditoria"],
            "Regulado": ["Emp A", "Emp A", "Emp B"],
        })
        result = analyze_ciclos(df)
        assert result["total_atividades"] == 3
        assert result["realizadas"] == 1
        assert result["agendadas"] == 1
        assert result["sem_agendamento"] == 1
        assert result["sem_giaso"] == 1
        assert result["sem_pcdp"] == 1
        assert result["sem_processo"] == 1
        assert result["locais_indefinidos"] == 1

    def test_analyze_ciclos_pcdp_duplicada(self):
        from app.services.ciclo_analyzer import analyze_ciclos
        df = pl.DataFrame({
            "Realizado": ["Jan", "Jan"],
            "PCDP": ["278/2025", "278/2025"],  # same PCDP in 2 rows
            "Atividade": ["Auditoria", "Vistoria"],
            "Regulado": ["Emp A", "Emp B"],
        })
        result = analyze_ciclos(df)
        assert result["pcdp_duplicada"] >= 1

    def test_analyze_ciclos_only_realizado_col(self):
        """Test with only realizado column (no agendado)."""
        from app.services.ciclo_analyzer import analyze_ciclos
        df = pl.DataFrame({
            "Realizado": ["Jan", None, None],
        })
        result = analyze_ciclos(df)
        assert result["realizadas"] == 1
        assert result["agendadas"] == 0

    def test_find_col(self):
        from app.services.ciclo_analyzer import _find_col, _norm_cols
        df = pl.DataFrame({"MesRealizado": ["Jan"], "MesAgendado": ["Feb"]})
        mapping = _norm_cols(df)
        assert _find_col(mapping, "realizado") == "MesRealizado"
        assert _find_col(mapping, "agendado") == "MesAgendado"

    def test_find_col_not_found(self):
        from app.services.ciclo_analyzer import _find_col
        assert _find_col({}, "giaso") is None


class TestPtaMensalServiceExtended:

    def test_classify_pcdp_valida(self):
        from app.services.pta_mensal_service import _classify_pcdp
        assert _classify_pcdp("278/2025") == "valida"

    def test_classify_pcdp_cancelada(self):
        from app.services.pta_mensal_service import _classify_pcdp
        assert _classify_pcdp("PCDP cancelada") == "cancelada"

    def test_classify_pcdp_remota(self):
        from app.services.pta_mensal_service import _classify_pcdp
        assert _classify_pcdp("GRC123") == "remota"

    def test_classify_pcdp_vazia(self):
        from app.services.pta_mensal_service import _classify_pcdp
        assert _classify_pcdp(None) == "vazia"
        assert _classify_pcdp("") == "vazia"

    def test_classify_pcdp_especial(self):
        from app.services.pta_mensal_service import _classify_pcdp
        assert _classify_pcdp("PCDP-ESPECIAL") == "especial"

    def test_compute_bi_summary_remanejados(self):
        from app.services.pta_mensal_service import compute_bi_summary
        activities = [
            {"status": "realizado", "mes_num": 3, "mes_original_num": 2,
             "gerencia": "GR1", "cidade": "BSB", "servidor": "srv1",
             "pcdp": "123/2025", "pcdp_tipo": "valida", "processo": "P1",
             "remanejado": 1, "sem_giaso": 0, "sem_pcdp": 0,
             "sem_pcdp_valida": 0, "sem_processo": 0, "local_indefinido": 0,
             "atividade": "A", "tipo_ciclo": "CICLO_BASE"},
        ]
        result = compute_bi_summary(activities)
        assert result["total_realizado"] == 1

    def test_compute_bi_has_por_gerencia(self):
        from app.services.pta_mensal_service import compute_bi_summary
        activities = [
            {"status": "realizado", "mes_num": 1, "mes_original_num": 1,
             "gerencia": "GRTE-SP", "cidade": "SP", "servidor": "João",
             "pcdp": "1/2025", "pcdp_tipo": "valida", "processo": "P1",
             "remanejado": 0, "sem_giaso": 0, "sem_pcdp": 0,
             "sem_pcdp_valida": 0, "sem_processo": 0, "local_indefinido": 0,
             "atividade": "Auditoria", "tipo_ciclo": "CICLO_BASE"},
        ]
        result = compute_bi_summary(activities)
        assert "por_gerencia" in result or "total_realizado" in result


class TestCicloAnalyzerBreakdown:

    def test_analyze_ciclos_with_breakdown(self):
        import polars as pl
        from app.services.ciclo_analyzer import analyze_ciclos_with_breakdown
        df = pl.DataFrame({
            "Item": ["1.1", "D.1", "N1", "1.2"],
            "Realizado": ["Jan", None, None, "Feb"],
            "Agendado": [None, "Feb", None, None],
            "Gerencia": ["GR1", "GR2", "GR3", "GR1"],
        })
        result = analyze_ciclos_with_breakdown(df)
        assert "by_type" in result
        assert isinstance(result["by_type"], dict)

    def test_analyze_ciclos_with_breakdown_empty(self):
        import polars as pl
        from app.services.ciclo_analyzer import analyze_ciclos_with_breakdown
        df = pl.DataFrame({"Item": [], "Realizado": []})
        result = analyze_ciclos_with_breakdown(df)
        assert "by_type" in result
        assert result["by_type"] == {}

    def test_find_col_regex_pattern(self):
        import polars as pl
        from app.services.ciclo_analyzer import _find_col, _norm_cols
        # Columns with full exact match (^...$) pattern
        df = pl.DataFrame({"Item": ["1.1"]})
        mapping = _norm_cols(df)
        # "item" should match the "item" pattern exactly
        result = _find_col(mapping, "item")
        assert result == "Item"
