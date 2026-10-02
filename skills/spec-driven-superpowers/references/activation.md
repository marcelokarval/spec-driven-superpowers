# Global availability, project-local activation

ASDS skills may be installed globally for the user. Availability is not activation.
The reusable schema may live in OpenSpec's user data directory; project state
(config, specifications, changes and tasks) belongs to the selected project's
`openspec/`. A global schema directory is not an initialized project.

## Received context
For an Accelerate handoff, follow [intake](intake.md): reuse triage, references and
scoped decisions. Check gaps and inconsistencies without restarting discovery.
Acceptance does not authorize execution or initialization. Refusal records persist.

## Request gate

- Ordinary conversation, general questions, translations and explanations: answer
  directly. Do not load engineering workflows, run OpenSpec discovery, ask about
  setup, or create directories merely because skills are globally installed.
  This remains true inside a repository that already has `openspec/`.
- A bounded edit or read-only project inspection does not automatically require
  OpenSpec or the full Superpowers workflow. Use only relevant engineering skills.
- For an explicit ASDS/OpenSpec request or a suitable multi-step project change,
  identify the intended project before checking its local `openspec/` read-only.
  The shell working directory alone is not proof of the intended project.

## Project gate

1. If the intended project is unclear, clarify the target before setup or writes.
2. If `openspec/` exists, inspect its configuration and applicable project rules.
   Reuse it without overwriting configuration or asking to create it again.
   An existing directory does not authorize changes unrelated to the request.
3. If it is absent and this request warrants ASDS, ask once, naming the exact path:
   “Este projeto não tem OpenSpec. Posso criar `<project>/openspec/` para esta
   mudança, ou prefere continuar sem OpenSpec?” Wait for the answer before any
   command or file write that could create the root, including installer apply.
4. An explicit request to initialize that exact project, or an earlier affirmative
   answer in the same scope, already authorizes creation. Do not ask again.
5. Refusal means continue the authorized task without OpenSpec artifacts. Silence
   is not consent; continue only work independent of initialization while waiting.
   Do not repeatedly offer setup after refusal for the same task.
6. After authorized initialization, verify the local root and preserve the selected
   configuration. Project activation is separate from installation of global skills.

For ASDS-selected project work, perform this gate before delegating to an OpenSpec
skill. A standalone OpenSpec skill's auto-selected/no-root branch may simply fall
back to normal work; it must never initialize as a side effect. Explicitly selected
remote stores are a separate OpenSpec feature, not the default ASDS project layout.

The conversational question is an agent instruction, not an interactive feature of
`scripts/install.mjs`. That CLI previews by default; an explicit project `--apply`
request authorizes its displayed installation scope, which includes local schema
files under `openspec/` even without `--activate`. Do not invoke it implicitly.
