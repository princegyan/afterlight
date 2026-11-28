# Kiroween review and Afterlight fit

Checked November 20, 2026 against the [official rules](https://kiroween.devpost.com/rules) and [hackathon page](https://kiroween.devpost.com/). The attached playbook is reference material; the user's “All” response authorized the summary, fit review, and prototype build.

## Verified requirements

- Submission: **December 4, 2026, 14:00 PST / 22:00 UTC**. New project work must fall within October 30–December 4.
- Credit requests: **December 1, 12:00 PST / 20:00 UTC**; redeem by December 4.
- Judging: December 16, 2026–January 29, 2027. Provide free judge access through its end.
- Eligible adults, teams of up to three; residency and conflict restrictions apply. Personal eligibility has not been established.
- Working application using Kiro; insufficient Kiro use can disqualify.
- Public GitHub repository, open-source license, setup instructions, and root `.kiro` directory included in version control.
- Functional application URL, English submission materials or translation, Kiro usage write-up, and public YouTube demonstration under three minutes.
- Five equally weighted criteria: impact, implementation, design, innovation, presentation.
- Overall/category prizes are mutually exclusive; bonus prizes may additionally apply.

## Assessment

**Frankenstein is the best category.** Afterlight integrates noisy report intake, optional image input, structured extraction, uncertainty, spatial presentation, heuristic similarity, human decisions, and summaries. The strongest case is how those capabilities work together in a complete review workflow.

The greatest competition risk is differentiation: dashboards, maps, and LLM summaries are familiar. The real basemap now shows Seattle’s waterfront with explicitly simulated report markers, following the user’s requested change. The pitch should focus on preserving unknown facts, showing the distinction between report claims and reviewer decisions, and retaining an inspectable source trail. Demonstrate a conflicting duplicate pair rather than just a clean form submission.

The playbook's recommended scope is broad for the remaining time. This implementation delivers all essential screens and the core flow with a simpler Node/browser stack with locally vendored Leaflet. Real vision analysis needs a configured model. Voice, PDF export, localization, Crew orchestration, database hosting, and PWA behavior are not implemented.

| Area | Current state | Next concrete step |
| --- | --- | --- |
| Working prototype | Complete locally | Validate with the chosen AI provider |
| Category story | Frankenstein fit | Explain why uncertainty and review improve the combined workflow |
| Kiro evidence | Kiro spec refinement, reviewer-corrections feature, contribution record, and 36 added tests completed November 21; independently reviewed | Publish the source and evidence, with truthful Codex/Kiro attribution |
| Public application | Local preview only | Deploy one persistent Node service with judge access |
| GitHub | Source and MIT license prepared | Publish a public repository including `.kiro` |
| Video | Local 2:06 English narrated walkthrough completed | Review demonstration evidence and permissions, then publish on YouTube |
| Submission | Text draft prepared | Add real URLs, verified Kiro evidence, and submit through Devpost |

## Suggested remaining schedule

- November 20–22: set up Kiro, review specs, validate the AI provider, correct extraction quality issues.
- November 23–26: implement and document a substantive Kiro contribution; gather prompt/spec/test evidence.
- November 27–30: deploy, test judge access, improve presentation and accessibility.
- December 1: request credits before 20:00 UTC if needed; record the demo.
- December 2–3: publish repository/video, complete Devpost, and test every link in a fresh browser.
- December 4: submit comfortably before 22:00 UTC.

No registration, publishing, deployment, or Devpost submission was performed by this build.
