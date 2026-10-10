import torch
from torch import nn
from .local import LocalSEF
from .geometry import finite_volumes
from .graph import CSAcqGraph
from .pooling import mixture


class LAPSEFMIL(nn.Module):
    def __init__(self, config=None):
        super().__init__()
        c = config or {}
        dim = c.get('descriptor_dim', 128)
        self.local = LocalSEF(c.get('base_channels', 12), dim, c.get('scale_blend', 0.55))
        self.graph = CSAcqGraph(
            dim, c.get('graph_hidden', 64), c.get('graph_layers', 3), c.get('affinity_k', 8),
            bound=c.get('graph_bound', 4.0), feedback_bound=c.get('feedback_bound', 0.4),
            transport_bound=c.get('transport_bound', 0.25),
            transport_temperature=c.get('transport_temperature', 1.7),
        )
        self.radii = c.get('radii_mm', [8, 16, 24])
        self.min_support = c.get('min_support_mm3', 160)
        self.geometry_strength = c.get('geometry_strength', 0.2)
        self.register_buffer('alpha', torch.tensor(c.get('alpha', [0.3, 0.25, 0.3])))
        self.register_buffer('tau', torch.tensor(c.get('tau', [1.0, 1.3, 1.0])))

    def forward(self, image, mask):
        if image.ndim != 5 or image.shape[1] != 4 or any(n % 8 for n in image.shape[2:]):
            raise ValueError('image must be [B,4,X,Y,Z] with spatial dimensions divisible by 8.')
        if mask.shape != (image.shape[0], *image.shape[2:]):
            raise ValueError('mask must be [B,X,Y,Z] on the image grid.')
        descriptors, logits = self.local(image)
        regions = []
        for i in range(len(image)):
            r = finite_volumes(mask[i], descriptors[i], logits[i], self.radii, self.min_support)
            g = self.graph(r['descriptors'], r['centers'], r['radii'])
            p, measure, support = mixture(r['mu'], g, r['likelihood'], self.alpha, self.tau, self.geometry_strength)
            r.update(probability=p, measure=measure, support=support)
            regions.append(r)
        return {'probability': torch.stack([r['probability'] for r in regions]), 'regions': regions}
