import torch
from torch import nn


class ChannelNorm(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.norm = nn.LayerNorm(channels)

    def forward(self, x):
        return self.norm(x.movedim(1, -1)).movedim(-1, 1).contiguous()


def block(cin, cout, kernel, stride, padding):
    return nn.Sequential(
        nn.Conv3d(cin, cout, kernel, stride, padding, bias=False),
        ChannelNorm(cout), nn.SiLU(),
    )


class LocalSEF(nn.Module):
    """Finite-support descriptors and three binary local likelihood fields."""

    def __init__(self, channels=12, dim=128, blend=0.55):
        super().__init__()
        c = channels
        self.encoder = nn.Sequential(
            block(4, c, 3, 1, 1), block(c, 2*c, 2, 2, 0),
            block(2*c, 2*c, 3, 1, 1), block(2*c, 4*c, 2, 2, 0),
            block(4*c, 4*c, 3, 1, 1), block(4*c, 8*c, 2, 2, 0),
        )
        self.descriptor = nn.Sequential(nn.Conv3d(8*c, dim, 1), ChannelNorm(dim), nn.SiLU())
        self.classifier = nn.Conv3d(dim, 6, 1)
        self.context = nn.Sequential(
            nn.Conv3d(dim, dim, 3, padding=2, dilation=2, groups=dim, bias=False),
            nn.Conv3d(dim, dim, 1), ChannelNorm(dim),
        )
        self.residual = nn.Linear(dim, 6)
        nn.init.zeros_(self.residual.weight)
        nn.init.zeros_(self.residual.bias)
        self.blend = blend

    def forward(self, image):
        h = self.descriptor(self.encoder(image))
        b = image.shape[0]
        logits = self.classifier(h).reshape(b, 3, 2, -1).permute(0, 1, 3, 2)
        descriptors = (h + self.blend*self.context(h)).flatten(2).transpose(1, 2)
        logits = logits + self.residual(descriptors).reshape(b, -1, 3, 2).transpose(1, 2)
        return descriptors, logits
