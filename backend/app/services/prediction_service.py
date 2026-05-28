import os
import tempfile
import torch
import numpy as np
import nibabel as nib
import pydicom
from pathlib import Path
from captum.attr import LayerGradCam, LayerAttribution
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.colors import LinearSegmentedColormap
import matplotlib.cm as cm
from scipy.ndimage import zoom, gaussian_filter

from app.models.schizo_brain_model import SchizoBrainModel

# ── Paths ──────────────────────────────────────────────────────
MODEL_PATH = Path(__file__).parent.parent / "deployment_model.pt"
UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

MODEL_VERSION = "v3.0.0"

# ── Custom colormap: black→purple→red→orange→yellow (neuro style) ──
NEURO_CMAP = LinearSegmentedColormap.from_list(
    "neuro",
    [
        (0.00, "#000000"),   # black   — no activation
        (0.20, "#1a0030"),   # deep purple
        (0.40, "#6B0F8E"),   # purple
        (0.60, "#C0392B"),   # red
        (0.80, "#E67E22"),   # orange
        (1.00, "#F9E400"),   # bright yellow — peak activation
    ]
)


def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"❌ Model not found at {MODEL_PATH}")

    global MODEL_VERSION
    pkg = torch.load(MODEL_PATH, map_location=device, weights_only=False)

    if "threshold" not in pkg:
        raise RuntimeError("❌ 'threshold' key missing from deployment_model.pt.")

    threshold = float(pkg["threshold"])
    model     = SchizoBrainModel(embed_dim=256).to(device)
    model.load_state_dict(pkg["model_state_dict"])
    model.eval()

    with torch.no_grad():
        dummy_logit = model(
            torch.randn(1, 1, 128, 128, 128).to(device)
        ).squeeze().item()

    print(f"✅ Model loaded")
    print(f"   version    : {pkg.get('model_version', 'unknown')}")
    print(f"   threshold  : {threshold:.4f}")
    print(f"   test AUC   : {pkg.get('test_metrics', {}).get('auc', '?')}")
    print(f"   dummy logit: {dummy_logit:.4f} → sigmoid={torch.sigmoid(torch.tensor(dummy_logit)).item():.4f}")

    return model, threshold


MODEL, THRESHOLD = load_model()


