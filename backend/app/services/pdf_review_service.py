from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas


class PdfReviewService:
    WATERMARK_TEXT = "NAO OFICIAL - EM REVISAO DA QUALIDADE"

    @staticmethod
    def build_review_copy(source_path: str, review_path: str) -> str:
        source = Path(source_path)
        target = Path(review_path)
        target.parent.mkdir(parents=True, exist_ok=True)

        reader = PdfReader(str(source))
        writer = PdfWriter()

        for page in reader.pages:
            watermark_stream = BytesIO()
            width = float(page.mediabox.width)
            height = float(page.mediabox.height)

            overlay = canvas.Canvas(watermark_stream, pagesize=(width, height))
            overlay.saveState()
            overlay.setFillColor(Color(0.67, 0.1, 0.13, alpha=0.12))
            overlay.translate(width / 2, height / 2)
            overlay.rotate(35)
            overlay.setFont("Helvetica-Bold", 28)
            overlay.drawCentredString(0, 0, PdfReviewService.WATERMARK_TEXT)
            overlay.restoreState()
            overlay.save()
            watermark_stream.seek(0)

            watermark_pdf = PdfReader(watermark_stream)
            page.merge_page(watermark_pdf.pages[0])
            writer.add_page(page)

        with target.open("wb") as output_stream:
            writer.write(output_stream)

        return str(target.resolve())
