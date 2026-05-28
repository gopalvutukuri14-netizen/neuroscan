import torch
import torch.nn as nn
import torch.nn.functional as F
import timm


# ── Squeeze-Excitation Block ───────────────────────────────────
class SEBlock3D(nn.Module):
    def __init__(self, channels, reduction=8):
        super().__init__()
        self.pool = nn.AdaptiveAvgPool3d(1)
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels, bias=False),
            nn.Sigmoid()
        )

    def forward(self, x):
        B, C = x.shape[:2]
        w = self.pool(x).view(B, C)
        w = self.fc(w).view(B, C, 1, 1, 1)
        return x * w


# ── Residual Block with SE ─────────────────────────────────────
class ResBlock3D(nn.Module):
    def __init__(self, in_channels, out_channels, stride=1, use_se=True):
        super().__init__()

        self.block = nn.Sequential(
            nn.Conv3d(in_channels, out_channels, kernel_size=3,
                      stride=stride, padding=1, bias=False),
            nn.BatchNorm3d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv3d(out_channels, out_channels, kernel_size=3,
                      padding=1, bias=False),
            nn.BatchNorm3d(out_channels),
        )

        self.se = SEBlock3D(out_channels) if use_se else nn.Identity()

        self.skip = nn.Sequential()
        if stride != 1 or in_channels != out_channels:
            self.skip = nn.Sequential(
                nn.Conv3d(in_channels, out_channels, kernel_size=1,
                          stride=stride, bias=False),
                nn.BatchNorm3d(out_channels)
            )

        self.relu = nn.ReLU(inplace=False)

    def forward(self, x):
        out = self.block(x)
        out = self.se(out)
        return self.relu(out + self.skip(x))


# ── 3D ResNet Backbone ─────────────────────────────────────────
class CNN3DBackbone(nn.Module):
    def __init__(self, use_se=True):
        super().__init__()

        self.stem = nn.Sequential(
            nn.Conv3d(1, 32, kernel_size=7, stride=2, padding=3, bias=False),
            nn.BatchNorm3d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool3d(kernel_size=3, stride=2, padding=1)
        )

        self.stage1 = nn.Sequential(
            ResBlock3D(32, 64, use_se=use_se),
            ResBlock3D(64, 64, use_se=use_se)
        )

        self.stage2 = nn.Sequential(
            ResBlock3D(64, 128, stride=2, use_se=use_se),
            ResBlock3D(128, 128, use_se=use_se)
        )

        self.stage3 = nn.Sequential(
            ResBlock3D(128, 256, stride=2, use_se=use_se),
            ResBlock3D(256, 256, use_se=use_se)
        )

        self.drop2 = nn.Dropout3d(p=0.2)
        self.drop3 = nn.Dropout3d(p=0.3)
        self.global_pool = nn.AdaptiveAvgPool3d(1)

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv3d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out',
                                        nonlinearity='relu')
            elif isinstance(m, nn.BatchNorm3d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, x):
        x = self.stem(x)
        x = self.stage1(x)
        x = self.drop2(self.stage2(x))
        x = self.drop3(self.stage3(x))
        x = self.global_pool(x)
        x = x.flatten(1)
        return x


