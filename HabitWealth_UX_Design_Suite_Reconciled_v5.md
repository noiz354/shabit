# HabitWealth Product & UX Design Suite

**Status:** reconciled draft for validation  
**Version:** 5.0  
**Last updated:** 19 Sep 2026  
**Primary audience:** Product Manager, Product Designer, UX Researcher, Tech Lead, QA, Security, and Legal/Compliance

---

## 1. Purpose

This is the canonical, executable document for designing HabitWealth, a mobile product that combines habit tracking and personal money tracking. It replaces the earlier conversational drafts, audit rounds, and scattered patches.

This suite is intended to produce reviewable product artifacts—not to manufacture certainty. Any AI-generated legal conclusion, provider capability, security claim, market statistic, or platform-policy statement must be independently verified before implementation or release.

### Intended outcomes

1. A coherent product scope and information architecture.
2. End-to-end user journeys and screen specifications.
3. Explicit empty, loading, offline, error, permission-denied, and recovery states.
4. Consistent design tokens, content rules, analytics events, and data concepts.
5. Traceability from product requirement to screen, event, acceptance criterion, and release phase.
6. A clear handoff package for engineering and QA.

### Not decided by this document

- Whether direct bank/e-wallet connectivity is technically or commercially available in Indonesia.
- Whether HabitWealth may initiate or hold funds.
- The final backend, mobile, analytics, or identity stack.
- Final interpretation of UU PDP, OJK/Bank Indonesia rules, or store policies.
- Pricing, premium entitlements, and launch markets.

Those items remain decision gates and must not be silently assumed by an AI tool.

---

## 2. Product framing

### 2.1 Product hypothesis

Users may benefit from seeing daily behavior and everyday spending in one place, provided the product remains simple, respectful, and transparent about what it can infer. HabitWealth should help users act—not shame them, diagnose them, or claim causation from correlation.

### 2.2 Initial audience hypothesis

Urban Indonesian adults who already use mobile banking/e-wallets and want lightweight support for routines and personal budgeting. The initial range of 22–35 years is a research hypothesis, not an exclusion rule.

### 2.3 Core jobs to be done

- “Help me remember and complete a small set of habits.”
- “Help me understand where my money went without excessive manual work.”
- “Show useful relationships between my routines and spending without judging me.”
- “Let me control connections, notifications, privacy, and deletion.”

### 2.4 Product principles

1. **Progress before complexity:** the first session should deliver one clear success.
2. **Manual-first, integration-optional:** every core workflow must remain useful without external connections.
3. **Progressive disclosure:** request data and permissions only when a user invokes the relevant feature.
4. **No financial coercion:** avoid penalties, guilt, dark patterns, or forced transfers.
5. **Explain uncertainty:** show data freshness, source, confidence, and correlation limitations.
6. **User control:** connections, reminders, personalization, export, and deletion are reversible or clearly explained.
7. **Accessible by default:** accessibility is part of acceptance, not a later polish phase.

---

## 3. Decision register

| ID | Topic | Current position | Status / owner |
|---|---|---|---|
| D-01 | Initial platforms | iOS and Android; shared concepts, platform-native behavior | Proposed — Product/Tech |
| D-02 | Launch scope | Manual habit + manual money tracking first; integrations gated by feasibility | Proposed — Product |
| D-03 | External health data | Optional, read-only where supported, requested in context | Validate — Tech/Privacy |
| D-04 | Bank/e-wallet data | Do not name a provider or promise coverage until verified | Open — Partnerships/Tech |
| D-05 | Money movement | Out of scope by default; use a savings goal/virtual allocation, not an actual transfer | Guardrail — Legal/Product |
| D-06 | Monetization | Freemium is a hypothesis; pricing and entitlements require validation | Open — Business |
| D-07 | Correlation insight | Descriptive insight only; never imply causation or financial advice | Accepted guardrail |
| D-08 | Data retention/deletion | Define from verified legal and operational requirements | Open — Privacy/Legal |
| D-09 | Technology stack | Must be chosen through an architecture decision record | Open — Tech Lead |
| D-10 | Product name | “HabitWealth” is a working name; trademark/domain checks pending | Open — Founder/Legal |

No downstream prompt may convert an **Open** or **Validate** item into a fact.

---

## 4. Scope and release slices

### MVP / Release 1 — prove daily value