# ── Preprocessing ──────────────────────────────────────────────
def preprocess_volume(file_bytes: bytes, filename: str) -> torch.Tensor:
    fname = filename.lower()
    if fname.endswith('.nii.gz'):  ext = '.nii.gz'
    elif fname.endswith('.nii'):   ext = '.nii'
    elif fname.endswith('.dcm'):   ext = '.dcm'
    else: raise ValueError(f"Unsupported format: {filename}")

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        if ext in ('.nii.gz', '.nii'):
            print("  [1/4] Loading MRI with nibabel...")
            img    = nib.load(tmp_path)
            volume = img.get_fdata(dtype=np.float32)
            if volume.ndim == 4:
                volume = volume[:, :, :, 0]
        elif ext == '.dcm':
            print("  [1/4] Loading DICOM...")
            ds     = pydicom.dcmread(tmp_path)
            volume = ds.pixel_array.astype(np.float32)
            volume = np.stack([volume] * 128, axis=0)
    finally:
        os.unlink(tmp_path)

    print("  [2/4] Resizing to 128x128x128...")
    zoom_factors = [128 / s for s in volume.shape[:3]]
    resized      = zoom(volume, zoom_factors, order=1)

    print("  [3/4] Percentile clipping...")
    p1, p99 = np.percentile(resized, [1, 99])
    resized  = np.clip(resized, p1, p99)

    print("  [4/4] Normalizing...")
    vmin, vmax = resized.min(), resized.max()
    if vmax - vmin < 1e-8:
        raise ValueError("MRI volume near-zero range — file may be corrupted.")
    resized = (resized - vmin) / (vmax - vmin + 1e-8)

    tensor = torch.tensor(resized, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
    print(f"  ✅ Preprocessing done — shape: {tensor.shape}")
    return tensor


def best_slice_idx(heatmap_3d: np.ndarray, axis: int) -> int:
    energy = heatmap_3d.sum(axis=tuple(i for i in range(3) if i != axis))
    return int(np.argmax(energy))


def top_n_slices(heatmap_3d: np.ndarray, axis: int, n: int = 3) -> list:
    """Return top-n slice indices sorted by activation energy."""
    energy = heatmap_3d.sum(axis=tuple(i for i in range(3) if i != axis))
    return list(np.argsort(energy)[::-1][:n])


def overlay_slice(mri_slice: np.ndarray,
                  heatmap_slice: np.ndarray,
                  alpha: float = 0.50,
                  cmap=None,
                  threshold_pct: float = 0.10) -> np.ndarray:
    """
    Upgraded overlay:
    - Threshold low activations (below threshold_pct) → only show real hotspots
    - Gaussian smooth heatmap for cleaner blobs
    - Use custom neuro colormap
    - Slightly higher alpha for more vivid heatmap
    """
    if cmap is None:
        cmap = NEURO_CMAP

    mri_norm = (mri_slice - mri_slice.min()) / (mri_slice.max() - mri_slice.min() + 1e-8)
    mri_rgb  = np.stack([mri_norm] * 3, axis=-1)

    # Smooth heatmap — reduces salt/pepper noise
    heat_smooth = gaussian_filter(heatmap_slice, sigma=1.5)

    # Threshold: hide low-activation regions so only real hotspots show
    heat_thresh = heat_smooth.copy()
    heat_thresh[heat_thresh < threshold_pct] = 0.0

    colormap = cmap
    heat_rgb  = colormap(heat_thresh)[..., :3]

    # Mask shape (H,W,1) so it broadcasts correctly against (H,W,3) RGB arrays
    mask = (heat_thresh > 0).astype(np.float32)[..., np.newaxis]

    # Per-pixel blend: where mask=0 → pure MRI, where mask=1 → full blend
    blended = (1 - mask * alpha) * mri_rgb + (mask * alpha) * heat_rgb
    return np.clip(blended, 0, 1)


def generate_gradcam(volume_tensor: torch.Tensor,
                     save_path: str = None,
                     pred_label: str = "",
                     pred_score: float = 0.0) -> np.ndarray:
    """
    Upgraded Grad-CAM visualization:
    - 3 rows × 3 columns: Axial | Coronal | Sagittal, best 3 slices each
    - Custom neuro colormap (black→purple→red→yellow)
    - Heatmap thresholding — only hotspots visible
    - Gaussian smoothing on heatmap
    - Color legend bar at bottom
    - Clean dark background matching clinical tools
    - Confidence % and prediction label on figure
    """
    MODEL.eval()
    MODEL.zero_grad()

    # ── Grad-CAM attribution ──────────────────────────────────
    target_layer = MODEL.cnn_branch.stage3[-1].block[4]

    vol = volume_tensor.to(device).detach().clone().requires_grad_(True)
    MODEL.zero_grad()

    grad_cam    = LayerGradCam(MODEL, target_layer)
    attribution = grad_cam.attribute(vol, target=None, relu_attributions=True)

    heatmap_up = LayerAttribution.interpolate(
        attribution,
        interpolate_dims=(128, 128, 128),
        interpolate_mode='trilinear'
    ).mean(dim=1, keepdim=True)

    # Normalize
    h = heatmap_up.squeeze().detach().cpu().numpy()
    h = np.maximum(h, 0)
    if h.max() > 1e-6:
        h = (h - h.min()) / (h.max() - h.min() + 1e-8)
    else:
        print("⚠️  Heatmap near-zero")

    print(f"  Heatmap: min={h.min():.4f} max={h.max():.4f} mean={h.mean():.4f} p90={np.percentile(h, 90):.4f}")

    # ── Top 3 slices per view ─────────────────────────────────
    ax_slices  = top_n_slices(h, axis=0, n=3)   # axial
    cor_slices = top_n_slices(h, axis=1, n=3)   # coronal
    sag_slices = top_n_slices(h, axis=2, n=3)   # sagittal

    print(f"  Top axial slices    : {ax_slices}")
    print(f"  Top coronal slices  : {cor_slices}")
    print(f"  Top sagittal slices : {sag_slices}")

    if save_path:
        mri = vol.squeeze().detach().cpu().numpy()

        is_scz      = "SCZ" in pred_label or "Schizo" in pred_label
        title_color = "#FF4C6A" if is_scz else "#22C55E"
        title_text  = f"{'Schizophrenia Detected' if is_scz else 'Normal — Control'}  ·  {pred_score*100:.1f}% confidence"

        # ── Figure layout ────────────────────────────────────
        # 3 rows (views) × 3 cols (top slices) + 1 bottom colorbar row
        fig = plt.figure(figsize=(13, 11), facecolor="#0D1117")
        gs  = gridspec.GridSpec(
            4, 3,
            figure=fig,
            height_ratios=[1, 1, 1, 0.12],
            hspace=0.06,
            wspace=0.04,
        )

        view_defs = [
            ("Axial",    ax_slices,  lambda s, m, hm: (m[s, :, :],  hm[s, :, :])),
            ("Coronal",  cor_slices, lambda s, m, hm: (m[:, s, :],  hm[:, s, :])),
            ("Sagittal", sag_slices, lambda s, m, hm: (m[:, :, s],  hm[:, :, s])),
        ]

        for row_idx, (view_name, slice_list, extractor) in enumerate(view_defs):
            for col_idx, sl in enumerate(slice_list):
                ax = fig.add_subplot(gs[row_idx, col_idx])
                mri_sl, heat_sl = extractor(sl, mri, h)

                blended = overlay_slice(
                    mri_sl, heat_sl,
                    alpha=0.58,
                    cmap=NEURO_CMAP,
                    threshold_pct=0.10,
                )

                ax.imshow(blended, origin='lower', aspect='equal', interpolation='bilinear')
                ax.axis('off')

                # Slice label (top-left corner of each cell)
                rank = ["Best", "2nd", "3rd"][col_idx]
                ax.text(
                    0.03, 0.97,
                    f"{view_name}  {rank}  [z={sl}]",
                    transform=ax.transAxes,
                    fontsize=7.5, color='white',
                    va='top', ha='left',
                    bbox=dict(boxstyle='round,pad=0.25', facecolor='#0D1117', alpha=0.7, edgecolor='none'),
                )

        # ── Color legend bar ─────────────────────────────────
        cbar_ax = fig.add_subplot(gs[3, :])
        gradient = np.linspace(0, 1, 300).reshape(1, -1)
        cbar_ax.imshow(gradient, aspect='auto', cmap=NEURO_CMAP)
        cbar_ax.set_yticks([])
        cbar_ax.set_xticks([0, 75, 150, 225, 299])
        cbar_ax.set_xticklabels(
            ['No Activation', 'Low', 'Medium', 'High', 'Peak'],
            fontsize=8, color='#9CA3AF',
        )
        cbar_ax.tick_params(length=0)
        for spine in cbar_ax.spines.values():
            spine.set_visible(False)
        cbar_ax.set_facecolor("#0D1117")

        # ── Title ─────────────────────────────────────────────
        fig.text(
            0.5, 0.995,
            "Grad-CAM Brain Activation Map",
            ha='center', va='top',
            fontsize=13, fontweight='bold', color='white',
        )
        fig.text(
            0.5, 0.975,
            title_text,
            ha='center', va='top',
            fontsize=10, color=title_color, fontweight='600',
        )

        # ── Column headers (Best / 2nd / 3rd) ────────────────
        for col_i, lbl in enumerate(["Highest Activation", "2nd Highest", "3rd Highest"]):
            fig.text(
                (col_i + 0.5) / 3, 0.955,
                lbl,
                ha='center', va='top',
                fontsize=8.5, color='#6B7280',
            )

        plt.savefig(
            save_path,
            dpi=130,
            bbox_inches='tight',
            facecolor="#0D1117",
            edgecolor='none',
        )
        plt.close()
        print(f"✅ Grad-CAM saved → {save_path}")

    return h.astype(np.float32)


# ── Main prediction entry point ────────────────────────────────
def run_prediction(file_bytes: bytes, filename: str, record_id: str) -> dict:
    print(f"\n{'='*50}")
    print(f"  Starting prediction for record: {record_id}")
    print(f"  File: {filename}")
    print(f"{'='*50}")

    tensor = preprocess_volume(file_bytes, filename)

    MODEL.eval()
    with torch.no_grad():
        logit = MODEL(tensor.to(device))
        logit = torch.clamp(logit, -10, 10)
        prob  = torch.sigmoid(logit).squeeze().item()

    prediction = "SCZ" if prob >= THRESHOLD else "Control"

    print(f"  raw prob  : {prob:.4f}")
    print(f"  threshold : {THRESHOLD:.4f}")
    print(f"  result    : {prediction}")

    heatmap_path = str(UPLOAD_DIR / f"{record_id}_heatmap.png")
    generate_gradcam(
        tensor,
        save_path=heatmap_path,
        pred_label=prediction,
        pred_score=prob,
    )

    return {
        "prediction"      : prediction,
        "confidence_score": round(prob, 4),
        "confidence_pct"  : round(prob * 100, 1),
        "threshold_used"  : round(THRESHOLD, 4),
        "heatmap_path"    : heatmap_path,
        "model_version"   : MODEL_VERSION,
    }
