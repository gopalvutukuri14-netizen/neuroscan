from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.api.dependencies import get_current_user
from app.db.database import get_database
from pathlib import Path
from datetime import datetime
import io

router = APIRouter(prefix="/report", tags=["Report"])
UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"

def _bar(c, x, y, w, ratio, fill, bg="#E2E8F0"):
    from reportlab.lib.colors import HexColor
    c.setFillColor(HexColor(bg)); c.roundRect(x,y,w,8,4,fill=1,stroke=0)
    c.setFillColor(HexColor(fill)); c.roundRect(x,y,max(8,w*ratio),8,4,fill=1,stroke=0)

@router.get("/{record_id}")
async def generate_report(record_id: str, current_user: dict = Depends(get_current_user)):
    db   = get_database()
    role = current_user.get("role","patient")

    if role == "admin":
        record = await db.records.find_one({"record_id": record_id})
    else:
        record = await db.records.find_one({"record_id": record_id, "user_id": current_user["user_id"]})

    if not record:
        raise HTTPException(404, "Record not found")
    if record.get("status") != "Completed":
        raise HTTPException(400, "Analysis not yet completed")

    # Fetch clinical notes
    notes = record.get("clinical_notes", [])

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.colors import HexColor, white
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas as rl_canvas
        from reportlab.lib.utils import ImageReader
    except ImportError:
        raise HTTPException(500, "ReportLab not installed")

    W, H   = A4
    buf    = io.BytesIO()
    c      = rl_canvas.Canvas(buf, pagesize=A4)

    is_scz     = record.get("prediction") == "SCZ"
    conf_score = record.get("confidence_score", 0.0)
    conf_pct   = conf_score * 100
    username   = current_user.get("username", current_user["email"].split("@")[0])
    role_label = role.title()
    created_at = record.get("created_at", datetime.utcnow())
    if isinstance(created_at, str):
        try: created_at = datetime.fromisoformat(created_at)
        except: created_at = datetime.utcnow()
    generated_at = datetime.utcnow()
    accent       = "#E11D48" if is_scz else "#059669"
    accent_light = "#FFF1F2" if is_scz else "#F0FDF4"
    diagnosis    = "Schizophrenia (SCZ)" if is_scz else "Normal — Control"

    # ── HEADER ───────────────────────────────────────────────
    c.setFillColor(HexColor("#0F172A")); c.rect(0,H-72,W,72,fill=1,stroke=0)
    c.setFillColor(white); c.setFont("Helvetica-Bold",20); c.drawString(24*mm,H-30,"NeuroScan AI")
    c.setFont("Helvetica",9); c.setFillColor(HexColor("#94A3B8"))
    c.drawString(24*mm,H-46,"Schizophrenia Detection Report")
    c.drawRightString(W-24*mm,H-30,f"Generated: {generated_at.strftime('%d %b %Y, %H:%M UTC')}")
    c.drawRightString(W-24*mm,H-46,f"Record ID: {record_id[:8].upper()}")

    # ── SUBJECT INFO ─────────────────────────────────────────
    y = H-95
    c.setFont("Helvetica-Bold",11); c.setFillColor(HexColor("#0F172A")); c.drawString(24*mm,y,"Subject Information")
    c.setStrokeColor(HexColor("#E2E8F0")); c.setLineWidth(0.5); c.line(24*mm,y-4,W-24*mm,y-4)
    y -= 18
    info_pairs = [
        ("Username",         username),
        ("Role / Stakeholder", role_label),
        ("Email",            current_user["email"]),
        ("Scan Filename",    record.get("filename","Unknown")),
        ("Upload Date",      created_at.strftime("%d %b %Y, %H:%M UTC")),
    ]
    for i,(label,value) in enumerate(info_pairs):
        row_y = y-(i*16)
        c.setFillColor(HexColor("#94A3B8")); c.setFont("Helvetica",8); c.drawString(24*mm,row_y,label)
        c.setFillColor(HexColor("#0F172A")); c.setFont("Helvetica-Bold",9); c.drawString(95*mm,row_y,str(value))

    # ── DIAGNOSIS BANNER ─────────────────────────────────────
    y -= len(info_pairs)*16+20
    c.setFont("Helvetica-Bold",11); c.setFillColor(HexColor("#0F172A")); c.drawString(24*mm,y,"Diagnosis Result")
    c.setStrokeColor(HexColor("#E2E8F0")); c.line(24*mm,y-4,W-24*mm,y-4)
    y -= 14; banner_h = 62
    c.setFillColor(HexColor(accent)); c.roundRect(24*mm,y-banner_h,W-48*mm,banner_h,8,fill=1,stroke=0)
    c.setFillColor(white); c.setFont("Helvetica-Bold",16); c.drawString(32*mm,y-26,diagnosis)
    desc = ("Structural patterns consistent with schizophrenia were identified."
            if is_scz else "No schizophrenia-related abnormalities were detected.")
    c.setFont("Helvetica",8.5)
    words,line_buf,lines=[],[],"".split()
    words=desc.split()
    for w in words:
        test=" ".join(line_buf+[w])
        if c.stringWidth(test,"Helvetica",8.5)<W-64*mm: line_buf.append(w)
        else: lines.append(" ".join(line_buf)); line_buf=[w]
    if line_buf: lines.append(" ".join(line_buf))
    for li,ln in enumerate(lines[:2]): c.drawString(32*mm,y-42-li*13,ln)
    c.setFont("Helvetica-Bold",22); c.drawRightString(W-32*mm,y-30,f"{conf_pct:.1f}%")
    c.setFont("Helvetica",8); c.drawRightString(W-32*mm,y-44,"Confidence Score")

    # ── CONFIDENCE BAR ───────────────────────────────────────
    y -= banner_h+22
    c.setFont("Helvetica-Bold",10); c.setFillColor(HexColor("#0F172A")); c.drawString(24*mm,y,"Confidence Level")
    c.setFont("Helvetica",8); c.setFillColor(HexColor("#64748B")); c.drawRightString(W-24*mm,y,f"{conf_pct:.1f}%")
    y -= 12; bar_w=W-48*mm
    _bar(c,24*mm,y,bar_w,conf_score,accent)
    c.setFont("Helvetica",7.5); c.setFillColor(HexColor("#94A3B8"))
    c.drawString(24*mm,y-10,"Low"); c.drawRightString(W-24*mm,y-10,"High")

    # ── HEATMAP ──────────────────────────────────────────────
    y -= 28
    c.setFont("Helvetica-Bold",11); c.setFillColor(HexColor("#0F172A")); c.drawString(24*mm,y,"Grad-CAM Brain Activation Map")
    c.setStrokeColor(HexColor("#E2E8F0")); c.line(24*mm,y-4,W-24*mm,y-4)
    # Try to get heatmap — from S3 or stored URL
    hm_y=y-14; img_h=145
    heatmap_drawn = False
    try:
        from app.services.s3_service import S3Service
        import tempfile, urllib.request
        s3_key = f"heatmaps/{record_id}_heatmap.png"
        heatmap_url_val = record.get("heatmap_url","")
        # Try S3 key first, then fall back to URL
        hm_bytes = None
        if S3Service.key_exists(s3_key):
            hm_bytes = S3Service.download_bytes(s3_key)
        elif heatmap_url_val and heatmap_url_val.startswith("http"):
            with urllib.request.urlopen(heatmap_url_val, timeout=10) as r:
                hm_bytes = r.read()
        if hm_bytes:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
                tf.write(hm_bytes); tf_path = tf.name
            img=ImageReader(tf_path); img_w=W-48*mm
            c.drawImage(img,24*mm,hm_y-img_h,img_w,img_h,preserveAspectRatio=True,anchor='c')
            heatmap_drawn = True
    except Exception as hm_err:
        print(f"⚠️ Heatmap fetch failed: {hm_err}")
    if not heatmap_drawn:
        c.setFillColor(HexColor("#F1F5F9")); c.roundRect(24*mm,hm_y-img_h,W-48*mm,img_h,6,fill=1,stroke=0)
        c.setFillColor(HexColor("#94A3B8")); c.setFont("Helvetica",9)
        c.drawCentredString(W/2,hm_y-img_h/2,"Heatmap not available")
    c.setFont("Helvetica",7.5); c.setFillColor(HexColor("#94A3B8"))
    c.drawCentredString(W/2,hm_y-img_h-8,"Warmer colors (yellow/red) = highest activation regions")

    # ── CLINICAL NOTES (if any) ───────────────────────────────
    if notes:
        # Start new page if not enough space
        y_notes = hm_y - img_h - 28
        if y_notes < 80*mm:
            c.showPage()
            y_notes = H - 40

        c.setFont("Helvetica-Bold",11); c.setFillColor(HexColor("#0F172A"))
        c.drawString(24*mm, y_notes, "Clinical Notes")
        c.setStrokeColor(HexColor("#E2E8F0")); c.setLineWidth(0.5)
        c.line(24*mm, y_notes-4, W-24*mm, y_notes-4)

        y_notes -= 18
        for note in notes:
            # Note box
            note_text = note.get("text","")
            author    = note.get("author","Unknown")
            note_date = note.get("created_at","")
            try: note_date = datetime.fromisoformat(note_date).strftime("%d %b %Y, %H:%M")
            except: pass

            # Wrap note text
            note_words = note_text.split()
            note_lines,nl_buf=[],[]
            for w in note_words:
                test=" ".join(nl_buf+[w])
                if c.stringWidth(test,"Helvetica",8.5)<W-60*mm: nl_buf.append(w)
                else: note_lines.append(" ".join(nl_buf)); nl_buf=[w]
            if nl_buf: note_lines.append(" ".join(nl_buf))

            box_h = 14 + len(note_lines)*12 + 12
            c.setFillColor(HexColor("#FAF5FF")); c.setStrokeColor(HexColor("#EDE9FE"))
            c.setLineWidth(0.5)
            c.roundRect(24*mm, y_notes-box_h, W-48*mm, box_h, 5, fill=1, stroke=1)

            # Author + date
            c.setFont("Helvetica-Bold",8); c.setFillColor(HexColor("#7C3AED"))
            c.drawString(28*mm, y_notes-11, author)
            c.setFont("Helvetica",7.5); c.setFillColor(HexColor("#94A3B8"))
            c.drawRightString(W-28*mm, y_notes-11, note_date)

            # Note text lines
            c.setFont("Helvetica",8.5); c.setFillColor(HexColor("#1E1B4B"))
            for li,ln in enumerate(note_lines):
                c.drawString(28*mm, y_notes-22-li*12, ln)

            y_notes -= box_h+6

            # New page if needed
            if y_notes < 50*mm:
                c.showPage(); y_notes = H-40

    # ── DISCLAIMER ───────────────────────────────────────────
    disc_y = (hm_y-img_h-28) if not notes else (y_notes - 10)
    if disc_y < 60*mm:
        c.showPage(); disc_y = H-40
    disc_h=44
    c.setFillColor(HexColor("#FFFBEB")); c.roundRect(24*mm,disc_y-disc_h,W-48*mm,disc_h,6,fill=1,stroke=0)
    c.setStrokeColor(HexColor("#FDE68A")); c.setLineWidth(0.5)
    c.roundRect(24*mm,disc_y-disc_h,W-48*mm,disc_h,6,fill=0,stroke=1)
    c.setFont("Helvetica-Bold",8.5); c.setFillColor(HexColor("#92400E"))
    c.drawString(28*mm,disc_y-14,"⚠  Clinical Disclaimer")
    disclaimer=("This report is generated by an AI model for research and screening purposes only. "
                "It must not be used as a sole basis for clinical diagnosis or treatment decisions. "
                "All findings should be reviewed and confirmed by a qualified medical professional.")
    dw,dl_buf,dl=[],[],"".split()
    dw=disclaimer.split()
    for w in dw:
        test=" ".join(dl_buf+[w])
        if c.stringWidth(test,"Helvetica",8)<W-56*mm: dl_buf.append(w)
        else: dl.append(" ".join(dl_buf)); dl_buf=[w]
    if dl_buf: dl.append(" ".join(dl_buf))
    c.setFont("Helvetica",8); c.setFillColor(HexColor("#92400E"))
    for li2,ln2 in enumerate(dl[:3]): c.drawString(28*mm,disc_y-26-li2*11,ln2)

    # ── FOOTER ───────────────────────────────────────────────
    c.setFillColor(HexColor("#F8FAFC")); c.rect(0,0,W,28,fill=1,stroke=0)
    c.setStrokeColor(HexColor("#E2E8F0")); c.setLineWidth(0.5); c.line(0,28,W,28)
    c.setFont("Helvetica",7.5); c.setFillColor(HexColor("#94A3B8"))
    c.drawString(24*mm,10,"NeuroScan AI — Schizophrenia Detection System")
    c.drawCentredString(W/2,10,f"Record: {record_id[:8].upper()}")
    c.drawRightString(W-24*mm,10,"Page 1")

    c.save(); buf.seek(0)
    filename=f"NeuroScan_Report_{record_id[:8]}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
        headers={"Content-Disposition":f'attachment; filename="{filename}"'})