- Email/social sign-in as supported; passkey may be added if identity architecture supports it.
- Create, edit, complete, pause, and archive habits.
- Manual income/expense entry, categories, budgets, and transaction history.
- Combined dashboard with minimal summary.
- Local reminders and a notification preference center.
- Settings, privacy controls, export request, and account deletion request.
- Offline read and queued writes for supported actions.
- Accessibility, analytics, error recovery, and support entry point.

### Release 1.1 — reduce manual work

- Verified health-data connection.
- Verified financial-data connection where feasible.
- Sync health, freshness indicators, reconnect flow, and category correction.
- Home-screen widget if justified by usage research.

### Release 2 — differentiated insight

- Routine-versus-spending descriptive insights with minimum data thresholds.
- Savings goal or virtual allocation linked to habit completion.
- Optional premium tier, sharing, or referral only after validation.

### Explicitly out of MVP

- Holding customer funds.
- Initiating bank transfers or auto-debits.
- Investment, credit, medical, or financial advice.
- AI autonomous actions on financial accounts.
- Claims that a habit causes a financial outcome.

---

## 5. Global contract for every AI run

Paste **P00** at the beginning of a new AI workspace. Attach the latest approved upstream artifacts named in each prompt. Do not rely on conversation memory alone.

### P00 — Project operating contract

```text
You are a cross-functional product-design team working on HabitWealth, a mobile
habit and personal-money tracker for an initial Indonesian market hypothesis.

Your task is to produce reviewable product artifacts. Do not invent legal
requirements, provider coverage, API behavior, security guarantees, market
statistics, research findings, or approved business decisions.

GLOBAL RULES
1. Treat the supplied Decision Register as authoritative. Mark unresolved items
   as ASSUMPTION, OPEN QUESTION, or NEEDS VERIFICATION.
2. Manual workflows must work without health, bank, e-wallet, or internet
   integrations. External connections are optional and contextual.
3. Do not design money movement, custody, auto-debit, or transfers unless a
   verified capability and approved legal model are supplied.
4. Use Indonesian UI copy. Use English technical terms only when they improve
   precision. Use Rp10.000, 19 Sep 2026, and 07.30.
5. Design for iOS and Android. State platform divergence only when material;
   do not prescribe framework APIs unless asked.
6. Meet WCAG 2.2 AA intent: sufficient contrast; scalable text; visible focus;
   non-color cues; clear labels; reduced-motion alternative; target sizes aligned
   with platform guidance.
7. Every screen specification must include purpose, entry/exit, hierarchy,
   primary/secondary action, states, permissions/data used, analytics events,
   accessibility notes, privacy/security notes, and MVP phase.
8. Mandatory states when relevant: first-use, returning, loading, empty,
   partial data, offline, stale data, permission denied, integration expired,
   validation error, service error, retry, and success.
9. Avoid shame, fear, fabricated urgency, misleading defaults, preselected
   optional consent, confirm-shaming, and causal claims from correlation.
10. Keep identifiers consistent: screens PascalCase, events snake_case,
    components kebab-case, requirements HW-AREA-NNN.
11. Finish every output with: assumptions, open questions, inconsistencies,
    decisions required, and self-check results.
12. If an upstream artifact conflicts with this contract, flag the conflict
    instead of silently resolving it.

Confirm with: “HabitWealth operating contract loaded.” Then wait.
```

---

## 6. Canonical artifact map and execution order

| Phase | Prompt | Artifact | Required inputs | Approval gate |
|---|---|---|---|---|
| 0 | P01 | Product brief & assumptions | This document §§2–4 | Product |
| 0 | P02 | Research plan & journey hypotheses | P01 | Research/Product |
| 1 | P03 | IA, navigation & screen inventory | P01–P02 | Product/Design |
| 1 | P04 | Design system baseline | P01, P03 | Design/Engineering |
| 1 | P05 | Analytics measurement plan | P01, P03 | Product/Data |
| 1 | P06 | Conceptual data & privacy map | P01, P03 | Tech/Privacy |
| 2 | P07 | Auth, consent & onboarding | P03–P06 | Design/Security/Privacy |
| 2 | P08 | Habit experience | P03–P07 | Product/Design |
| 2 | P09 | Money experience | P03–P07 | Product/Design/Privacy |
| 3 | P10 | Combined insights & savings goal | P08–P09 | Product/Legal |
| 3 | P11 | Notifications & re-engagement | P05, P07–P10 | Product/Design |
| 3 | P12 | Settings, support & lifecycle | P03–P11 | Privacy/Support |
| 4 | P13 | Technical handoff & NFRs | All approved product artifacts | Tech Lead |
| 4 | P14 | QA, traceability & go/no-go | P01–P13 | QA/Full team |
| 5 | P15 | Store listing & launch package | Approved MVP only | Marketing/Legal |

