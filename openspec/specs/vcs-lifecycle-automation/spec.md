# vcs-lifecycle-automation Specification

## Purpose
TBD - created by archiving change automate-vcs-full-loop. Update Purpose after archive.
## Requirements
### Requirement: Automated Branch Creation
The system SHALL automatically create or switch to an `issue-N` branch when a new change is proposed if an associated GitHub Issue ID is detected.

#### Scenario: Automatic branch switch
- **WHEN** user executes `/opsx:propose` and a GitHub Issue is linked or created
- **THEN** system automatically runs `git checkout -b issue-N` and updates the proposal metadata

### Requirement: Automated PR Summary Generation
The `openspec archive` flow SHALL include a step to generate a standardized PR summary formatted for GitHub.

#### Scenario: PR Summary Output
- **WHEN** user executes `/opsx:archive`
- **THEN** system outputs a Markdown block containing: Summary, Knowledge Points, and Closure Commands (e.g., `gh pr create --body ...`)