# ── ViT Branch ─────────────────────────────────────────────────
class ViTBranch(nn.Module):
    def __init__(self, embed_dim=256, n_positions=3):
        super().__init__()

        self.n_positions = n_positions
        n_slices = n_positions * 3

        self.vit = timm.create_model(
            'vit_small_patch16_224',
            pretrained=True,           # ✅ matches notebook Cell 14 exactly
            num_classes=0,             #    fine-tuned weights loaded from deployment_model.pt
            in_chans=n_slices
        )
        vit_out_dim = self.vit.num_features

        for param in self.vit.parameters():
            param.requires_grad = False

        for block in self.vit.blocks[-2:]:
            for param in block.parameters():
                param.requires_grad = True

        self.proj = nn.Sequential(
            nn.Linear(vit_out_dim, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.Dropout(0.2)
        )

        self._init_proj()

    def _init_proj(self):
        for m in self.proj.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def extract_slices(self, x):
        B, C, D, H, W = x.shape
        slices = []
        fracs  = [0.35, 0.50, 0.65]

        for frac in fracs:
            d_idx = int(D * frac)
            ax = x[:, :, d_idx, :, :]
            ax = F.interpolate(ax, size=(224, 224),
                               mode='bilinear', align_corners=False)
            slices.append(ax)

            h_idx = int(H * frac)
            co = x[:, :, :, h_idx, :]
            co = F.interpolate(co, size=(224, 224),
                               mode='bilinear', align_corners=False)
            slices.append(co)

            w_idx = int(W * frac)
            sa = x[:, :, :, :, w_idx]
            sa = F.interpolate(sa, size=(224, 224),
                               mode='bilinear', align_corners=False)
            slices.append(sa)

        return torch.cat(slices, dim=1)   # (B, 9, 224, 224)

    def normalize(self, x):
        mean3 = torch.tensor([0.485, 0.456, 0.406], device=x.device)
        std3  = torch.tensor([0.229, 0.224, 0.225], device=x.device)
        mean9 = mean3.repeat(3).view(1, 9, 1, 1)
        std9  = std3.repeat(3).view(1, 9, 1, 1)
        return (x - mean9) / std9

    def forward(self, x):
        slices = self.extract_slices(x)
        slices = self.normalize(slices)
        feats  = self.vit(slices)
        return self.proj(feats)


# ── Fusion Head ────────────────────────────────────────────────
class FusionHead(nn.Module):
    def __init__(self, embed_dim=256):
        super().__init__()

        # ✅ ADD THESE TWO — fixes logit explosion
        self.cnn_norm = nn.LayerNorm(embed_dim)
        self.vit_norm = nn.LayerNorm(embed_dim)

        self.attention = nn.Sequential(
            nn.Linear(embed_dim * 2, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(128, 32),
            nn.ReLU(),
            nn.Linear(32, 2),
            nn.Softmax(dim=1)
        )

        self.fc1 = nn.Sequential(
            nn.Linear(embed_dim, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.4)
        )
        self.fc2 = nn.Sequential(
            nn.Linear(128, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(0.2)
        )
        self.out = nn.Linear(64, 1)

        self.res_proj = nn.Sequential(
            nn.Linear(embed_dim, 64, bias=False),
            nn.BatchNorm1d(64)
        )
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, nn.BatchNorm1d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def forward(self, cnn_feat, vit_feat):
        # ✅ Apply LayerNorm before fusion — matches notebook exactly
        cnn_feat = self.cnn_norm(cnn_feat)
        vit_feat = self.vit_norm(vit_feat)

        combined = torch.cat([cnn_feat, vit_feat], dim=1)
        weights  = self.attention(combined)
        w_cnn    = weights[:, 0:1]
        w_vit    = weights[:, 1:2]
        fused    = w_cnn * cnn_feat + w_vit * vit_feat

        x   = self.fc1(fused)
        x   = self.fc2(x)
        res = self.res_proj(fused)
        return self.out(x + res).squeeze(1)   # ✅ (B,) — matches notebook Cell 15


# ── Full Model ─────────────────────────────────────────────────
class SchizoBrainModel(nn.Module):
    def __init__(self, embed_dim=256):
        super().__init__()
        self.cnn_branch = CNN3DBackbone(use_se=True)
        self.vit_branch = ViTBranch(embed_dim=embed_dim)
        self.fusion     = FusionHead(embed_dim=embed_dim)

    def forward(self, x):
        cnn_feat = self.cnn_branch(x)
        vit_feat = self.vit_branch(x)
        return self.fusion(cnn_feat, vit_feat)