import torch


def allocate(mu, potential, alpha, tau):
    """Exact capped exponential allocation with differentiable recomputation."""
    if not 0 < float(alpha) <= 1 or float(tau) <= 0:
        raise ValueError('Expected 0 < alpha <= 1 and tau > 0.')
    if float(alpha) == 1:
        return mu + potential*0
    cap = mu/alpha
    log_weight = mu.log()+potential/tau
    with torch.no_grad():
        saturated = torch.zeros_like(mu, dtype=torch.bool)
        for _ in range(len(mu)):
            free = ~saturated
            log_c = (1-cap[saturated].sum()).clamp_min(torch.finfo(mu.dtype).tiny).log()-torch.logsumexp(log_weight[free], 0)
            new = free & (log_c+log_weight >= cap.log())
            if not new.any():
                break
            saturated |= new
    free = ~saturated
    if not free.any():
        return cap + potential*0
    log_c = (1-cap[saturated].sum()).log()-torch.logsumexp(log_weight[free], 0)
    result = cap.clone()
    result[free] = (log_c+log_weight[free]).exp()
    return result


def mixture(mu, potential, likelihood, alpha, tau, geometry_strength):
    g = potential+geometry_strength*(mu.log()-mu.log().mean())
    measure = torch.stack([allocate(mu, g[t], alpha[t], tau[t]) for t in range(3)])
    probability = torch.einsum('tm,tmk->tk', measure, likelihood)
    support = measure[..., None]*likelihood/probability[:, None, :].clamp_min(1e-8)
    return probability, measure, support
