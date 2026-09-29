import argparse
import json
from pathlib import Path
import numpy as np
import torch
from . import LAPSEFMIL, TASKS


def biopsy_readout(regions, center_mm, radius_mm=5.):
    center = torch.as_tensor(center_mm, device=regions['centers'].device, dtype=regions['centers'].dtype)
    overlap = torch.linalg.vector_norm(regions['centers']-center, dim=-1) <= regions['radii']+radius_mm
    mass = regions['measure'][:, overlap].sum(-1)
    signed = regions['likelihood'][..., 1]-regions['likelihood'][..., 0]
    joint = (regions['measure'][:, overlap]*signed[:, overlap]).sum(-1)
    margin = torch.where(mass > 0, joint/mass.clamp_min(1e-8), torch.full_like(joint, float('nan')))
    return joint, margin, mass


def main():
    parser = argparse.ArgumentParser(description='Predict patient probabilities and export regional evidence.')
    parser.add_argument('--checkpoint', required=True)
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', default='prediction')
    parser.add_argument('--biopsy', nargs=3, type=float, metavar=('X', 'Y', 'Z'))
    parser.add_argument('--device', default='cuda' if torch.cuda.is_available() else 'cpu')
    args = parser.parse_args()
    checkpoint = torch.load(args.checkpoint, map_location=args.device, weights_only=True)
    model = LAPSEFMIL(checkpoint['config']['model']).to(args.device).eval()
    model.load_state_dict(checkpoint['model'])
    with np.load(args.input, allow_pickle=False) as data:
        image = torch.tensor(data['image'], device=args.device, dtype=torch.float32)[None]
        mask = torch.tensor(data['mask'], device=args.device, dtype=torch.float32)[None]
    with torch.no_grad():
        result = model(image, mask)
        regions = result['regions'][0]
        probability = result['probability'][0, :, 1].cpu().numpy()
        payload = {'tasks': TASKS, 'probability': probability.tolist()}
        if args.biopsy:
            joint, margin, mass = biopsy_readout(regions, args.biopsy)
            payload['biopsy'] = {'center_roi_mm': args.biopsy, 'radius_mm': 5., 'joint': joint.tolist(),
                                 'local_margin': [float(x) if torch.isfinite(x) else None for x in margin],
                                 'support_mass': mass.tolist()}
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    (output/'prediction.json').write_text(json.dumps(payload, indent=2, allow_nan=False)+'\n')
    np.savez_compressed(output/'regions.npz', **{k: regions[k].detach().cpu().numpy() for k in
                        ['centers', 'radii', 'mu', 'likelihood', 'measure', 'support']})
    print(json.dumps(payload, indent=2))


if __name__ == '__main__':
    main()