### Dependency rules

- P03 is the source of truth for screens and navigation.
- P04 is the source of truth for visual and component tokens.
- P05 is the source of truth for analytics names and definitions.
- P06 is the source of truth for conceptual data sensitivity and flows—not a database schema.
- New screens, events, or sensitive data introduced downstream require an upstream revision.
- Each artifact must show version, date, status, owners, inputs, and change log.

---

## 7. Copy-paste prompt suite

### P01 — Product brief, scope, and decision backlog

```text
Using P00 and the supplied Decision Register, create a concise product brief.

Deliver:
1. Problem statement and product hypothesis.
2. Primary jobs to be done and non-goals.
3. MVP, Release 1.1, and Release 2 capability table.
4. Outcome metrics with baseline marked UNKNOWN where unavailable.
5. Assumption map: desirability, viability, feasibility, usability, compliance.
6. Decision backlog with owner, evidence needed, deadline, and impact.
7. Risks and mitigations.

Do not invent research evidence, provider availability, pricing, or legal approval.
Use requirement IDs HW-PRD-001 onward. End with explicit scope acceptance criteria.
```

### P02 — Research plan and journey hypotheses

```text
Create a research plan before treating personas or journeys as facts.

Deliver:
1. Proto-personas representing: new/manual user, returning/integrated user,
   privacy-sensitive user, accessibility need, and disengaging user.
2. Recruitment criteria and exclusions; do not limit only to age.
3. Interview guide and task-based usability test plan.
4. Hypothesis journey across discovery, evaluation, first use, first value,
   daily use, failure/recovery, re-engagement, and exit/deletion.
5. Table: phase, goal, action, channel, emotion hypothesis, barrier, opportunity,
   evidence status, and product requirement.
6. Research questions for trust, manual entry burden, notifications, integrations,
   combined insights, and willingness to pay.

Label every persona and journey claim as a hypothesis until validated. Provide a
sample size rationale without claiming statistical representativeness for
qualitative research. Use IDs HW-RES-001 onward.
```

### P03 — Information architecture, navigation, and screen inventory

```text
Create the canonical information architecture based on the approved product brief
and research hypotheses.

Deliver:
1. Top-level navigation options with rationale and trade-offs; recommend one.
2. Hierarchical IA with maximum practical depth and platform considerations.
3. Screen inventory table: Screen ID, name, purpose, entry points, exits, user
   state, data sensitivity, release phase, and linked requirement IDs.
4. Route/deep-link taxonomy at the product level; do not bind it to an unchosen
   framework.
5. Navigation flows for first value, daily habit completion, manual transaction,
   sync recovery, privacy controls, and account deletion.
6. Orphan-screen, duplicate-screen, and unreachable-state check.

Include Auth, Home, Habit, Money, Insights, Notifications, Settings, Support,
Privacy, and optional Subscription. Do not add an integration screen unless the
related capability is explicitly feasible or marked conditional.
```

### P04 — Design system baseline

```text
Define an implementation-neutral design-system baseline that supports the approved
IA. Do not invent final brand identity.

Deliver tokens for color roles, typography, spacing, radius, elevation, motion,
iconography, and data visualization. Define light, dark, high-contrast, reduced-
motion, and large-text behavior. Define component contracts and states for buttons,
inputs, cards, navigation, list rows, progress, charts, dialogs, sheets, toast,
banners, skeletons, connection status, and sensitive-value masking.

For each component include anatomy, variants, states, behavior, accessibility,
content limits, and platform differences. Provide token tables and a machine-
readable JSON-like appendix. Validate contrast instead of merely asserting it.
Use semantic tokens; no feature prompt may hardcode colors.
```

### P05 — Measurement and analytics plan

