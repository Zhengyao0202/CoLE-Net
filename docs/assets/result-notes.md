# CoLE-Net results — 26 September 2026

The result figures and CSVs compare CoLE-Net with 19 baselines: 13 deep models and six conventional models. The conventional models are AdaBoost, Extra trees, Gradient boosting, Hist. gradient boosting, joint MLP and Random forest. Each uses 15 T1 intensity summaries and 15 tumor shape/location features, fitted with seed 101 over five rotations. Patient-level and biopsy evaluations use these same fits.

## Patient-level results

[Complete results](patient-all-models.csv) contain 180 model–endpoint–cohort rows: 20 models, three endpoints and three cohorts. AUC, accuracy, F1 and MCC use pooled Development out-of-fold predictions or external five-model probability ensembles. Eligible counts are listed per endpoint; Xijing contains 106 patients, with 105 eligible for IDH, 59 for 1p/19q and 92 for Grade. These ensemble summaries differ from the manuscript table's five-fold means and sample SDs.

The [radar](performance-radar.svg) and [AUC difference figure](performance-comparison.svg) show these patient-level AUCs. Differences are CoLE-Net minus baseline in percentage points; Mean averages the nine cohort–task comparisons.

## Biopsy results

[Complete results](biopsy-all-models.csv) contain 40 model–endpoint rows, using 15 IDH and 10 Grade patients with recorded sampling coordinates. The five primary metrics, in order, are:

1. Biopsy-local AUC.
2. Biopsy-site direction agreement.
3. Spatial discriminability ratio, summarized by the patient median.
4. Biopsy-site strict 5:0 label-correct fraction.
5. Reference-coordinate strict 5:0 same-sign fraction.

CoLE-Net uses its native local evidence; the patient-level comparators use regional deletion with 5-mm harmonic replacement. CSV fractions remain on their original 0–1 scale. Reference-coordinate same-sign consistency describes agreement across five folds and does not establish pathology correctness. Five exactly zero effects count as same-sign in this registered reference metric; this accounts for high AdaBoost reference consistency despite weak biopsy-site evidence.

The [main profile](biopsy-profile.svg) shows ten baselines selected by the lowest equal-weight mean rank across the two endpoints and five metrics. Ties receive average ranks; CoLE-Net is excluded from this selection. The [complete profile](biopsy-all-baselines.svg) retains all 19 baselines. The main display subset leaves the statistical correction family unchanged.

## Configuration selection and statistical comparisons

The six conventional configurations were selected after observing outcomes by minimizing a normalized performance objective with 95% biopsy and 5% patient-level weight across 10,296 six-model combinations. This outcome-guided selection and the biopsy display selection make the comparisons exploratory. The complete candidate matrix and selection history are retained in the research records.

The [patient-level statistics](patient-paired-statistics.csv) contain 684 comparisons and the [biopsy statistics](biopsy-paired-statistics.csv) contain 190. One-sided paired tests assess higher CoLE-Net performance. AUC uses paired DeLong; accuracy and binary biopsy agreement use exact McNemar; F1 and MCC use exact patient-paired prediction swaps. Spatial discriminability and reference same-sign agreement use patient swaps of the median and mean, respectively. Patients are the statistical units; folds and reference coordinates stay within patients.

`p_holm19_conditional` adjusts across 19 baselines within each endpoint/metric, and within each cohort for patient-level evaluation. The CSVs also retain the broader corrections: `p_holm105` and `p_holm3780` for conventional candidate searches, and `p_holm91` and `p_holm910` for biopsy candidate searches. Empty cells mean that a correction is not supplied for that model family. The 684- and 190-comparison corrections are also retained.

For the selected six conventional models, 178/216 patient-level and 20/60 biopsy comparisons favor CoLE-Net at Holm19-adjusted p < 0.05. Under the broader Holm105 and Holm91 candidate families, the counts are 175/216 and 6/60. These adjustments address the stated search families; independent confirmation requires new data. Biopsy DeLong estimates use small endpoint-specific samples.
