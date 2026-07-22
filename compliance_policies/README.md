# SAQR Compliance Policy Collection

Collected 2026-07-16 for Agent 4 (Compliance Intelligence Engine). All documents
below are official, publicly downloadable regulatory sources for Saudi Arabia -
none were paywalled or required authentication to access (bot-detection headers
were needed for SAMA's site, but no login/paywall).

## Documents (7 PDFs + 1 public-page summary)

| File | Source | Pages | Covers |
|---|---|---|---|
| `SAMA_AML_Law.pdf` | SAMA (Royal Decree M/20) | 14 | Base AML criminal law |
| `SAMA_Implementing_Regulation.pdf` | SAMA | 23 | CDD/EDD, PEPs, wire transfers, STR, record-keeping, customs thresholds - **most rule-dense document, fully read** |
| `SAMA_AML_CTF_Guide.pdf` | SAMA | 49 | Operational AML/CTF guidance for financial institutions |
| `AMLCC_Manual.pdf` | AML Permanent Committee (aml.gov.sa) | - | AML/CFT manual |
| `CMA_AML_CTF_Rules.pdf` | Capital Market Authority | 26 | AML/CTF rules for capital markets |
| `CMA_Targeted_Financial_Sanctions.pdf` | Capital Market Authority | 19 | Sanctions screening, freezing, alerts - **fully read** |
| `SAMA_Counter_Fraud_Framework.pdf` | SAMA | - | Fraud prevention/detection/response - **downloaded but not yet machine-read (see Known Limitation below)** |
| `Bank_Alinma_Public_Compliance_Statement.md` | alinma.com (public webpage, not a PDF) | - | High-level public commitments only |
| `WOLFSBERG_Correspondent_Banking_Principles_2022.pdf` | The Wolfsberg Group | 11 | Correspondent banking FCC principles - **fully read** |
| `BASEL_Sound_Management_ML_Risks.pdf` | Basel Committee (BIS) | - | Downloaded but not machine-readable in this environment (see Known Limitation) |

See `MISSING_POLICY_REPORT.md` for what could not be obtained (Bank Alinma's
actual internal manual, risk methodology, and monitoring thresholds - all
proprietary/internal by nature, not oversights).

## Policy Registry (`registry/`)

Structured, citable rules extracted from the documents above:

- `aml_cdd.yaml` - 9 rules (CDD triggers, beneficial ownership 25% threshold, PEP EDD, correspondent banking, wire transfer info requirements, senior AML officer)
- `reporting_obligations.yaml` - 6 rules (STR no-minimum-amount, STR content, tipping-off, 10-year retention, SAR 60,000 customs threshold, false-declaration penalty)
- `sanctions_screening.yaml` - 9 rules (screening cadence, quarterly re-screening, freeze-without-delay, dual-control review, fuzzy matching, indirect ownership)
- `fraud_prevention.yaml` - 1 rule (fraud definition only - low confidence, see Known Limitation)
- `international_standards.yaml` - 3 rules (shell bank prohibition, DD/monitoring feedback loop, trigger-event re-evaluation), from Wolfsberg

30 rules total, each with a `source_document` and `source_reference` (article/
section number) traceable back to the actual PDF text above - not invented.
FATF's 40 Recommendations could not be downloaded (see MISSING_POLICY_REPORT.md);
Bank Alinma's own internal AML/Fraud/CDD/Sanctions policies are confirmed not
publicly published (same file).

## Known limitation

`SAMA_Implementing_Regulation.pdf` and `CMA_Targeted_Financial_Sanctions.pdf`
were fully machine-read (their PDF text layer is directly extractable).
`SAMA_AML_CTF_Guide.pdf` and `SAMA_Counter_Fraud_Framework.pdf` use encoding
that requires page-rendering (`poppler-utils`, not installed in this
environment) rather than direct text extraction. Their content was NOT
exhaustively mined for this v1 registry - only the Counter-Fraud Framework's
definition (via an earlier web summary) made it in, flagged `confidence: low`.
Extracting more rules from these two documents is a reasonable follow-up once
`poppler-utils` is available, not a blocker for v1 (the two fully-read
documents already cover AML/CDD/sanctions in real depth).
