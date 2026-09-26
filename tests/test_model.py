import torch
from lapsef import LAPSEFMIL
from lapsef.pooling import allocate
from lapsef.graph import CSAcqGraph, relations, standardize
from lapsef.predict import biopsy_readout


def test_water_filling_constraints_and_gradient():
    mu = torch.tensor([0.05, 0.15, 0.3, 0.5], dtype=torch.float64)
    g = torch.tensor([5., 2., -0.2, 0.4], dtype=torch.float64, requires_grad=True)
    alpha, tau = 0.6, 0.8
    nu = allocate(mu, g, alpha, tau)
    assert torch.allclose(nu.sum(), torch.tensor(1., dtype=mu.dtype))
    assert torch.all(nu >= 0) and torch.all(nu <= mu/alpha+1e-10)
    assert torch.allclose(allocate(mu, g, 1., tau), mu)
    assert torch.autograd.gradcheck(lambda x: allocate(mu, x, alpha, tau), (g,))
    free = nu < mu/alpha-1e-8
    kkt = (nu[free]/mu[free]).log()-g[free]/tau
    assert torch.allclose(kkt, kkt[0].expand_as(kkt), atol=1e-9)


def test_graph_detachment_and_permutation():
    torch.manual_seed(5)
    h = torch.randn(7, 8, requires_grad=True)
    centers = torch.arange(21).reshape(7, 3).float()
    radii = torch.tensor([8., 16., 8., 16., 24., 8., 24.])
    graph = CSAcqGraph(8, 8, layers=1)
    g = graph(h, centers, radii)
    g.sum().backward()
    assert h.grad is None
    assert graph.head.weight.grad.abs().sum() > 0
    permutation = torch.tensor([4, 0, 6, 2, 3, 1, 5])
    assert torch.allclose(graph(h[permutation], centers[permutation], radii[permutation]), g[:, permutation], atol=1e-5)
    equal = torch.zeros_like(h)
    a = relations(standardize(equal), centers, radii, 2)[2]
    b = relations(standardize(equal[permutation]), centers[permutation], radii[permutation], 2)[2]
    assert torch.equal(a[permutation][:, permutation], b)


def test_model_mixture_and_biopsy():
    torch.manual_seed(8)
    model = LAPSEFMIL({'base_channels': 2, 'descriptor_dim': 8, 'graph_hidden': 8, 'graph_layers': 1})
    image = torch.randn(1, 4, 32, 32, 32)
    mask = torch.zeros(1, 32, 32, 32)
    mask[:, 8:24, 8:24, 8:24] = 1
    output = model(image, mask)
    p, r = output['probability'], output['regions'][0]
    assert torch.allclose(p.sum(-1), torch.ones(1, 3), atol=1e-6)
    assert torch.allclose(r['measure'].sum(-1), torch.ones(3), atol=1e-6)
    assert torch.all(r['measure'] <= r['mu'][None]/model.alpha[:, None]+1e-6)
    assert torch.allclose(r['support'].sum(1), torch.ones(3, 2), atol=1e-6)
    p[0, :, 1].sum().backward()
    assert model.local.classifier.weight.grad.abs().sum() > 0
    assert model.graph.head.weight.grad.abs().sum() > 0
    joint, margin, mass = biopsy_readout(r, [16, 16, 16])
    assert torch.allclose(joint, margin*mass)
    _, outside, mass = biopsy_readout(r, [1000, 1000, 1000])
    assert torch.isnan(outside).all() and (mass == 0).all()
