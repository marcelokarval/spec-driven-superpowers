> HISTÓRICO SUPERSEDIDO pelo mandato humano C0 de ASDS passivo (2026-10-15).
> Não operacional; não instalar/ativar. Evidência anterior preservada abaixo.

# Protected provisioning proposal — approval required, not executed

## Superseding human decision — 2026-10-15

Temporary qualification was explicitly authorized, then suspended before any
installation by the user's answer **“Somente harness atual”**. Do not execute the
separate-instance proposal below under the earlier grant. Native agents/sessions
alone do not establish its protected authority boundary; runtime qualification
remains blocked. Oracle session `ses_ec359cc34ffeZnlpy4HBwPM7Se` reviewed this
constraint read-only; the coordinator checked the protected-client requirements.
Preflight verified 27/27 candidate hashes, official version metadata availability,
free proposed paths/accounts and existing getfacl; sudo required human authentication.
No downloads, installs, accounts, network resources, credentials, model qualification
calls or services were created. There are therefore no deployment residues to remove.
Procedural human-reviewed results would be a separate limited deliverable, not /2
receipt/admission qualification; this alternative has not been executed or accepted.

This is a proposed ASDS deployment layout, not a claim that OpenCode officially
provides an ASDS authority service. Official upstream distribution and plugin APIs
are used; OS isolation and service assembly are ASDS-specific. Approving this text
must explicitly approve its parallel-installation exception and retention. No
existing user runtime, consumer project, credential or launcher is to be migrated.

## Proposed fixed target

- Linux x64 only; abort if host architecture differs. OpenCode pinned to 2.0.28,
  source contract commit `026b106bc5d41b679ffc413264229c340871e4d3`.
- Official npm distribution `@opencode/cli@2.0.28` using npm global prefix
  `/usr/local`; package `/usr/local/lib/node_modules/@opencode/cli`, installer-owned
  `/usr/local/bin/opencode` and `/usr/local/bin/opencode2`. Abort on existing paths
  or incompatible installation instead of replacing them. Method documented at
  https://opencode.ai/v2/docs . Do not modify user PATH or NVM launchers.
- Node required by ASDS is >=20.19.0; current `/usr/bin/node` 18.19.1 is insufficient.
  Proposed explicit exception: official Node 24.20.0 linux-x64 binary archive from
  https://nodejs.org/dist/v24.20.0/ installed root-owned at
  `/usr/local/lib/nodejs/node-v24.20.0-linux-x64`, no global Node symlink. Verify
  official archive/checksum/signature availability before download/install; absent
  release, unverifiable integrity or incompatible platform is a stop, not fallback.
  Invoke its `bin/node` and npm CLI by absolute path; never copy the user's NVM tree.
- Protected reviewed source payload at `/usr/local/lib/asds-review-authority`,
  root:root directories 0755/files 0644, executable scripts 0755. Include all
  transitive local imports and lockfile-pinned yaml 2.9.1; no writable checkout
  symlinks, model-writable modules, preload or environment-driven module injection.
  This custom authority payload is not an existing standard ASDS installation.
- Additional official distro package: `acl` for `/usr/bin/getfacl`, via APT after
  dependency/size preview. No distro Node replacement or unrelated upgrade.
- Capacity proposal: stop above 512 MiB newly installed runtime/payload; allow up
  to 256 MiB temporary downloads, removed after verification. Existing package is
  about 117 MiB; totals are budgets, not measured install sizes. No automatic backups.

## Principals, paths and network

- New locked system accounts `asds-review` and `asds-consumer`, no login shell,
  no sudo. Fresh non-recycled UID/GIDs allocated only after checking collisions.
  Groups `asds-review-planner` and `asds-review-consumer` are distinct; the consumer
  group contains only those two service principals. Planner access may include
  the existing coordinator user, never consumer-group access. Current process
  supplementary groups must be audited, not inferred from /etc/group alone.