```text
Create a privacy-conscious measurement plan tied to product outcomes.

Deliver:
1. Metric tree: activation, engagement, retention, trust/reliability, and business.
2. Event dictionary with name, exact trigger, exclusions, properties, owner,
   platform, requirement ID, and validation method.
3. Funnel definitions for first habit, first manual transaction, optional
   connection, and recovery from sync failure.
4. Experiment guardrails and exposure events.
5. Data-quality checks: duplicate events, offline queue, clock skew, and retries.
6. Consent and data-minimization notes.

Do not include name, email, raw account identifier, transaction description, habit
title, health values, or other sensitive payloads in analytics unless explicitly
approved. Avoid vanity events. Mark vendor choice as OPEN if not decided.
```

### P06 — Conceptual data, privacy, and integration map

```text
Create a conceptual domain and privacy model—not a prematurely fixed database
schema.

Model User, Consent, Habit, HabitEntry, FinancialAccount, Transaction, Category,
Budget, SavingsGoal, Connection, SyncRun, NotificationPreference, and AuditRecord.

For each concept provide purpose, minimal attributes, source, sensitivity class,
retention question, user controls, relationships, and lifecycle. Add data-flow
diagrams for manual entry, health sync, financial sync, export, and deletion.
Document source-of-truth, conflict handling, idempotency need, stale-data behavior,
revocation, and deletion propagation.

Never store raw credentials or biometric templates. Do not prescribe Firestore,
SQL, encryption algorithms, or retention periods without an approved architecture
or policy. Produce a list of privacy/security decisions requiring specialist review.
```

### P07 — Authentication, consent, permissions, and first-use onboarding

```text
Design the route from launch to first completed habit in under three minutes for
the happy path, while providing accessible alternatives.

Cover splash/restore session, sign-up/sign-in, account recovery, optional passkey,
consent choices, contextual permission primers, first habit creation, first
completion, and returning-user entry. Separate legal acknowledgement from optional
data permission. Do not preselect optional consent.

For every screen provide the standard screen contract from P00. Include denied,
restricted, unavailable, cancelled, expired session, duplicate account, offline,
and recovery states. Ask for a system permission only immediately after the user
chooses a feature that requires it. Do not promise end-to-end encryption or claim
biometric data behavior beyond verified platform architecture.

Finish with the exact handoff event into the main experience and a P03/P05/P06
consistency check.
```

### P08 — Habit tracking experience

```text
Design the complete manual-first habit experience.

Cover Today list, create/edit, schedule, goal type, completion/undo, partial
progress, pause/archive/delete, history, reminder configuration, templates, and
conditional external-data connection. Include first-use and returning states.

Specify interaction behavior without hiding essential actions behind gestures.
If gestures or haptics are proposed, provide visible alternatives and reduced-
motion behavior. Define streak semantics, timezone/day-boundary rules, late entry,
missed day, travel, conflicting device updates, imported data, and correction.

For integration, show source, last successful sync, freshness, permission state,
manual override policy, duplicate-data handling, partial sync, retry, revoke, and
reconnect. Do not assume a named health provider. Include acceptance criteria and
trace each screen to P03, event to P05, and data concept to P06.
```

### P09 — Money tracking experience

```text
Design the complete personal money-tracking experience with manual entry as the
baseline and account sync as a conditional enhancement.

Cover overview, add income/expense/transfer record, transaction list/detail,
category correction, budget setup/status, search/filter, recurring entry, account
connection, connection status, reconnect, and disconnect.

Define masking, reveal/re-auth behavior, source and freshness labels, pending vs
posted transactions, duplicates, refunds, internal transfers, split transactions,
cash, unknown category, multi-currency as future scope, offline edits, partial sync,
provider outage, expired authorization, and stale balance.

Do not promise bank/e-wallet coverage or OAuth. Use “verified data-connection
partner” conditionally. Do not label access read-only until the actual permission
scope is verified. Include destructive-action confirmation and non-color status
cues. Trace screens, events, and data to P03/P05/P06.
```

### P10 — Combined insights and savings goal

```text
Design the differentiated experience without initiating or holding money.

Cover an opt-in combined-insight setup, weekly/monthly summary, explanation of data
sources and confidence, insufficient-data state, correction/feedback, and a virtual
savings goal that records intended allocation rather than moving funds.

Requirements:
- Never claim that a habit caused a spending outcome.
- Show minimum data threshold and missing-data effect.
- Explain calculation in plain language and provide “Why am I seeing this?”
- Allow users to hide a sensitive insight and disable the feature.
- Avoid penalties, guilt, forced celebration, or misleading balances.
- If actual money movement is ever proposed, stop and list the legal, partner,
  authorization, reconciliation, dispute, idempotency, and recovery decisions that
  must be approved before designing it.

Provide alternative visualizations for low data volume and screen-reader summaries
for every chart. Trace all artifacts to upstream sources.
```

