import csv
from pathlib import Path
import numpy as np
import torch
from torch.utils.data import Dataset
from . import TASKS


def read_manifest(path):
    path = Path(path).resolve()
    with path.open(newline='') as stream:
        rows = list(csv.DictReader(stream))
    ids = [r['patient_id'] for r in rows]
    if len(set(ids)) != len(ids):
        raise ValueError('Each patient must have one manifest row.')
    for r in rows:
        r['path'] = str((path.parent/r['path']).resolve())
        r['fold'] = int(r['fold'])
        if r['fold'] not in range(5):
            raise ValueError('Development folds are integers 0 through 4.')
        for task in TASKS:
            r[task] = int(r[task]) if r.get(task, '') != '' else -1
            if r[task] not in (-1, 0, 1):
                raise ValueError('Labels are 0, 1, or empty for missing.')
    return rows


class MRIDataset(Dataset):
    def __init__(self, rows):
        self.rows = rows

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        r = self.rows[i]
        with np.load(r['path'], allow_pickle=False) as data:
            image = torch.from_numpy(data['image'].astype(np.float32))
            mask = torch.from_numpy(data['mask'].astype(np.float32))
        if not torch.isfinite(image).all() or not torch.isfinite(mask).all():
            raise ValueError('Image and mask must contain finite values.')
        if image.shape[0] != 4 or image.shape[1:] != mask.shape or not ((mask >= 0) & (mask <= 1)).all():
            raise ValueError('Expected four registered channels and a support mask in [0,1].')
        return image, mask, torch.tensor([r[t] for t in TASKS])


def augment(image):
    shape = (*image.shape[:2], 1, 1, 1)
    result = image*(0.8+0.4*torch.rand(shape, device=image.device))
    result = result+0.2*(2*torch.rand(shape, device=image.device)-1)+0.03*torch.randn_like(image)
    if torch.rand((), device=image.device) < 0.1:
        result[:, torch.randint(4, ()).item()] = 0
    return result
