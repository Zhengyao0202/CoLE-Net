import torch
import torch.nn.functional as F


def lattice(shape, device, dtype):
    axes = [3.5 + 8*torch.arange(n//8, device=device, dtype=dtype) for n in shape]
    return torch.stack(torch.meshgrid(*axes, indexing='ij'), -1).reshape(-1, 3)


def wendland(distance, radius):
    u = (distance/radius).clamp(0, 1)
    return (1-u).pow(4)*(1+4*u)


def finite_volumes(mask, descriptors, logits, radii=(8, 16, 24), min_support=160, chunk=256):
    """Build one patient's scale-major candidates and nearest-center quadrature."""
    centers = lattice(mask.shape, mask.device, descriptors.dtype)
    volume = F.avg_pool3d(mask[None, None].to(descriptors.dtype), 8, 8).flatten()*512
    tissue = volume > 1e-8
    centers, volume = centers[tissue], volume[tissue]
    descriptors, logits = descriptors[tissue], logits[:, tissue]
    if not len(centers):
        raise ValueError('Tumor support is empty.')
    outputs = []
    for radius in radii:
        likelihoods, pooled, valid = [], [], []
        for c in centers.split(chunk):
            d = torch.cdist(c, centers)
            weights = wendland(d, radius)*volume
            denominator = weights.sum(-1).clamp_min(1e-8)
            keep = ((d < radius)*volume).sum(-1) >= min_support
            likelihoods.append(torch.softmax(torch.einsum('mn,tnk->tmk', weights, logits)/denominator[None, :, None], -1))
            pooled.append(weights@descriptors/denominator[:, None])
            valid.append(keep)
        keep = torch.cat(valid)
        c = centers[keep]
        if not len(c):
            continue
        quadrature = torch.zeros(len(c), device=mask.device, dtype=descriptors.dtype)
        for token, mass in zip(centers.split(chunk), volume.split(chunk)):
            distance = torch.cdist(token, c)
            nearest = (distance <= distance.amin(-1, keepdim=True)+1e-7).to(torch.int64).argmax(-1)
            quadrature.scatter_add_(0, nearest, mass)
        positive = quadrature > 1e-8
        outputs.append((c[positive], torch.full_like(quadrature[positive], radius),
                        quadrature[positive]/quadrature.sum(),
                        torch.cat(pooled)[keep][positive],
                        torch.cat(likelihoods, 1)[:, keep][:, positive]))
    if not outputs:
        raise ValueError('Increase tumor support or reduce min_support_mm3.')
    c, r, mu, h, likelihood = (torch.cat([row[k] for row in outputs], 1 if k == 4 else 0) for k in range(5))
    return {'centers': c, 'radii': r, 'mu': mu/mu.sum(), 'descriptors': h, 'likelihood': likelihood}