### P11 — Notifications and re-engagement

```text
Design a user-controlled notification system.

Deliver notification preferences, in-app inbox if justified, reminder scheduling,
quiet hours, timezone behavior, notification templates, deep-link targets, and
analytics mapping. Cover habit reminder, budget threshold, connection failure,
weekly summary, and security/account notices.

For each notification define trigger, eligibility, priority, channel, copy,
frequency cap, suppression rule, deep link, expiry, event, and user control.
Security notices must not be suppressible when operationally required; marketing
must remain separate and optional. Avoid guilt, sensitive lock-screen content, and
fabricated urgency. Define behavior for denied permission, disabled OS channel,
travel, duplicate delivery, stale notification, and opened-on-another-device.
```

### P12 — Settings, support, privacy, and account lifecycle

```text
Design Settings as a control center, not a dumping ground.

Cover profile, appearance, accessibility preferences, notification preferences,
connected services, consent history, privacy dashboard, data export request,
account deletion request, active sessions/devices if supported, subscription link
if applicable, help center, report a problem, legal documents, app version, and
open-source notices.

Specify identity re-verification, confirmation, progress, cancellation window only
if policy requires it, completion notice, and failure/retry for export and deletion.
Do not invent a 14-day deletion delay or cite a law section unless verified by
legal counsel. Explain what is deleted, retained, or controlled by a third party.
Include accessibility and low-connectivity paths and trace to P03/P05/P06.
```

### P13 — Engineering handoff and non-functional requirements

```text
Convert the approved product artifacts into an implementation handoff without
choosing unapproved technologies.

Deliver:
1. Capability map and bounded contexts.
2. State machines for auth, habit completion, connection, sync, export, deletion,
   and any queued operation.
3. API/service contracts at the semantic level, including idempotency and errors.
4. Offline/cache/conflict strategy options and recommendation.
5. Security and privacy threat scenarios for sensitive screens and data flows.
6. Observability requirements: logs, metrics, traces, audit events, redaction.
7. Performance budgets with measurement method and test environment—not arbitrary
   guarantees.
8. Accessibility implementation checklist.
9. Architecture decision records still required.

Separate product requirements from architecture recommendations. Identify every
place where a provider, policy, or legal decision blocks implementation.
```

### P14 — QA, traceability, and go/no-go

```text
Build a verification package from P01–P13.

Deliver:
1. Traceability matrix: requirement → screen → event → data concept → test → phase.
2. Acceptance criteria per capability using Given/When/Then.
3. Test matrix: happy path, validation, empty, offline, stale, partial success,
   permission denied, authorization expired, accessibility, localization, privacy,
   security, performance, and recovery.
4. Cross-platform differences that need separate testing.
5. Kill criteria and release blockers.
6. Go/no-go checklist with evidence link, owner, status, and waiver approver.

Never mark an item PASS without supplied evidence. Use NOT TESTED, BLOCKED, FAIL,
or PASS. High-risk kill criteria include exposed sensitive values, irreversible
action without confirmation, missing deletion path, misleading connection status,
duplicate money records, inaccessible primary flow, and invented provider/legal
claims.
```

### P15 — Store listing and launch package

```text
Create a launch package using only features approved for the target release.

Deliver app-name working options, subtitle/short description, long description,
keyword hypothesis, screenshot storyboard, preview-video storyboard, icon brief,
privacy/support URL checklist, review notes, release notes, and localization plan.

Separate iOS and Android requirements and label all limits/policies as NEEDS CURRENT
VERIFICATION unless official current documentation is attached. Do not fabricate
ratings, testimonials, awards, partner logos, provider coverage, health outcomes,
financial outcomes, or “best/#1” claims. Use obviously fictional demo data and no
real personal information. Include a claim-evidence register and final legal/store
review checklist.
```

---

## 8. Standard screen contract

Every screen-level output from P07–P12 must use this template:

