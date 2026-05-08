import logging
import os
import time
import unicodedata
from pathlib import Path

import pythoncom
import win32com.client

from config import PDF_OUTPUT_DIR, TEMPLATE_BASE_DIR

logger = logging.getLogger("worker.excel")

DEFAULT_MEASUREMENT_MODE_MAPPING = {
    "sheet_name": "Dados",
    "linked_cell": "Z9",
    "linked_values": {
        "ponto_fixo": 1,
        "multipontos": 2,
        "faixa_variavel": 3,
    },
    "button_captions": {
        "ponto_fixo": "Ponto fixo",
        "multipontos": "Multipontos",
        "faixa_variavel": "Faixa variavel",
    },
    "field_cells": {
        "ponto_fixo": {
            "capacidade": "U12",
            "unidade_medicao": "W12",
            "menor_divisao": "R13",
        },
        "multipontos": {
            "faixa_inicial": "R12",
            "faixa_final": "U12",
            "unidade_medicao": "W12",
            "menor_divisao": "R13",
        },
        "faixa_variavel": {
            "capacidade_maxima": "U12",
            "unidade_medicao": "W12",
        },
    },
}

DEFAULT_FINALIZATION_CONFIG = {
    "next_macro_name": "Próximo",
    "format_macro_name": "Formcert",
    "max_navigation_steps": 12,
    "macro_wait_seconds": 0.8,
    "post_navigation_wait_seconds": 1.5,
}


