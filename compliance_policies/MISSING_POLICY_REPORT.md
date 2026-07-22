# Missing Policy Report

Generated 2026-07-16 as part of Agent 4 (Compliance Intelligence Engine) policy
collection. Everything below was searched for specifically and confirmed
unavailable for public download — not skipped for convenience.

---

## Missing Policy Report

**Document:** Bank Alinma Internal AML/CFT Policy & Procedures Manual
**Organization:** Bank Alinma (مصرف الإنماء)
**Website:** https://alinma.com
**URL:** No direct URL exists — checked the bank's official Compliance & Anti-Financial
Crimes Division page (https://alinma.com/en/About-the-Bank/The-Bank/Complaince-and-Anti-Financial-Crimes-Division).
The only downloadable documents linked from that page are a USA PATRIOT Act
Certificate and a W-8BEN-E tax form — neither is a policy manual.
**Reason:** Internal document — not published. Bank Alinma discloses only a
high-level public summary of its compliance commitments (captured in
`Bank_Alinma_Public_Compliance_Statement.md`), not its actual policy manual,
which would contain proprietary detection logic and internal procedures.

---

**Document:** Bank Alinma Customer Risk Classification / Risk Rating Methodology
**Organization:** Bank Alinma
**Website:** https://alinma.com
**URL:** Not found — no public page or document describes the bank's specific
risk-scoring criteria or thresholds.
**Reason:** Internal/proprietary — banks do not publish exact customer risk
classification methodologies, as this would let bad actors reverse-engineer
detection thresholds.

---

**Document:** Bank Alinma Transaction Monitoring Scenarios & Thresholds
**Organization:** Bank Alinma
**Website:** https://alinma.com
**URL:** Not found.
**Reason:** Internal/proprietary — no financial institution publishes its
specific transaction-monitoring rule thresholds (e.g. exact SAR amounts that
trigger alerts) for the same reason as above: publishing them would defeat
their purpose.

---

## Note on sourcing choices (not a failure, documented for transparency)

The **Anti-Money Laundering Law** is available from two official sources:
SAMA's own republication (`SAMA_AML_Law.pdf`, used here) and the Ministry of
Justice legislation portal (https://laws.moj.gov.sa/en/legislation/zVhz8SdpnY4VthFalSYDlA).
Both are official; SAMA's copy was used since the rest of the collection is
SAMA-sourced and consistently formatted. The MOJ copy was not additionally
downloaded since it is the same legal text, not a distinct document.

## Additional verification (2026-07-17, prompted by a direct question on whether
## Bank Alinma's own AML/Fraud/CDD/Sanctions policies had been found)

Before answering, re-checked three more official Bank Alinma pages specifically
for a downloadable AML/Financial-Crime/Anti-Fraud/CDD/Sanctions policy PDF:

- https://www.alinma.com/en/about-the-bank/policies-and-reports-frameworks
  — lists ESG/sustainability/governance documents only; compliance is a
  navigation link back to the Compliance & AFC Division page, not a document.
- https://www.alinma.com/en/about-the-bank/corporate-governance/corporate-governance-framework
  — lists a "Governance Manual (v4.0)" described as covering "governance
  rules, board authorities, compliance framework, and anti-corruption
  measures," but no direct download link was found for it.
- https://ir.alinma.com/en/investor-relations/about-us/corporate-governance/
  — the actual governance document repository; confirmed 6 PDFs (Dividend
  Distribution Policy, BoD Nomination Controls, Disclosure and Transparency
  Policy, Conflict of Interest Policy, Insider Trading Policy and Controls,
  Bylaws). None are AML/Fraud/CDD/Sanctions policies - all are securities-law/
  corporate-governance documents. The Governance Manual v4.0 referenced
  elsewhere is not linked from this repository either.

**Conclusion stands**: Bank Alinma does not publish a standalone AML policy,
Financial Crime policy, Anti-Fraud policy, or CDD/KYC/Sanctions policy PDF
anywhere on its public site or investor relations portal. If you want the
Governance Manual v4.0 specifically (it may contain a compliance-framework
section at board-oversight level, though this is unlikely to be operational
AML rules), it would need to be requested directly from Alinma Investor
Relations - no public URL for it was found.

## Missing Policy Report

**Document:** The FATF Recommendations (the 40 Recommendations - the global
AML/CFT standard-setter's core standards)
**Organization:** Financial Action Task Force (FATF)
**Website:** https://www.fatf-gafi.org
**URL:** https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html
(the landing page confirmed to exist and host the document - the exact PDF
download link could not be resolved)
**Reason:** The page is JavaScript-rendered - no PDF link is present in the
raw HTML, and both the fetch tool and direct requests (with browser headers)
to the site were blocked (403) or returned no extractable link. This appears
to be a technical/bot-protection barrier, not a paywall or access
restriction - the FATF Recommendations are explicitly free and public. A
person with a regular browser could very likely download this in seconds
by visiting the landing page above and clicking through.

---

## What was NOT reported as missing

No standalone "KYC Guideline" or "Customer Due Diligence Guideline" document
was found as a separate publication — SAMA folds CDD/KYC requirements into the
AML/CTF Guide and the AML Law's Implementing Regulation (Articles 5-14) rather
than publishing them separately. This is not treated as a missing document
since there is no evidence a standalone one exists; the substance is present
in `SAMA_AML_CTF_Guide.pdf` and `SAMA_Implementing_Regulation.pdf`.
