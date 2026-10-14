#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { planInstall, planUninstall, applyInstall, installPlanSha256 } from '../lib/install.mjs';

try {
  const { values } = parseArgs({ options: {
    scope: { type: 'string' }, target: { type: 'string' },
    'data-home': { type: 'string' }, 'skills-dir': { type: 'string' }, apply: { type: 'boolean' },
    activate: { type: 'boolean' }, rules: { type: 'boolean' }, help: { type: 'boolean' },
    update: { type: 'boolean' }, uninstall: { type: 'boolean' }, 'reconcile-shared': { type: 'boolean' },
    'adopt-legacy-manifest-sha256': { type: 'string' },
    'expect-plan-sha256': { type: 'string' },
  } });
  if (values.help) {
    console.log('Usage: node scripts/install.mjs --scope project|user --target DIR [--data-home DIR] [--skills-dir RELATIVE_DIR] [--activate] [--rules] [--update | --uninstall] [--adopt-legacy-manifest-sha256 HEX] [--expect-plan-sha256 HEX] [--reconcile-shared] [--apply]\nPreview is the default. The official payload installs the planning skill and its sibling execution consumer, including the consumer runtime and synthetic examples, in the selected skills directory. Native AGY profiles also install three planning-only custom agents in the official project or user agent root: coordinator subagent, nested zero-write reviewer subagent, and primary-only zero-write capture reviewer. They publish two manifest-owned review contracts: nested dispatch (unavailable) and headless capture (untrusted, completion unavailable), plus the ASDS capability marker. --update replaces unchanged manifest-owned files and removes unchanged source-registered tombstones only inside that harness skill root. A format-1 receipt can migrate only with --update plus --adopt-legacy-manifest-sha256 bound to its exact bytes; preview prints a canonical plan SHA-256 and the separate --apply must repeat it with --expect-plan-sha256. User adoption may update changed shared payload directly only when no sibling manifests exist; with siblings, --reconcile-shared is required and validates every receipt atomically. --uninstall removes only the exact current official manifest inventory (plus registered tombstones), including exact hash/mode/type/link metadata, and preserves shared files owned by another installed profile. Older receipts that differ from the current payload require a verified --update first. User schemas use OpenSpec XDG_DATA_HOME. No global npm installation.');
  } else {
    if (values.update && values.uninstall) throw new Error('--update and --uninstall are mutually exclusive');
    if (values.uninstall && (values.activate || values.rules || values['reconcile-shared'] || values['adopt-legacy-manifest-sha256'])) {
      throw new Error('--uninstall cannot be combined with --activate, --rules, --reconcile-shared or --adopt-legacy-manifest-sha256');
    }
    const options = { ...values, dataHome: values['data-home'], skillsDir: values['skills-dir'], reconcileShared: values['reconcile-shared'],
      adoptLegacyManifestSha256: values['adopt-legacy-manifest-sha256'] };
    const files = values.uninstall ? planUninstall(options) : planInstall(options);
    const adopting = Boolean(values['adopt-legacy-manifest-sha256']);
    const planSha256 = adopting ? installPlanSha256(files) : null;
    if (values['expect-plan-sha256'] && (!adopting || !values.apply)) {
      throw new Error('--expect-plan-sha256 is valid only for --apply of a legacy adoption');
    }
    if (adopting && values.apply && !values['expect-plan-sha256']) {
      throw new Error('legacy adoption --apply requires --expect-plan-sha256 from a separate preview');
    }
    if (values['expect-plan-sha256'] && !/^[a-f0-9]{64}$/.test(values['expect-plan-sha256'])) {
      throw new Error('--expect-plan-sha256 requires an exact lowercase SHA-256');
    }
    if (values['expect-plan-sha256'] && values['expect-plan-sha256'] !== planSha256) {
      throw new Error('legacy adoption plan SHA-256 mismatch; preview the current plan again');
    }
    if (values.apply) applyInstall(files);
    console.log(`${values.apply ? (values.uninstall ? 'Uninstalled/verified' : 'Installed/verified') : 'Preview only'}: ${files.length} files`);
    if (planSha256) console.log(`Plan SHA-256: ${planSha256}`);
    if (!values.apply) for (const file of files) console.log(file.path);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
