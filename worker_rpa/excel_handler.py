import logging
import os
import shutil
from pathlib import Path

import pythoncom
import win32com.client

from config import PDF_OUTPUT_DIR, TEMPLATE_BASE_DIR

logger = logging.getLogger("worker.excel")


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

    def _run_macro_if_exists(self, macro_name):
        try:
            self.excel.Run(f"'{self.workbook.Name}'!{macro_name}")
            logger.info("  macro executada: %s", macro_name)
        except Exception as exc:
            logger.warning("  macro não executada (%s): %s", macro_name, exc)

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

    def _write_cell(self, sheet_name, cell_ref, value):
        normalized = self._normalize_value(value)
        if normalized is None:
            return

        logger.info("  %s!%s = %s", sheet_name, cell_ref, normalized)
        self.workbook.Sheets(sheet_name).Range(cell_ref).Value = normalized

    def _build_results_sheet_sequence(self, mapping, fallback_sheet_name):
        pattern = mapping.get("sheet_name_pattern")
        max_sheets = int(mapping.get("max_sheets") or 12)

        if pattern:
            return [pattern.format(sheet_number=index) for index in range(1, max_sheets + 1)]

        if fallback_sheet_name:
            return [fallback_sheet_name]

        return []

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
                    "observacao": point.get("channel_observacao") or point.get("observacao") or "",
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
            logger.info("Nenhum results_mapping configurado; pulando preenchimento dos blocos de resultados")
            return

        fallback_sheet_name = default_config.get("points_sheet", "Resultados - 1")
        sheet_sequence = self._build_results_sheet_sequence(mapping, fallback_sheet_name)
        available_sheets = {sheet.Name for sheet in self.workbook.Worksheets}

        sheet_sequence = [sheet_name for sheet_name in sheet_sequence if sheet_name in available_sheets]
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
                    self._write_cell(sheet_name, cell_ref, point.get(source_key))

                masses = point.get("massas") or []
                for measurement_index, measurement in enumerate(masses[:measurement_count]):
                    target_row = block_base_row + measurement_start_offset + measurement_index
                    for source_key, field_config in measurement_fields.items():
                        if not isinstance(field_config, dict):
                            continue

                        column = field_config.get("column")
                        if not column:
                            continue

                        cell_ref = f"{column}{target_row}"
                        self._write_cell(sheet_name, cell_ref, measurement.get(source_key))

    def process(self, certificate, template):
        pythoncom.CoInitialize()
        try:
            default_config = template.get("default_config") or {}
            template_path = self._resolve_template_path(
                template.get("excel_template_path", ""),
                default_config,
            )
            if not template_path or not os.path.exists(template_path):
                raise FileNotFoundError(f"Template Excel não encontrado: {template_path}")

            cert_number = certificate["certificate_number"]
            work_dir = os.path.join(PDF_OUTPUT_DIR, cert_number)
            os.makedirs(work_dir, exist_ok=True)

            source_extension = Path(template_path).suffix or ".xlsm"
            work_file = os.path.join(work_dir, f"{cert_number}{source_extension}")
            shutil.copy2(template_path, work_file)

            logger.info("Abrindo Excel para %s", cert_number)
            self.excel = win32com.client.Dispatch("Excel.Application")
            self.excel.Visible = False
            self.excel.DisplayAlerts = False
            self.excel.WindowState = -4137
            self.excel.AutomationSecurity = 1

            self.workbook = self.excel.Workbooks.Open(
                os.path.abspath(work_file),
                ReadOnly=False,
                IgnoreReadOnlyRecommended=True,
            )

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

            result_channels = self._normalize_result_channels(extra)
            self._fill_result_points(result_channels, default_config)

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
                        points_sheet.Range(f"B{row_ref}").Value = float(point["nominal_value"])
                    if point.get("measured_value") is not None:
                        points_sheet.Range(f"C{row_ref}").Value = float(point["measured_value"])
                    if point.get("error_value") is not None:
                        points_sheet.Range(f"D{row_ref}").Value = float(point["error_value"])
                    if point.get("uncertainty") is not None:
                        points_sheet.Range(f"E{row_ref}").Value = float(point["uncertainty"])

            self.excel.CalculateFullRebuild()

            for macro_name in post_fill_macros:
                self._run_macro_if_exists(macro_name)

            self.workbook.Save()

            pdf_path = os.path.join(work_dir, f"{cert_number}.pdf")
            output_sheet.ExportAsFixedFormat(0, os.path.abspath(pdf_path))

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