- Root-owned profile `/etc/asds/review-authority.json` 0644, root-owned config
  `/etc/asds/review-opencode.json` 0644. Full TCB manifest includes effective
  executables/imports, configuration graph, agents, external plugin and official
  internal pre/post hooks. Actual loaded inventory must match, not merely files.
- `/var/lib/asds-review-authority` root:root 0755; private `store` and `opencode`
  leaves service-owned 0700, state files 0600. No client reads store bytes. Provider
  credential provision is operator-only through official OpenCode auth/config,
  inside the private service home; no values in prompts, repo, logs or approvals.
  Model/provider selection and permitted spending require operator confirmation;
  no copying the current user's credential store and no Gemini while suspended.
- `/run/asds-review-authority` root:root 0755; `planner` and `consumer` directories
  service-owned 0710 with their corresponding GIDs; `authority.sock` each 0660.
  No extended/default ACLs. The model's OS principal can access the planner socket
  but cannot access admission socket, store, auth, reviewer API or protected code.
- Named netns `/run/netns/asds-review-authority`; proposed veth names `asds-host`
  and `asds-review`, subnet `10.203.77.0/30` (.1 host/.2 service). Abort on any
  interface/subnet/routing collision. Scoped outbound NAT/established return only;
  no inbound forward or API publishing. DNS and provider egress must be explicitly
  validated; no firewall-wide flush or global policy replacement. Namespace/root
  setup is privileged, reviewer process runs with zero effective capabilities.
- Isolated OpenCode API binds **127.0.0.1:4097 inside that namespace only**:
  official CLI `opencode serve --hostname 127.0.0.1 --port 4097` (flags inspected).
  No public TCP listener. Proposed system unit
  `/etc/systemd/system/asds-review-authority.service`, dedicated HOME/location,
  protected config, namespace and absolute executable. Unit/config generation
  must pass installed schemas and systemd validation before any activation.

## Authority and qualification

Plugin entry: `adapters/opencode/review-authority/index.mjs` in the protected
payload. The plugin owns observer/issuer/verifier/store in one isolated process;
worker uses actual V2 session methods and context/tool hooks. Two distinct sessions
receive the immutable snapshot and no tools. Caller cannot submit a verdict.
Opaque /2 receipts authenticate through live protected filesystem/socket identity
and private persisted records, not signatures or caller callbacks. No PKI required.
Threat model excludes root/admin compromise and consistent administrative rollback.
The protected consumer driver executes only operator-approved code, not model shell.

After separate activation approval: initialize once using the protected provision
script; start only this service (not user's OpenCode/OpenChamber). Use a synthetic
enrollment/package under `/var/lib/asds-review-authority/qualification`, owned by
the consumer, without real consumer data. Run harness prepare with explicit new
checkpoint; inspect real sessions, deny rules and loaded plugin evidence. Operator
then restarts only this service; run reobserve from a fresh process and require a
new boot ID, same generation, live receipt verification and current valid admission.
Run negative OS probes from the model's UID for private paths/API/admission access,
plus forgery/drift/replay/cancelled-retry checks. No product task execution.

## Rollback, cleanup and retention decision

No existing service restart/reload or user launcher replacement is proposed.
On failure: stop the dedicated service, remove only its verified owned namespace,
veth and tagged network rules, disable/remove its unit; preserve state/credentials
pending explicit disposition if they contain unique data. Never erase an ambiguous
lock or store to make startup pass. Uninstall only the newly installed scoped npm
package and verified exclusive Node/payload files if no new consumer uses them.
Remove downloaded archives, temporary npm artifacts and synthetic qualification
files after sanitized evidence retention. No snapshot/backup creation. On success,
retaining this dedicated installation and its private state requires explicit
approval; it is not a temporary staging copy. Suggested qualification-only grant
permits two real review calls and one dedicated restart, not permanent activation.

Approval must name: installation exception/retention, privileged accounts/namespace/
network changes, payload/profile/unit, operator credential provision and model budget,
two-review E2E plus one restart, and cleanup disposition. These are NOT implied by
the source-implementation grant. No commands in this document have been executed.
