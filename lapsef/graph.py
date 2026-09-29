import torch
import torch.nn.functional as F
from torch import nn


def standardize(x):
    return (x-x.mean(0))*torch.rsqrt(x.var(0, unbiased=False)+1e-8)


def relations(h, centers, radii, k):
    distance = torch.cdist(centers, centers)
    eye = torch.eye(len(centers), device=centers.device, dtype=torch.bool)
    overlap = (distance <= radii[:, None]+radii[None, :]+1e-12) & ~eye
    nesting = ((distance+torch.minimum(radii[:, None], radii[None, :])) <=
               torch.maximum(radii[:, None], radii[None, :])+1e-12) & (radii[:, None] != radii[None, :]) & ~eye
    order = torch.arange(len(centers), device=centers.device)
    for values in (centers[:, 2], centers[:, 1], centers[:, 0], radii):
        order = order[torch.argsort(values[order], stable=True)]
    d = torch.cdist(h, h).masked_fill(eye, torch.inf)
    neighbors = order[torch.argsort(d[:, order], stable=True)[:, :min(k, len(h)-1)]]
    directed = torch.zeros_like(eye).scatter_(1, neighbors, True)
    return overlap, nesting, directed & directed.T


class GraphLayer(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.self_projection = nn.Linear(dim, dim)
        self.messages = nn.ModuleList(nn.Linear(dim, dim, bias=False) for _ in range(3))
        self.norm = nn.LayerNorm(dim)

    def forward(self, h, edges):
        x = self.self_projection(h)
        for projection, edge in zip(self.messages, edges):
            a = edge.to(h.dtype)
            x = x + projection((a/a.sum(-1, keepdim=True).clamp_min(1))@h)
        return F.gelu(self.norm(x))


class CSAcqGraph(nn.Module):
    def __init__(self, dim=128, hidden=64, layers=3, k=8, bound=4., feedback_bound=0.4,
                 transport_bound=0.25, transport_temperature=1.7):
        super().__init__()
        self.input = nn.Linear(dim+4, hidden)
        self.layers = nn.ModuleList(GraphLayer(hidden) for _ in range(layers))
        self.head = nn.Linear(hidden, 3)
        self.feedback = nn.Sequential(nn.Linear(dim, hidden), nn.Tanh(), nn.Linear(hidden, 3))
        self.transport = nn.Sequential(nn.Linear(dim, hidden), nn.LayerNorm(hidden), nn.SiLU(), nn.Linear(hidden, 1, bias=False))
        nn.init.zeros_(self.feedback[-1].weight)
        nn.init.zeros_(self.feedback[-1].bias)
        nn.init.zeros_(self.transport[-1].weight)
        self.k, self.bound, self.feedback_bound = k, bound, feedback_bound
        self.transport_bound, self.transport_temperature = transport_bound, transport_temperature

    def forward(self, descriptors, centers, radii):
        h = descriptors.detach()
        normalized = standardize(h)
        edges = relations(normalized, centers, radii, self.k)
        nodes = F.gelu(self.input(torch.cat((normalized, standardize(centers), radii.log()[:, None]), -1)))
        for layer in self.layers:
            nodes = layer(nodes, edges)
        g = self.bound*torch.tanh(self.head(nodes).T/self.bound)
        g = g + self.feedback_bound*torch.tanh(self.feedback(h).T)
        potential = self.transport(h).flatten()
        flux = torch.tanh((potential[:, None]-potential[None, :])/self.transport_temperature)*(edges[0] | edges[1])
        divergence = flux.sum(-1)
        divergence = divergence-divergence.mean()
        correction = self.transport_bound*divergence/(1+divergence.abs().max())
        return g + torch.stack((torch.zeros_like(correction), correction, torch.zeros_like(correction)))
