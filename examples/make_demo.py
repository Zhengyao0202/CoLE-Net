import csv
import json
from pathlib import Path
import argparse
import numpy as np


def main():
    parser = argparse.ArgumentParser(description='Create a small synthetic MRI-shaped smoke dataset.')
    parser.add_argument('--output', default='demo_data')
    args = parser.parse_args()
    root = Path(args.output)
    root.mkdir(parents=True, exist_ok=False)
    rng = np.random.default_rng(7)
    grid = np.stack(np.meshgrid(*[np.arange(32)]*3, indexing='ij'))
    mask = (((grid-15.5)**2).sum(0) < 8**2).astype(np.float32)
    with (root/'patients.csv').open('w', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['patient_id', 'path', 'fold', 'idh', 'onep19q', 'grade'])
        for i in range(20):
            label = i % 2
            image = rng.normal(0, 0.3, (4, 32, 32, 32)).astype(np.float32)
            image += mask[None]*(label*0.8+0.2)
            np.savez_compressed(root/f'example_{i:02d}.npz', image=image, mask=mask)
            writer.writerow([f'example_{i:02d}', f'example_{i:02d}.npz', i//4, label, label, label])
    config = {'model': {'base_channels': 2, 'descriptor_dim': 8, 'graph_hidden': 8, 'graph_layers': 1},
              'training': {'epochs': 1, 'learning_rate': 0.001, 'weight_decay': 0.0001,
                           'task_weights': [0.8, 1.4, 0.8], 'seed': 7, 'gradient_clip': 5., 'augment': False}}
    (root/'smoke.json').write_text(json.dumps(config, indent=2)+'\n')
    print(root/'patients.csv')


if __name__ == '__main__':
    main()