| Field | Required content |
|---|---|
| Screen identity | Screen ID, canonical name, artifact version |
| Purpose | One user outcome; no feature-list prose |
| Entry / exit | All valid entry points, back behavior, success/failure exits |
| Hierarchy | Header, body, primary action, secondary actions, system feedback |
| Data | Displayed/collected data, source, sensitivity, freshness |
| States | Relevant mandatory states from P00 |
| Rules | Validation, limits, calculations, permission dependencies |
| Accessibility | Reading order, labels, focus, large text, contrast, motion |
| Privacy/security | Masking, re-auth, consent, redaction, screenshot risk |
| Analytics | Approved event names and exact triggers |
| Traceability | Requirement IDs and upstream artifact references |
| Delivery | MVP phase, tier if approved, dependencies, open questions |

---

## 9. Quality gates

### Gate A — Product clarity

- Scope, non-goals, and release slice approved.
- No open decision is presented as fact.
- Manual fallback exists for every core value proposition.
- Success metrics have definitions and owners.

### Gate B — Experience coherence

- Every screen exists in P03 and is reachable.
- First-use and returning experiences are distinct.
- Error, offline, stale, denied, and recovery states are designed.
- Copy is consistent, respectful, and localized.
- Accessibility review has evidence, not a generic “WCAG compliant” claim.

### Gate C — Data, privacy, and security

- Sensitive data has a documented purpose, source, control, and retention decision.
- Consent and permission are distinct and contextual.
- Revocation, export, deletion, and third-party disconnection are covered.
- No secrets, raw credentials, biometrics, or unnecessary sensitive payloads enter analytics/logs.
- External provider and legal claims are verified by named owners.

### Gate D — Implementation readiness

- State machines and contracts cover retries, idempotency, partial success, and conflict.
- Performance targets have measurement methods.
- Observability and redaction requirements are defined.
- Architecture decisions and blockers are explicit.
- Traceability matrix has no unexplained gaps.

### Gate E — Release readiness

- QA evidence supports every P0 acceptance criterion.
- Store claims match the implemented build.
- Privacy/support/legal destinations are live and current.
- Rollout, monitoring, rollback, incident, and support plans exist.
- Product, Design, Tech, QA, Privacy/Security, and Legal/Compliance have signed off within their scope.

---

## 10. Kill criteria

Reject or regenerate an artifact when any of the following occurs:

1. It invents provider coverage, legal obligations, research evidence, or approved pricing.
2. It requires bank/health integration for basic use.
3. It designs real money movement without an explicitly approved operating model.
4. It exposes full sensitive financial data by default or in notifications/analytics.
5. It omits permission-denied, stale-data, offline, or recovery behavior where relevant.
6. It uses shame, penalties, forced consent, hidden cancellation, or confirm-shaming.
7. It claims causality from a behavioral/financial correlation.
8. It introduces screens, events, or sensitive data without updating the upstream source of truth.
9. It claims compliance or test success without evidence.
10. It cannot be traced to a requirement and release phase.

---

## 11. Recommended working cadence

### Week 1 — foundation

- Approve P01 and run initial P02 research planning.
- Produce P03–P06 in parallel only after scope is stable.
- Hold Gate A/B review; record decisions and update versions.

### Week 2 — core experience

- Run P07, then P08 and P09.
- Validate core tasks with representative users before polishing breadth.
- Update P03–P06 when testing changes the model.

### Week 3 — extension and lifecycle

- Run P10–P12 only for approved release capabilities.
- Hold privacy/security and legal feasibility review for integrations and insights.

### Week 4 — handoff and release planning

- Run P13, then P14.
- Resolve blockers before P15.
- Create the store package from the implemented and verified build, not aspirational designs.

The schedule is a planning baseline, not a promise. Integration feasibility, research recruitment, and compliance review can change it materially.

---

## 12. Final reconciliation notes

This version deliberately changes several earlier proposals:

- “Grounding” is replaced with integration/synchronization terminology.
- Named open-banking providers are removed until support is verified.
- “Saving Streak auto-transfer” is replaced by a virtual/intended savings goal by default.
- “Celengan balance” is not presented as held money.
- Firebase, React Native, and Mixpanel are not treated as final architecture decisions.
- Specific deletion periods and legal-section claims are removed pending legal review.
- “End-to-end encryption” is not used as generic UX copy.
- Arbitrary push caps, sync intervals, token-expiry periods, and performance guarantees are replaced by decisions or measurable requirements.
- The previous 15 prompts are restructured so foundation artifacts constrain downstream work.
- Audit history and repeated patches are removed; this document contains only the reconciled version.

**Definition of done for this document:** stakeholders can run the prompt suite without reading earlier drafts, can distinguish fact from assumption, and can trace every implemented capability to an approved requirement and verification result.