class ExcelHandler:
    """
    Handles Excel automation via win32com.

    The worker writes input data to the configured input sheet, lets Excel
    recalculate the workbook, optionally runs formatting macros and exports
    the configured output sheet as PDF.
    """

    def __init__(self):
        self.excel = None
        self.workbook = None

    def _resolve_sheet_and_cell(self, reference, default_sheet):
        if "!" in reference:
            sheet_name, cell_ref = reference.split("!", 1)
            return sheet_name, cell_ref
        return default_sheet, reference

    def _parse_excel_number(self, value):
        normalized = self._normalize_value(value)
        if normalized is None or isinstance(normalized, (int, float)):
            return normalized

        if not isinstance(normalized, str):
            return normalized

        candidate = normalized.strip().replace(" ", "")
        if not candidate:
            return normalized

        if "," in candidate and "." in candidate:
            if candidate.rfind(",") > candidate.rfind("."):
                candidate = candidate.replace(".", "").replace(",", ".")
            else:
                candidate = candidate.replace(",", "")
        elif "," in candidate:
            candidate = candidate.replace(",", ".")

        try:
            return float(candidate)
        except ValueError:
            return normalized

    def _run_macro_if_exists(self, macro_name):
        try:
            self.excel.Run(f"'{self.workbook.Name}'!{macro_name}")
            logger.info("  macro executada: %s", macro_name)
            return True
        except Exception as exc:
            logger.warning("  macro nao executada (%s): %s", macro_name, exc)
            return False

    def _resolve_template_path(self, template_path, default_config):
        raw_path = Path(template_path)
        if raw_path.is_absolute() and raw_path.exists():
            return str(raw_path)

        candidates = []
        base_dir = default_config.get("template_base_dir") or TEMPLATE_BASE_DIR
        if base_dir:
            candidates.append(Path(base_dir) / template_path)

        candidates.append(Path(template_path))

        worker_dir = Path(__file__).resolve().parent
        for candidate in list(candidates):
            candidates.append(worker_dir / candidate)
            candidates.append(worker_dir.parent / candidate)

        for candidate in candidates:
            resolved = candidate.resolve()
            if resolved.exists():
                return str(resolved)

        return str(raw_path)

    def _normalize_value(self, value):
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped if stripped != "" else None
        return value

    def _normalize_text(self, value):
        return (
            unicodedata.normalize("NFD", str(value or ""))
            .encode("ascii", "ignore")
            .decode("ascii")
            .strip()
            .lower()
        )

    def _normalize_validation_lookup_key(self, value):
        normalized = self._normalize_value(value)
        if normalized is None:
            return ""

        text = str(normalized).strip().lower()
        for source, target in (
            ("\u00B5", "u"),
            ("\u03BC", "u"),
            ("\u00B3", "3"),
            ("Â", ""),
            ("â", ""),
            ("Ã", ""),
            (" ", ""),
            ("_", ""),
        ):
            text = text.replace(source, target)

        return (
            unicodedata.normalize("NFD", text)
            .encode("ascii", "ignore")
            .decode("ascii")
            .strip()
            .lower()
        )

    def _normalize_measurement_unit_value(self, value):
        normalized = self._normalize_value(value)
        if normalized is None:
            return None

        aliases = {
            "ul": "µL",
            "l": "L",
            "dl": "dL",
            "cl": "cL",
            "ml": "mL",
            "dm3": "dm³",
            "cm3": "cm³",
            "mm3": "mm³",
        }

        lookup_key = self._normalize_validation_lookup_key(normalized)
        return aliases.get(lookup_key, normalized)

    def _resolve_validation_options(self, sheet_name, cell_ref):
        try:
            cell = self.workbook.Sheets(sheet_name).Range(cell_ref)
            formula = str(cell.Validation.Formula1 or "").strip()
        except Exception:
            return []

        if not formula.startswith("="):
            return []

        formula = formula[1:]
        target_sheet = self.workbook.Sheets(sheet_name)

        try:
            source_range = target_sheet.Range(formula)
            options = []
            for item in source_range.Cells:
                text = str(item.Text or "").strip()
                if text:
                    options.append(text)
            return options
        except Exception:
            return []

    def _coerce_value_for_validated_cell(self, sheet_name, cell_ref, value):
        normalized = self._normalize_value(value)
        if normalized is None or not isinstance(normalized, str):
            return normalized, normalized

        options = self._resolve_validation_options(sheet_name, cell_ref)
        if not options:
            return normalized, normalized

        target_key = self._normalize_validation_lookup_key(normalized)
        for option in options:
            option_key = self._normalize_validation_lookup_key(option)
            if option_key == target_key:
                return option, normalized

        return normalized, normalized

    def _write_cell(self, sheet_name, cell_ref, value):
        normalized = self._normalize_value(value)
        if normalized is None:
            return

        normalized, original_normalized = self._coerce_value_for_validated_cell(
            sheet_name,
            cell_ref,
            normalized,
        )

        if original_normalized != normalized:
            logger.info(
                "  valor validado ajustado para lista do Excel em %s!%s: recebido=%s resolvido=%s",
                sheet_name,
                cell_ref,
                original_normalized,
                normalized,
            )

        logger.info("  %s!%s = %s", sheet_name, cell_ref, normalized)
        self.workbook.Sheets(sheet_name).Range(cell_ref).Value = normalized

    def _clear_cell(self, sheet_name, cell_ref):
        if not cell_ref:
            return
        logger.info("  limpando %s!%s", sheet_name, cell_ref)
        self.workbook.Sheets(sheet_name).Range(cell_ref).Value = ""

    def _set_option_button(self, sheet_name, button_caption):
        if not button_caption:
            return False

        target = self._normalize_text(button_caption)
        sheet = self.workbook.Sheets(sheet_name)

        try:
            for ole_object in sheet.OLEObjects():
                try:
                    caption = getattr(ole_object.Object, "Caption", "")
                    if self._normalize_text(caption) == target:
                        ole_object.Object.Value = True
                        logger.info("  opcao selecionada via OLEObject: %s", button_caption)
                        return True
                except Exception:
                    continue
        except Exception:
            pass

        try:
            for shape in sheet.Shapes:
                try:
                    caption = shape.TextFrame.Characters().Text
                    if self._normalize_text(caption) == target:
                        shape.ControlFormat.Value = 1
                        logger.info("  opcao selecionada via Shape: %s", button_caption)
                        return True
                except Exception:
                    continue
        except Exception:
            pass

        logger.warning("  opcao nao encontrada na planilha: %s", button_caption)
        return False

    def _apply_measurement_mode(self, extra_fields, default_config):
        mode = extra_fields.get("tipo_faixa")
        if not mode:
            logger.info("Nenhum tipo_faixa informado; pulando bloco de modo de medicao")
            return

        mapping = default_config.get("measurement_mode_mapping") or {}
        if not mapping:
            logger.warning(
                "measurement_mode_mapping ausente no template; usando fallback padrao do worker"
            )
            mapping = DEFAULT_MEASUREMENT_MODE_MAPPING

        sheet_name = mapping.get("sheet_name") or default_config.get("input_sheet") or "Dados"
        button_captions = (
            mapping.get("button_captions")
            or DEFAULT_MEASUREMENT_MODE_MAPPING["button_captions"]
        )
        linked_cell = mapping.get("linked_cell")
        linked_values = mapping.get("linked_values") or {}
        field_cells = mapping.get("field_cells") or DEFAULT_MEASUREMENT_MODE_MAPPING["field_cells"]

        linked_value = linked_values.get(mode)
        if linked_cell and linked_value is not None:
            self._write_cell(sheet_name, linked_cell, linked_value)
            logger.info(
                "  modo de medicao definido via celula vinculada: %s!%s = %s",
                sheet_name,
                linked_cell,
                linked_value,
            )
        else:
            logger.info(
                "  modo de medicao sem linked_cell; tentando selecionar radio button '%s'",
                button_captions.get(mode),
            )
            self._set_option_button(sheet_name, button_captions.get(mode))

        all_mode_cells = set()
        for mode_fields in field_cells.values():
            if isinstance(mode_fields, dict):
                all_mode_cells.update(cell_ref for cell_ref in mode_fields.values() if cell_ref)

        for cell_ref in all_mode_cells:
            self._clear_cell(sheet_name, cell_ref)

        active_mode_fields = field_cells.get(mode) or {}
        for field_key, cell_ref in active_mode_fields.items():
            value = extra_fields.get(field_key)
            if field_key == "unidade_medicao":
                value = self._normalize_measurement_unit_value(value)
            self._write_cell(sheet_name, cell_ref, value)

    def _build_results_sheet_sequence(self, mapping, fallback_sheet_name):
        pattern = mapping.get("sheet_name_pattern")
        max_sheets = int(mapping.get("max_sheets") or 12)

        if pattern:
            return [pattern.format(sheet_number=index) for index in range(1, max_sheets + 1)]

        if fallback_sheet_name:
            return [fallback_sheet_name]

        return []

    def _wait_for_excel_settle(self, seconds=0.8):
        deadline = time.time() + max(seconds, 0)
        while time.time() < deadline:
            try:
                if self.excel.CalculationState == 0:
                    break
            except Exception:
                break
            time.sleep(0.1)

        remaining = deadline - time.time()
        if remaining > 0:
            time.sleep(remaining)

    def _move_from_input_to_results(self, default_config, input_sheet_name, fallback_results_sheet):
        finalization = dict(DEFAULT_FINALIZATION_CONFIG)
        finalization.update(default_config.get("finalization") or {})
        next_macro_name = finalization.get("next_macro_name") or "Próximo"
        macro_wait_seconds = float(finalization.get("macro_wait_seconds") or 0.8)

        try:
            self.workbook.Sheets(input_sheet_name).Activate()
            logger.info("Preparando transicao da aba %s para os resultados", input_sheet_name)
            self._wait_for_excel_settle(macro_wait_seconds)
        except Exception as exc:
            logger.warning(
                "Nao foi possivel ativar a aba de entrada %s antes dos resultados: %s",
                input_sheet_name,
                exc,
            )

        if self._run_macro_if_exists(next_macro_name):
            self.excel.CalculateFullRebuild()
            self._wait_for_excel_settle(macro_wait_seconds)

        try:
            active_sheet_name = self.excel.ActiveSheet.Name
        except Exception:
            active_sheet_name = None

        logger.info("Aba ativa apos acionar resultados: %s", active_sheet_name or "<desconhecida>")

        if fallback_results_sheet and active_sheet_name != fallback_results_sheet:
            try:
                self.workbook.Sheets(fallback_results_sheet).Activate()
                logger.info(
                    "Ativando manualmente a primeira aba de resultados %s",
                    fallback_results_sheet,
                )
                self._wait_for_excel_settle(macro_wait_seconds)
            except Exception as exc:
                logger.warning(
                    "Nao foi possivel ativar a aba de resultados %s: %s",
                    fallback_results_sheet,
                    exc,
                )

    def _navigate_results_to_output(self, default_config, output_sheet_name):
        mapping = default_config.get("results_mapping") or {}
        finalization = dict(DEFAULT_FINALIZATION_CONFIG)
        finalization.update(default_config.get("finalization") or {})

        next_macro_name = finalization.get("next_macro_name") or "Próximo"
        format_macro_name = finalization.get("format_macro_name") or "Formcert"
        max_steps = int(finalization.get("max_navigation_steps") or 12)
        macro_wait_seconds = float(finalization.get("macro_wait_seconds") or 0.8)
        post_navigation_wait_seconds = float(
            finalization.get("post_navigation_wait_seconds") or 1.5
        )

        fallback_sheet_name = default_config.get("points_sheet", "Resultados - 1")
        sheet_sequence = self._build_results_sheet_sequence(mapping, fallback_sheet_name)
        available_sheets = {sheet.Name for sheet in self.workbook.Worksheets}
        result_sheets = [
            sheet_name for sheet_name in sheet_sequence if sheet_name in available_sheets
        ]

        if result_sheets:
            start_sheet_name = result_sheets[0]
            try:
                self.workbook.Sheets(start_sheet_name).Activate()
                logger.info("Iniciando finalizacao a partir da aba %s", start_sheet_name)
                self._wait_for_excel_settle(macro_wait_seconds)
            except Exception as exc:
                logger.warning(
                    "Nao foi possivel ativar a aba inicial de resultados (%s): %s",
                    start_sheet_name,
                    exc,
                )

        for step in range(1, max_steps + 1):
            try:
                active_sheet_name = self.excel.ActiveSheet.Name
            except Exception:
                active_sheet_name = None

            if active_sheet_name == output_sheet_name:
                logger.info(
                    "Aba de saida %s alcancada apos %s passo(s)",
                    output_sheet_name,
                    step - 1,
                )
                break

            if not self._run_macro_if_exists(next_macro_name):
                break

            self.excel.CalculateFullRebuild()
            self._wait_for_excel_settle(macro_wait_seconds)
        else:
            logger.warning(
                "Limite de navegacao atingido sem chegar na aba de saida %s",
                output_sheet_name,
            )

        try:
            active_sheet_name = self.excel.ActiveSheet.Name
        except Exception:
            active_sheet_name = None

        reached_output_sheet = active_sheet_name == output_sheet_name

        if active_sheet_name != output_sheet_name:
            try:
                self.workbook.Sheets(output_sheet_name).Activate()
                logger.info("Ativando manualmente a aba de saida %s", output_sheet_name)
            except Exception as exc:
                logger.warning(
                    "Nao foi possivel ativar a aba de saida %s: %s",
                    output_sheet_name,
                    exc,
                )

        try:
            active_sheet_name = self.excel.ActiveSheet.Name
        except Exception:
            active_sheet_name = None

        if not reached_output_sheet and active_sheet_name == output_sheet_name and format_macro_name:
            logger.info(
                "Executando %s como contingencia apos ativacao manual da aba %s",
                format_macro_name,
                output_sheet_name,
            )
            self._run_macro_if_exists(format_macro_name)

        self.excel.CalculateFullRebuild()
        self._wait_for_excel_settle(post_navigation_wait_seconds)

    def _normalize_result_channels(self, extra_fields):
        channels = extra_fields.get("canais_calibracao") or []
        if channels:
            return channels

        points = extra_fields.get("pontos_calibracao") or []
        if not points:
            return []

        grouped = {}
        for point in points:
            channel_number = int(point.get("channel_number") or 1)
            if channel_number not in grouped:
                grouped[channel_number] = {
                    "channel_number": channel_number,
                    "identificacao_canal": point.get("identificacao_canal", ""),
                    "observacao": point.get("channel_observacao")
                    or point.get("observacao")
                    or "",
                    "points": [],
                }

            point_payload = dict(point)
            point_payload.pop("identificacao_canal", None)
            point_payload.pop("channel_observacao", None)
            grouped[channel_number]["points"].append(point_payload)

        return [grouped[key] for key in sorted(grouped.keys())]

    def _fill_result_points(self, channels_data, default_config):
        if not channels_data:
            return

        mapping = default_config.get("results_mapping") or {}
        if not mapping:
            logger.info(
                "Nenhum results_mapping configurado; pulando preenchimento dos blocos de resultados"
            )
            return

        fallback_sheet_name = default_config.get("points_sheet", "Resultados - 1")
        sheet_sequence = self._build_results_sheet_sequence(mapping, fallback_sheet_name)
        available_sheets = {sheet.Name for sheet in self.workbook.Worksheets}

        sheet_sequence = [
            sheet_name for sheet_name in sheet_sequence if sheet_name in available_sheets
        ]
        if not sheet_sequence:
            logger.warning("Nenhuma aba de resultados encontrada para o mapeamento configurado")
            return

        blocks_per_sheet = int(mapping.get("point_blocks_per_sheet") or 7)
        start_row = int(mapping.get("point_block_start_row") or 12)
        row_step = int(mapping.get("point_block_row_step") or 21)
        measurement_start_offset = int(mapping.get("measurement_row_start_offset") or 6)
        measurement_count = int(mapping.get("measurement_count") or 10)
        header_fields = mapping.get("sheet_header_fields") or {}
        point_fields = mapping.get("point_fields") or {}
        measurement_fields = mapping.get("measurement_fields") or {}
        numeric_point_fields = {"valor_nominal", "menor_divisao"}
        numeric_measurement_fields = {"massa_aparente", "temperatura_fluido"}
        criterio_cliente_key = self._normalize_text("Cliente")

        for channel_index, channel in enumerate(channels_data):
            if channel_index >= len(sheet_sequence):
                logger.warning(
                    "Canal %s excede a quantidade de abas de resultado configuradas; restante sera ignorado",
                    channel_index + 1,
                )
                break

            sheet_name = sheet_sequence[channel_index]

            for source_key, cell_ref in header_fields.items():
                self._write_cell(sheet_name, cell_ref, channel.get(source_key))

            points = channel.get("points") or []
            for point_index, point in enumerate(points):
                if point_index >= blocks_per_sheet:
                    logger.warning(
                        "Canal %s possui mais pontos do que o limite configurado por aba; excedente sera ignorado",
                        channel_index + 1,
                    )
                    break

                block_base_row = start_row + (point_index * row_step)

                for source_key, field_config in point_fields.items():
                    if not isinstance(field_config, dict):
                        continue

                    column = field_config.get("column")
                    row_offset = int(field_config.get("row_offset") or 0)
                    if not column:
                        continue

                    cell_ref = f"{column}{block_base_row + row_offset}"
                    value = point.get(source_key)
                    if source_key in numeric_point_fields:
                        value = self._parse_excel_number(value)
                    self._write_cell(sheet_name, cell_ref, value)

                criterio_nbr = self._normalize_text(point.get("criterio_nbr"))
                if criterio_nbr != criterio_cliente_key:
                    criterio_cliente_valor = point_fields.get("criterio_cliente_valor") or {}
                    criterio_cliente_unidade = point_fields.get("criterio_cliente_unidade") or {}

                    if criterio_cliente_valor.get("column"):
                        self._clear_cell(
                            sheet_name,
                            f"{criterio_cliente_valor.get('column')}{block_base_row + int(criterio_cliente_valor.get('row_offset') or 0)}",
                        )
                    if criterio_cliente_unidade.get("column"):
                        self._clear_cell(
                            sheet_name,
                            f"{criterio_cliente_unidade.get('column')}{block_base_row + int(criterio_cliente_unidade.get('row_offset') or 0)}",
                        )

                masses = point.get("massas") or []
                for measurement_index, measurement in enumerate(
                    masses[:measurement_count]
                ):
                    target_row = block_base_row + measurement_start_offset + measurement_index
                    for source_key, field_config in measurement_fields.items():
                        if not isinstance(field_config, dict):
                            continue

                        column = field_config.get("column")
                        if not column:
                            continue

                        cell_ref = f"{column}{target_row}"
                        value = measurement.get(source_key)
                        if source_key in numeric_measurement_fields:
                            value = self._parse_excel_number(value)
                        self._write_cell(sheet_name, cell_ref, value)

    def _apply_uncertainty_workarounds(self):
        # As abas de incerteza deste workbook sao protegidas com senha.
        # Qualquer tentativa de desprotecao/escrita nelas faz o Excel abrir
        # prompt interativo e interrompe a automacao. Mantemos este passo
        # como no-op para nao disparar a solicitacao de senha.
        logger.info(
            "Workaround de incerteza desativado: abas protegidas com senha no workbook"
        )

    def _resolve_pdf_print_area(self, output_sheet, output_sheet_name, default_config, initial_print_area):
        configured_area = (
            (default_config.get("pdf_export") or {}).get("print_area")
            or default_config.get("pdf_print_area")
        )
        if configured_area:
            return configured_area

        normalized_sheet_name = self._normalize_text(output_sheet_name)
        if normalized_sheet_name != "certificado":
            return initial_print_area

        # A aba Certificado carrega uma area tecnica a direita/abaixo do
        # certificado visivel. O recorte util do documento fica em A:V.
        last_visible_row = 1
        for row_number in range(1, 260):
            try:
                if output_sheet.Rows(row_number).Hidden:
                    continue
            except Exception:
                pass

            has_visible_content = False
            for column_number in range(1, 23):
                try:
                    text = str(output_sheet.Cells(row_number, column_number).Text or "").strip()
                except Exception:
                    text = ""
                if text:
                    has_visible_content = True
                    break

            if has_visible_content:
                last_visible_row = row_number

        clipped_area = f"$A$1:$V${last_visible_row}"
        logger.info(
            "Area de impressao ajustada dinamicamente para a aba %s: %s",
            output_sheet_name,
            clipped_area,
        )
        return clipped_area

    def _export_output_sheet_to_pdf(
        self,
        output_sheet,
        output_sheet_name,
        pdf_path,
        initial_print_area,
        default_config,
    ):
        try:
            output_sheet.Activate()
            output_sheet.Select()
        except Exception:
            pass

        export_print_area = self._resolve_pdf_print_area(
            output_sheet,
            output_sheet_name,
            default_config,
            initial_print_area,
        )

        try:
            current_print_area = output_sheet.PageSetup.PrintArea
            if export_print_area:
                output_sheet.PageSetup.PrintArea = export_print_area
                current_print_area = export_print_area

            output_sheet.PageSetup.Zoom = False
            output_sheet.PageSetup.FitToPagesWide = 1
            output_sheet.PageSetup.FitToPagesTall = 1

            logger.info(
                "Area de impressao da aba %s para exportacao: %s",
                output_sheet_name,
                current_print_area,
            )
        except Exception:
            logger.info(
                "Nao foi possivel ajustar a area de impressao da aba %s",
                output_sheet_name,
            )

        output_sheet.ExportAsFixedFormat(
            Type=0,
            Filename=os.path.abspath(pdf_path),
            Quality=0,
            IncludeDocProperties=True,
            IgnorePrintAreas=False,
            OpenAfterPublish=False,
        )

    def process(self, certificate, template):
        pythoncom.CoInitialize()
        try:
            default_config = template.get("default_config") or {}
            template_path = self._resolve_template_path(
                template.get("excel_template_path", ""),
                default_config,
            )
            if not template_path or not os.path.exists(template_path):
                raise FileNotFoundError(f"Template Excel nao encontrado: {template_path}")

            cert_number = certificate["certificate_number"]
            work_dir = os.path.join(PDF_OUTPUT_DIR, cert_number)
            os.makedirs(work_dir, exist_ok=True)

            logger.info("Abrindo Excel para %s", cert_number)
            self.excel = win32com.client.Dispatch("Excel.Application")
            self.excel.Visible = False
            self.excel.DisplayAlerts = False
            self.excel.WindowState = -4137
            self.excel.AutomationSecurity = 1

            self.workbook = self.excel.Workbooks.Open(
                os.path.abspath(template_path),
                UpdateLinks=3,
                ReadOnly=True,
                IgnoreReadOnlyRecommended=True,
            )

            try:
                link_sources = self.workbook.LinkSources()
                if link_sources:
                    self.workbook.UpdateLink(
                        Name=link_sources,
                        Type=1,
                    )
                    logger.info("Vinculos externos atualizados com sucesso")
                    self.excel.CalculateFullRebuild()
                    self._wait_for_excel_settle(2.0)
                else:
                    logger.info("Nenhum vinculo externo encontrado para atualizar")
            except Exception as exc:
                logger.warning("Nao foi possivel atualizar vinculos externos: %s", exc)

            try:
                self.excel.AutomationSecurity = 2
            except Exception:
                pass

            try:
                self.workbook.Windows(1).WindowState = -4137
            except Exception:
                pass

            input_sheet_name = default_config.get("input_sheet")
            output_sheet_name = default_config.get("output_sheet")
            points_sheet_name = default_config.get("points_sheet", "Resultados - 1")
            post_fill_macros = default_config.get("post_fill_macros", [])

            if not input_sheet_name and any(
                sheet.Name == "Dados" for sheet in self.workbook.Worksheets
            ):
                input_sheet_name = "Dados"
            if not output_sheet_name and any(
                sheet.Name == "Certificado" for sheet in self.workbook.Worksheets
            ):
                output_sheet_name = "Certificado"

            input_sheet_name = input_sheet_name or self.workbook.Sheets(1).Name
            output_sheet_name = output_sheet_name or input_sheet_name

            output_sheet = self.workbook.Sheets(output_sheet_name)
            initial_print_area = None
            try:
                initial_print_area = output_sheet.PageSetup.PrintArea
            except Exception:
                initial_print_area = None

            field_mappings = {
                field["field_key"]: field["excel_cell_ref"]
                for field in template.get("fields", [])
                if field.get("excel_cell_ref")
            }

            cert_fields = {
                "certificate_number": certificate.get("certificate_number"),
                "instrument_tag": certificate.get("instrument_tag"),
                "instrument_description": certificate.get("instrument_description"),
                "manufacturer": certificate.get("manufacturer"),
                "model": certificate.get("model"),
                "serial_number": certificate.get("serial_number"),
                "range_min": certificate.get("range_min"),
                "range_max": certificate.get("range_max"),
                "unit": certificate.get("unit"),
                "calibration_date": certificate.get("calibration_date"),
            }

            for key, value in cert_fields.items():
                if value and key in field_mappings:
                    reference = field_mappings[key]
                    sheet_name, cell_ref = self._resolve_sheet_and_cell(
                        reference, input_sheet_name
                    )
                    logger.info("  %s -> %s!%s = %s", key, sheet_name, cell_ref, value)
                    self._write_cell(sheet_name, cell_ref, value)

            extra = certificate.get("extra_fields", {}) or {}
            self._apply_measurement_mode(extra, default_config)

            for key, value in extra.items():
                if key not in field_mappings:
                    continue
                if isinstance(value, (dict, list)):
                    continue

                reference = field_mappings[key]
                sheet_name, cell_ref = self._resolve_sheet_and_cell(
                    reference, input_sheet_name
                )
                logger.info("  extra.%s -> %s!%s = %s", key, sheet_name, cell_ref, value)
                self._write_cell(sheet_name, cell_ref, value)

            self.excel.CalculateFullRebuild()
            self._wait_for_excel_settle()
            self._move_from_input_to_results(
                default_config,
                input_sheet_name,
                points_sheet_name,
            )

            result_channels = self._normalize_result_channels(extra)
            self._fill_result_points(result_channels, default_config)
            self._apply_uncertainty_workarounds()

            points = certificate.get("points", []) or []
            if points and any(
                sheet.Name == points_sheet_name for sheet in self.workbook.Worksheets
            ):
                points_sheet = self.workbook.Sheets(points_sheet_name)
                for point in points:
                    row_ref = point.get("excel_row_ref")
                    if not row_ref:
                        continue

                    if point.get("nominal_value") is not None:
                        points_sheet.Range(f"B{row_ref}").Value = float(
                            point["nominal_value"]
                        )
                    if point.get("measured_value") is not None:
                        points_sheet.Range(f"C{row_ref}").Value = float(
                            point["measured_value"]
                        )
                    if point.get("error_value") is not None:
                        points_sheet.Range(f"D{row_ref}").Value = float(point["error_value"])
                    if point.get("uncertainty") is not None:
                        points_sheet.Range(f"E{row_ref}").Value = float(point["uncertainty"])

            self.excel.CalculateFullRebuild()
            self._wait_for_excel_settle()
            self._navigate_results_to_output(default_config, output_sheet_name)

            skipped_formcert = False
            for macro_name in post_fill_macros:
                if self._normalize_text(macro_name) == self._normalize_text("Formcert"):
                    skipped_formcert = True
                    continue
                self._run_macro_if_exists(macro_name)

            if skipped_formcert:
                logger.info("  macro Formcert ja foi executada no fluxo de finalizacao")

            pdf_path = os.path.join(work_dir, f"{cert_number}.pdf")
            self._export_output_sheet_to_pdf(
                output_sheet,
                output_sheet_name,
                pdf_path,
                initial_print_area,
                default_config,
            )

            logger.info("PDF gerado: %s", pdf_path)
            return pdf_path
        finally:
            self._cleanup()
            pythoncom.CoUninitialize()

    def _cleanup(self):
        try:
            if self.workbook:
                self.workbook.Close(SaveChanges=False)
        except Exception:
            pass

        try:
            if self.excel:
                self.excel.Quit()
        except Exception:
            pass

        self.workbook = None
        self.excel = None

        try:
            os.system("taskkill /f /im EXCEL.EXE 2>nul")
        except Exception:
            pass
