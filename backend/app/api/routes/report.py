from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.api.dependencies import get_current_user
from app.db.database import get_database
from pathlib import Path
from datetime import datetime
import io

router = APIRouter(prefix="/report", tags=["Report"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"


def _draw_bar(canvas_obj, x, y, width, fill_ratio, fill_color, bg_color="#E2E8F0"):
    """Draw a horizontal progress bar."""
    from reportlab.lib.colors import HexColor
    canvas_obj.setFillColor(HexColor(bg_color))
    canvas_obj.roundRect(x, y, width, 8, 4, fill=1, stroke=0)
    canvas_obj.setFillColor(HexColor(fill_color))
    canvas_obj.roundRect(x, y, max(8, width * fill_ratio), 8, 4, fill=1, stroke=0)


@router.get("/{record_id}")
async def generate_report(
    record_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    record = await db.records.find_one({
        "record_id": record_id,
        "user_id": current_user["user_id"],
    })

    if not record:
        raise HTTPException(404, "Record not found")

    if record.get("status") != "Completed":
        raise HTTPException(400, "Analysis not yet completed for this record")

    # ── Build PDF with ReportLab ──────────────────────────────
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.colors import HexColor, white, black
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas as rl_canvas
        from reportlab.lib.utils import ImageReader
    except ImportError:
        raise HTTPException(500, "ReportLab not installed on server")

    W, H = A4
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)

    is_scz       = record.get("prediction") == "SCZ"
    conf_score   = record.get("confidence_score", 0.0)
    conf_pct     = conf_score * 100
    username     = current_user.get("username", current_user["email"].split("@")[0])
    role         = current_user.get("role", "patient").title()
    created_at   = record.get("created_at", datetime.utcnow())
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at)
        except Exception:
            created_at = datetime.utcnow()
    generated_at = datetime.utcnow()

    accent      = "#E11D48" if is_scz else "#059669"
    accent_light= "#FFF1F2" if is_scz else "#F0FDF4"
    diagnosis   = "Schizophrenia (SCZ)" if is_scz else "Normal — Control"

    # ── HEADER BAND ──────────────────────────────────────────
    c.setFillColor(HexColor("#0F172A"))
    c.rect(0, H - 72, W, 72, fill=1, stroke=0)

    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(24*mm, H - 30, "NeuroScan AI")
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#94A3B8"))
    c.drawString(24*mm, H - 46, "Schizophrenia Detection Report")
    c.drawRightString(W - 24*mm, H - 30, f"Generated: {generated_at.strftime('%d %b %Y, %H:%M UTC')}")
    c.drawRightString(W - 24*mm, H - 46, f"Record ID: {record_id[:8].upper()}")

    # ── SECTION: Patient / User Info ──────────────────────────
    y = H - 95
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(HexColor("#0F172A"))
    c.drawString(24*mm, y, "Subject Information")

    c.setStrokeColor(HexColor("#E2E8F0"))
    c.setLineWidth(0.5)
    c.line(24*mm, y - 4, W - 24*mm, y - 4)

    y -= 18
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#64748B"))
    info_pairs = [
        ("Username", username),
        ("Role / Stakeholder", role),
        ("Email", current_user["email"]),
        ("Scan Filename", record.get("filename", "Unknown")),
        ("Upload Date", created_at.strftime("%d %b %Y, %H:%M UTC")),
    ]
    col_x = [24*mm, 95*mm, 130*mm, W - 24*mm]
    for i, (label, value) in enumerate(info_pairs):
        row_y = y - (i * 16)
        c.setFillColor(HexColor("#94A3B8"))
        c.setFont("Helvetica", 8)
        c.drawString(col_x[0], row_y, label)
        c.setFillColor(HexColor("#0F172A"))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(col_x[1], row_y, str(value))

    # ── SECTION: Diagnosis Result ─────────────────────────────
    y -= len(info_pairs) * 16 + 20
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(HexColor("#0F172A"))
    c.drawString(24*mm, y, "Diagnosis Result")
    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(24*mm, y - 4, W - 24*mm, y - 4)

    # Result banner
    y -= 14
    banner_h = 62
    c.setFillColor(HexColor(accent))
    c.roundRect(24*mm, y - banner_h, W - 48*mm, banner_h, 8, fill=1, stroke=0)

    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(32*mm, y - 26, diagnosis)
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("rgba(255,255,255,0.8)") if False else white)
    desc = (
        "Structural patterns consistent with schizophrenia were identified in the MRI scan."
        if is_scz else
        "No schizophrenia-related structural abnormalities were detected in the MRI scan."
    )
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica", 8.5)
    # Wrap description
    max_w = W - 64*mm
    words = desc.split()
    line_buf, lines = [], []
    for w in words:
        test = " ".join(line_buf + [w])
        if c.stringWidth(test, "Helvetica", 8.5) < max_w:
            line_buf.append(w)
        else:
            lines.append(" ".join(line_buf))
            line_buf = [w]
    if line_buf:
        lines.append(" ".join(line_buf))
    for li, line in enumerate(lines[:2]):
        c.drawString(32*mm, y - 42 - li * 13, line)

    # Confidence on right side of banner
    c.setFont("Helvetica-Bold", 22)
    c.setFillColor(white)
    c.drawRightString(W - 32*mm, y - 30, f"{conf_pct:.1f}%")
    c.setFont("Helvetica", 8)
    c.drawRightString(W - 32*mm, y - 44, "Confidence Score")

    # ── Confidence bar ────────────────────────────────────────
    y -= banner_h + 22
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor("#0F172A"))
    c.drawString(24*mm, y, "Confidence Level")
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#64748B"))
    c.drawRightString(W - 24*mm, y, f"{conf_pct:.1f}%")
    y -= 12
    bar_w = W - 48*mm
    _draw_bar(c, 24*mm, y, bar_w, conf_score, accent)
    y -= 6

    # Confidence label
    c.setFont("Helvetica", 7.5)
    c.setFillColor(HexColor("#94A3B8"))
    thresholds = [("0%", 0), ("Low (<60%)", 0.25), ("Moderate (60–80%)", 0.5), ("High (>80%)", 0.75), ("100%", 1.0)]
    c.drawString(24*mm, y - 4, "Low")
    c.drawRightString(W - 24*mm, y - 4, "High")

    # ── SECTION: Heatmap ─────────────────────────────────────
    y -= 28
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(HexColor("#0F172A"))
    c.drawString(24*mm, y, "Grad-CAM Brain Heatmap")
    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(24*mm, y - 4, W - 24*mm, y - 4)

    heatmap_path = UPLOADS_DIR / f"{record_id}_heatmap.png"
    hm_y = y - 14
    img_h = 155  # pts

    if heatmap_path.exists():
        try:
            img_reader = ImageReader(str(heatmap_path))
            img_w = W - 48*mm
            c.drawImage(img_reader, 24*mm, hm_y - img_h, img_w, img_h,
                        preserveAspectRatio=True, anchor='c')
            hm_bottom = hm_y - img_h - 8
        except Exception:
            c.setFillColor(HexColor("#F1F5F9"))
            c.roundRect(24*mm, hm_y - img_h, W - 48*mm, img_h, 6, fill=1, stroke=0)
            c.setFillColor(HexColor("#94A3B8"))
            c.setFont("Helvetica", 9)
            c.drawCentredString(W / 2, hm_y - img_h / 2, "Heatmap image could not be rendered")
            hm_bottom = hm_y - img_h - 8
    else:
        c.setFillColor(HexColor("#F1F5F9"))
        c.roundRect(24*mm, hm_y - img_h, W - 48*mm, img_h, 6, fill=1, stroke=0)
        c.setFillColor(HexColor("#94A3B8"))
        c.setFont("Helvetica", 9)
        c.drawCentredString(W / 2, hm_y - img_h / 2, "Heatmap not available")
        hm_bottom = hm_y - img_h - 8

    c.setFont("Helvetica", 7.5)
    c.setFillColor(HexColor("#94A3B8"))
    c.drawCentredString(W / 2, hm_bottom, "Warmer colors (red/yellow) indicate highest model activation regions")

    # ── DISCLAIMER ───────────────────────────────────────────
    disc_y = hm_bottom - 24
    disc_h = 44
    c.setFillColor(HexColor("#FFFBEB"))
    c.roundRect(24*mm, disc_y - disc_h, W - 48*mm, disc_h, 6, fill=1, stroke=0)
    c.setStrokeColor(HexColor("#FDE68A"))
    c.setLineWidth(0.5)
    c.roundRect(24*mm, disc_y - disc_h, W - 48*mm, disc_h, 6, fill=0, stroke=1)

    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(HexColor("#92400E"))
    c.drawString(28*mm, disc_y - 14, "⚠  Clinical Disclaimer")
    c.setFont("Helvetica", 8)
    disclaimer = (
        "This report is generated by an AI model for research and screening purposes only. "
        "It must not be used as a sole basis for clinical diagnosis or treatment decisions. "
        "All findings should be reviewed and confirmed by a qualified medical professional."
    )
    words2 = disclaimer.split()
    line2_buf, lines2 = [], []
    for w in words2:
        test2 = " ".join(line2_buf + [w])
        if c.stringWidth(test2, "Helvetica", 8) < W - 56*mm:
            line2_buf.append(w)
        else:
            lines2.append(" ".join(line2_buf))
            line2_buf = [w]
    if line2_buf:
        lines2.append(" ".join(line2_buf))
    for li2, ln2 in enumerate(lines2[:3]):
        c.drawString(28*mm, disc_y - 26 - li2 * 11, ln2)

    # ── FOOTER ───────────────────────────────────────────────
    c.setFillColor(HexColor("#F8FAFC"))
    c.rect(0, 0, W, 28, fill=1, stroke=0)
    c.setStrokeColor(HexColor("#E2E8F0"))
    c.setLineWidth(0.5)
    c.line(0, 28, W, 28)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(HexColor("#94A3B8"))
    c.drawString(24*mm, 10, "NeuroScan AI — Schizophrenia Detection System")
    c.drawCentredString(W / 2, 10, f"Record: {record_id[:8].upper()}")
    c.drawRightString(W - 24*mm, 10, f"Page 1 of 1")

    c.save()
    buf.seek(0)

    filename = f"NeuroScan_Report_{record_id[:8]}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
