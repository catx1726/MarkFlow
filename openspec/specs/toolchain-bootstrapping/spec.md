# toolchain-bootstrapping Specification

## Purpose
TBD - created by archiving change automate-vcs-full-loop. Update Purpose after archive.
## Requirements
### Requirement: Toolchain Dependency Check
The `workshop-initializing` skill SHALL perform a pre-check for all mandatory tools (`gh`, `@fission-ai/openspec`).

#### Scenario: Missing Tool Discovery
- **WHEN** user executes `workshop-initializing` and `gh` is not found in the system path
- **THEN** system stops and displays the exact installation command: `winget install GitHub.cli`

### Requirement: Automated Config Patching
The initialization flow SHALL automatically merge the `openspec/config_foundry.yaml` template into the local `openspec/config.yaml`.

#### Scenario: Successful Config Patch
- **WHEN** user executes `workshop-initializing` and `openspec/config.yaml` exists
- **THEN** system merges Foundry `context`, `rules`, and `skills` while preserving project-specific fields

