import argparse
import csv
import hashlib
import json
from pathlib import Path
import random
import numpy as np
import torch
from sklearn.metrics import roc_auc_score
from torch.utils.data import DataLoader
from . import LAPSEFMIL, TASKS
from .data import MRIDataset, read_manifest, augment


def loss_weights(rows, task_weights, device):
    labels = torch.tensor([[r[t] for t in TASKS] for r in rows])
    weights = torch.zeros(3, 2, device=device)
    for t in range(3):
        counts = torch.tensor([(labels[:, t] == k).sum() for k in range(2)], device=device)
        if (counts == 0).any():
            raise ValueError(f'Training needs both classes for {TASKS[t]}.')
        weights[t] = task_weights[t]/(2*counts if t == 1 else counts.sum())
    return weights*len(rows)/3


@torch.no_grad()
def predict_rows(model, rows, device):
    model.eval()
    probabilities = []
    for image, mask, _ in DataLoader(MRIDataset(rows), batch_size=1):
        probabilities.append(model(image.to(device), mask.to(device))['probability'][0, :, 1].cpu().numpy())
    return np.stack(probabilities)


def fit(config, rows, fold, output, device, init=None):
    val = (fold+1) % 5
    train = [r for r in rows if r['fold'] not in (fold, val)]
    validation = [r for r in rows if r['fold'] == val]
    test = [r for r in rows if r['fold'] == fold]
    if not train or not validation or not test:
        raise ValueError('Each rotation needs training, validation, and test patients.')
    c = config['training']
    if c['epochs'] < 1 or c['learning_rate'] <= 0:
        raise ValueError('Use a positive epoch count and learning rate.')
    seed = c['seed']+fold
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    model = LAPSEFMIL(config['model']).to(device)
    if init:
        model.load_state_dict(torch.load(init, map_location=device, weights_only=True)['model'])
    output.mkdir(parents=True, exist_ok=False)
    identity = {'config': config, 'test_fold': fold, 'validation_fold': val, 'seed': seed,
                'initialization': 'scratch' if init is None else Path(init).name,
                'patients': {role: [r['patient_id'] for r in group] for role, group in
                             [('train', train), ('validation', validation), ('test', test)]}}
    (output/'run.json').write_text(json.dumps(identity, indent=2)+'\n')
    optimizer = torch.optim.AdamW(model.parameters(), lr=c['learning_rate'], weight_decay=c['weight_decay'])
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, c['epochs'], eta_min=c['learning_rate']*0.1)
    weights = loss_weights(train, c['task_weights'], device)
    loader = DataLoader(MRIDataset(train), batch_size=1, shuffle=True)
    labels = np.array([[r[t] for t in TASKS] for r in validation])
    for t in range(3):
        if len(np.unique(labels[labels[:, t] >= 0, t])) != 2:
            raise ValueError(f'Validation needs both classes for {TASKS[t]}.')
    history, best = [], -float('inf')
    for epoch in range(1, c['epochs']+1):
        model.train()
        total = 0.
        for image, mask, y in loader:
            image, mask, y = image.to(device), mask.to(device), y.to(device)
            optimizer.zero_grad(set_to_none=True)
            if c.get('augment', True):
                image = augment(image)
            p = model(image, mask)['probability']
            target = y.clamp_min(0)
            nll = -p.gather(-1, target[..., None]).squeeze(-1).clamp_min(1e-8).log()
            loss = (nll*weights[torch.arange(3, device=device), target]*(y >= 0)).sum()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), c['gradient_clip'], error_if_nonfinite=True)
            optimizer.step()
            total += float(loss.detach())
        p = predict_rows(model, validation, device)
        aucs = [roc_auc_score(labels[labels[:, t] >= 0, t], p[labels[:, t] >= 0, t]) for t in range(3)]
        score = float(np.mean(aucs))
        history.append({'epoch': epoch, 'loss': total/len(train), 'validation_auc': score, 'task_auc': aucs})
        if score > best:
            best = score
            torch.save({'model': model.state_dict(), 'config': config, 'epoch': epoch,
                        'validation_auc': best, 'training_route': 'unified_final_architecture'}, output/'model.pt')
        scheduler.step()
        (output/'history.json').write_text(json.dumps(history, indent=2)+'\n')
        print(f'fold={fold} epoch={epoch} loss={total/len(train):.4f} validation_auc={score:.4f}', flush=True)
    checkpoint = torch.load(output/'model.pt', map_location=device, weights_only=True)
    model.load_state_dict(checkpoint['model'])
    heldout = predict_rows(model, test, device)
    with (output/'predictions.csv').open('w', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['patient_id', *[t+'_probability' for t in TASKS]])
        for i, row in enumerate(test):
            writer.writerow([row['patient_id'], *heldout[i].tolist()])
    (output/'model.sha256').write_text(hashlib.sha256((output/'model.pt').read_bytes()).hexdigest()+'\n')


def main():
    parser = argparse.ArgumentParser(description='Train CoLE-Net.')
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--config', default='configs/default.json')
    parser.add_argument('--output', default='runs/lapsef')
    parser.add_argument('--fold', type=int, choices=range(5))
    parser.add_argument('--device', default='cuda' if torch.cuda.is_available() else 'cpu')
    parser.add_argument('--init')
    args = parser.parse_args()
    if args.init and args.fold is None:
        parser.error('--init pairs with one explicit --fold.')
    config = json.loads(Path(args.config).read_text())
    rows = read_manifest(args.manifest)
    for fold in range(5) if args.fold is None else [args.fold]:
        fit(config, rows, fold, Path(args.output)/f'fold_{fold}', args.device, args.init)


if __name__ == '__main__':
    main()
