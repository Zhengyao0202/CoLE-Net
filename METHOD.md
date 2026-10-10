# Method overview

CoLE-Net connects regional MRI evidence with patient-level predictions for IDH mutation, 1p/19q codeletion and histologic grade.

- **Local-SEF** learns evidence within tumor regions.
- **CS-CG** connects neighboring and multiscale regions through spatial and phenotypic context.
- **GREA** aggregates regional evidence into a patient-level prediction.

Regional readouts support comparison with recorded biopsy sites.

## Training and prediction

Training supports five-fold evaluation. Prediction exports patient probabilities and regional evidence.

See the [README](https://github.com/Zhengyao0202/CoLE-Net#readme) for installation, input formats and example commands, and `configs/default.json` for training settings.

## Biopsy coordinates

Provide biopsy coordinates in millimeters on the registered ROI grid, in the same X/Y/Z order as the input array. Convert world coordinates using the image affine and crop origin before prediction. The prediction command exports patient probabilities and regional evidence around the requested site.
