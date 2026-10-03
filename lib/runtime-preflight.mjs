import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';

// Trusted local host input only. No shell, install, search beyond PATH/declared origins,
// or project initialization. --version still executes the selected trusted program.
export function preflight(request, { pathEnv = process.env.PATH ?? '' } = {}) {
  if (!['openspec', 'node'].includes(request?.tool) || !['validate','orchestrate','inspect'].includes(request.operation)) throw new Error('unsupported tool/operation');
  if (request.knownPaths !== undefined && (!Array.isArray(request.knownPaths) || !request.knownPaths.every(p => typeof p === 'string' && path.isAbsolute(p)))) throw new Error('knownPaths must be documented absolute paths');
  if (request.expectedVersions !== undefined && (!Array.isArray(request.expectedVersions) || !request.expectedVersions.length || !request.expectedVersions.every(v => /^\d+\.\d+\.\d+$/.test(v)))) throw new Error('expectedVersions must be exact versions');
  const origins = [...pathEnv.split(path.delimiter).filter(p => path.isAbsolute(p)).map(p => ({ path:path.join(p,request.tool),origin:'PATH' })),
    ...(request.knownPaths ?? []).map(p => ({path:p,origin:'documented'}))];
  const seen = new Set(), candidates = [];
  for (const origin of origins) {
    if (seen.has(origin.path)) continue; seen.add(origin.path);
    try {
      const stat = fs.statSync(origin.path);
      if (!stat.isFile()) continue;
      fs.accessSync(origin.path, fs.constants.X_OK);
      const run=spawnSync(origin.path,['--version'],{encoding:'utf8',timeout:5000,maxBuffer:16384,env:process.env});
      const version=(run.stdout ?? '').trim().match(/^v?(\d+\.\d+\.\d+)(?:\s|$)/)?.[1] ?? null;
      const compatible = version && (!request.expectedVersions || request.expectedVersions.includes(version)) &&
        (request.tool !== 'node' || Number(version.split('.')[0]) > 20 || Number(version.split('.')[0]) === 20 && Number(version.split('.')[1]) >= 19);
      candidates.push({...origin,effectivePath:fs.realpathSync(origin.path),version,state:run.error || run.status !== 0 ? 'inaccessible' : !version ? 'unverified' : compatible ? 'available' : 'incompatible',exitCode:run.status});
    } catch(error) { if (error.code !== 'ENOENT') candidates.push({...origin,state:'inaccessible',error:error.code ?? 'read_failed'}); }
  }
  const selected=candidates.find(c => c.state === 'available') ?? null;
  const state=selected ? 'available' : candidates[0]?.state ?? 'absent';
  let project={state:'unverified'};
  if (request.project) {
    if (!path.isAbsolute(request.project)) throw new Error('project must be absolute');
    try {
      if (!fs.statSync(request.project).isDirectory()) throw new Error('invalid root');
      const directory=path.join(request.project,'openspec');
      if (!fs.existsSync(directory)) project={state:'not_initialized'};
      else if (!fs.statSync(directory).isDirectory()) project={state:'invalid_configuration'};
      else {
        const config=path.join(directory,'config.yaml');
        if (!fs.existsSync(config)) project={state:'configuration_unverified'};
        else {
          const document=parseDocument(fs.readFileSync(config,'utf8'));
          const value=document.errors.length ? null : document.toJS();
          project={state:value && typeof value.schema === 'string' && value.schema.trim() ? 'configured' : 'invalid_configuration'};
        }
      }
    } catch(error) { project={state:error.code === 'EACCES' ? 'inaccessible' : 'invalid_root'}; }
  }
  const denied=request.installationDecision?.decision === 'denied';
  return {version:1,tool:request.tool,operation:request.operation,required:request.required === true,
    state,selected,candidates,project,capability:'unverified',observedAt:new Date().toISOString(),
    installationDecision:request.installationDecision ?? null,installationAuthorized:false,
    remediation:{action:selected ? 'reuse_observed_path' : denied ? 'respect_refusal' : 'propose_official_installation',
      source:request.tool === 'openspec' ? 'https://github.com/Fission-AI/OpenSpec' : 'https://nodejs.org/en/download',
      note:'Installation, project initialization and execution are separate authorizations. Version alone does not prove command or harness capability.'}};
}
