import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifyTaskIndexProgressReadback } from './task-index-progress.mjs';

function nulPaths(output) {
  // Do not silently collapse distinct non-UTF-8 filenames to replacement characters.
  return new TextDecoder('utf-8', { fatal: true }).decode(output).split('\0').filter(Boolean);
}

function gitReader(repo) {
  // Inherited Git routing variables must not redirect inspection to another index/repo.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  env.GIT_OPTIONAL_LOCKS = '0';
  env.GIT_TERMINAL_PROMPT = '0';
  const options = [
    '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
    '-c', 'diff.ignoreSubmodules=none', '-c', 'status.renames=false',
  ];
  const git = (...args) => execFileSync('git', [
    ...options, '-C', repo, ...args,
  ], { env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  try {
    // Even read-only diffs can invoke clean/process filters. Read only config
    // names (not potentially sensitive command values), then disable drivers.
    const names = nulPaths(git('config', '--null', '--name-only', '--get-regexp',
      '^filter\\..*\\.(clean|smudge|process|required)$'));
    const drivers = new Set(names.map(name => name.replace(/\.[^.]+$/, '')));
    for (const driver of drivers) {
      options.push('-c', `${driver}.clean=`, '-c', `${driver}.smudge=`,
        '-c', `${driver}.process=`, '-c', `${driver}.required=false`);
    }
  } catch (error) {
    // Exit 1 means no matching configuration entries; other errors are real.
    if (error.status !== 1) throw new Error('Invalid Git repository configuration', { cause: error });
  }
  return git;
}

function resolveCommit(git, value, label) {
  if (typeof value !== 'string' || !value || value.includes('\0')) {
    throw new Error(`Invalid ${label}`);
  }
  try {
    return git('rev-parse', '--verify', '--end-of-options', `${value}^{commit}`).toString('ascii').trim();
  } catch (cause) {
    throw new Error(`Invalid ${label}: ${value}`, { cause });
  }
}

function hashField(hash, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  hash.update(`${bytes.length}:`);
  hash.update(bytes);
}

function hashWorkingPath(hash, repo, relative) {
  const parts = relative.replace(/\/$/, '').split('/');
  if (parts.some(part => !part || part === '.' || part === '..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid Git path: ${relative}`);
  }
  let current = repo;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      hashField(hash, `missing:${i}`);
      return;
    }
    if (stat.isSymbolicLink()) {
      // Hash the link itself, even when it replaces an ancestor of a tracked file.
      hashField(hash, `symlink:${i}`);
      hashField(hash, fs.readlinkSync(current, { encoding: 'buffer' }));
      return;
    }
    if (i < parts.length - 1) {
      if (!stat.isDirectory()) {
        hashField(hash, `blocked:${i}:${stat.mode}`);
        return;
      }
      continue;
    }
    hashField(hash, String(stat.mode));
    if (stat.isFile()) {
      const fd = fs.openSync(current, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      try {
        hashField(hash, 'file');
        hashField(hash, fs.readFileSync(fd));
      } finally {
        fs.closeSync(fd);
      }
    } else if (stat.isDirectory()) {
      // Gitlinks/embedded repositories are fingerprinted with their own Git scope,
      // never with an unrestricted directory walk that might read ignored files.
      hashField(hash, 'repository');
      hashField(hash, collectGitScope(current, 'HEAD').revision);
    } else {
      throw new Error(`Unsupported working-tree file type: ${relative}`);
    }
  }
}

/**
 * Collect the union of base..HEAD, staged, unstaged and non-ignored untracked
 * paths, or an explicitly selected historical committed revision (third argument)
 * without inspecting current dirty state. `repo` must be a non-bare repository's top-level working directory.
 * Returns resolved commit hashes; dirty revisions append a SHA-256 fingerprint
 * of index state and working content. Renames are deliberately represented as
 * delete/add so both names survive, independent of rename-detection settings.
 *
 * Inspection is synchronous/read-only and executes no hooks, contract commands,
 * shell, external diff or textconv. Symlink targets are not followed. Git's
 * ignore rules exclude untracked content (tracked files remain in scope).
 * Paths must be UTF-8. Unsupported special files fail explicitly. Callers must
 * avoid concurrent modifications: this is not an atomic filesystem snapshot.
 */
export function collectGitScope(repo, baseRevision, committedRevision) {
  let root;
  try {
    root = fs.realpathSync.native(repo);
    if (!fs.statSync(root).isDirectory()) throw new Error('Not a directory');
  } catch (cause) {
    throw new Error('Invalid Git repository directory', { cause });
  }
  const git = gitReader(root);
  let top;
  try {
    if (git('rev-parse', '--is-inside-work-tree').toString().trim() !== 'true') {
      throw new Error('Not a working tree');
    }
    // Strip exactly Git's terminator, not whitespace that may belong to the path.
    top = fs.realpathSync.native(git('rev-parse', '--show-toplevel').toString('utf8').replace(/\n$/, ''));
  } catch (cause) {
    throw new Error('Invalid Git repository working tree', { cause });
  }
  // Native realpath resolves Windows short names; Git may also return different
  // drive-letter case/separator spelling.
  // Use the host path comparison while still rejecting any actual subdirectory.
  if (path.relative(root, top) !== '') throw new Error('repo must be the repository top level');
  const base = resolveCommit(git, baseRevision, 'base revision');
  const head = resolveCommit(git, committedRevision ?? 'HEAD', 'delivery revision');
  const diffFlags = ['--no-ext-diff', '--no-textconv', '--no-renames', '--ignore-submodules=none'];
  const committed = git('diff', ...diffFlags, '--name-only', '-z', base, head, '--');
  // Explicit historical commit mode excludes the current index/worktree by design.
  // It never accepts a dirty fingerprint as a commit or guesses from a receipt.
  if (committedRevision !== undefined) return { baseRevision: base, revision: head, changedFiles: [...new Set(nulPaths(committed))].sort() };
  const staged = git('diff', ...diffFlags, '--cached', '--name-only', '-z', head, '--');
  const unstaged = git('diff', ...diffFlags, '--name-only', '-z', '--');
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z', '--');
  const dirtyPaths = [...new Set([staged, unstaged, untracked].flatMap(nulPaths))].sort();
  const changedFiles = [...new Set([...nulPaths(committed), ...dirtyPaths])].sort();
  const status = git('status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none');
  if (!status.length) return { baseRevision: base, revision: head, changedFiles };

  const hash = createHash('sha256');
  hashField(hash, 'asds-git-scope-v1');
  hashField(hash, status);
  // Include all index stages, including conflicts. Object IDs/modes preserve
  // staged state even when current worktree bytes are identical.
  hashField(hash, git('ls-files', '--stage', '-z', '--'));
  hashField(hash, git('diff', ...diffFlags, '--cached', '--raw', '--no-abbrev', '-z', head, '--'));
  hashField(hash, git('diff', ...diffFlags, '--raw', '--no-abbrev', '-z', '--'));
  for (const relative of dirtyPaths) {
    hashField(hash, relative);
    hashWorkingPath(hash, root, relative);
  }
  return {
    baseRevision: base,
    revision: `${head}+worktree:${hash.digest('hex')}`,
    changedFiles,
  };
}

function pathState(repo, relative) {
  const git=gitReader(repo),hash=createHash('sha256');
  hashField(hash,'asds-git-path-state-v1');
  hashField(hash,git('status','--porcelain=v1','-z','--untracked-files=all','--ignore-submodules=none','--',relative));
  hashField(hash,git('ls-files','--stage','-z','--',relative));
  hashWorkingPath(hash,repo,relative);
  return hash.digest('hex');
}

function regularFileBytes(repo,relative) {
  const parts=relative.split('/');
  if(path.isAbsolute(relative)||parts.some(part=>!part||part==='.'||part==='..')) throw new Error(`Invalid observed path: ${relative}`);
  let current=repo;
  for(let index=0;index<parts.length;index++) {
    current=path.join(current,parts[index]);const stat=fs.lstatSync(current);
    if(stat.isSymbolicLink()||(index<parts.length-1&&!stat.isDirectory())) throw new Error(`Unsafe observed path: ${relative}`);
    if(index===parts.length-1&&(!stat.isFile()||stat.nlink!==1)) throw new Error(`Observed path is not one regular file: ${relative}`);
  }
  const fd=fs.openSync(current,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{return fs.readFileSync(fd);}finally{fs.closeSync(fd);}
}
const regularFileHash=(repo,relative)=>createHash('sha256').update(regularFileBytes(repo,relative)).digest('hex');
function canonical(value) {
  if(Array.isArray(value)) return value.map(canonical);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}

/** Capture pre-existing dirty state so later delivery attribution is path-and-byte based. */
export function captureGitBaseline(repo, baseRevision) {
  const root=fs.realpathSync.native(repo),scope=collectGitScope(root,baseRevision);
  const observedPathHashes={};
  try{observedPathHashes['tasks.md']=regularFileHash(root,'tasks.md');}catch(error){if(error.code!=='ENOENT')throw error;}
  return {
    version:1,
    baseRevision:scope.baseRevision,
    workspaceRevision:scope.revision,
    changedFiles:scope.changedFiles,
    pathStates:Object.fromEntries(scope.changedFiles.map(relative=>[relative,pathState(root,relative)])),
    observedPathHashes,
  };
}

/**
 * Derive candidate changes relative to an observed workspace baseline. A path
 * already dirty at baseline is candidate-owned only when its index/worktree
 * state changed again. Unchanged dirt remains explicitly attributed as pre-existing.
 */
export function collectGitDelta(repo, baseline) {
  if (baseline?.version!==1 || typeof baseline.baseRevision!=='string' || typeof baseline.workspaceRevision!=='string' ||
      !Array.isArray(baseline.changedFiles) || !baseline.pathStates || typeof baseline.pathStates!=='object') {
    throw new Error('Invalid Git workspace baseline');
  }
  const root=fs.realpathSync.native(repo),current=collectGitScope(root,baseline.baseRevision);
  const paths=[...new Set([...baseline.changedFiles,...current.changedFiles])].sort();
  const states=Object.fromEntries(paths.map(relative=>[relative,pathState(root,relative)]));
  const candidateChangedFiles=paths.filter(relative=>states[relative]!==baseline.pathStates[relative]);
  const preexistingChangedFiles=[...baseline.changedFiles].sort();
  const preexistingUnchangedFiles=baseline.changedFiles.filter(relative=>states[relative]===baseline.pathStates[relative]).sort();
  const revision=createHash('sha256').update(JSON.stringify({
    schema:'asds-git-delta-v1',baseline:baseline.workspaceRevision,current:current.revision,
    candidateChangedFiles,states:Object.fromEntries(candidateChangedFiles.map(relative=>[relative,states[relative]])),
  })).digest('hex');
  return {
    baseRevision:baseline.workspaceRevision,
    revision:`${current.revision}+candidate:${revision}`,
    changedFiles:candidateChangedFiles,
    preexistingChangedFiles,
    preexistingUnchangedFiles,
    workspaceRevision:current.revision,
    pathStates:states,
  };
}

/**
 * Attribute the single materialized tasks.md checkbox mutation to the narrow
 * progress broker while leaving all other candidate and pre-existing dirt visible.
 * This does not certify the receipt or the file bytes; the broker readback does.
 */
export function reconcileProgressDelta(repo,baseline,delta,mutation) {
  if(!delta||!Array.isArray(delta.changedFiles)||!Array.isArray(delta.preexistingChangedFiles)||!baseline?.observedPathHashes) throw new Error('Invalid Git delta ledger');
  if(!mutation||mutation.owner!=='progress-broker') throw new Error('Progress mutation owner must be progress-broker, not executor, reviewer or root');
  const relative=mutation.indexPath;
  if(typeof relative!=='string'||path.isAbsolute(relative)||relative.split('/').some(part=>!part||part==='.'||part==='..')||relative.includes('\\')||relative.includes('\0')) throw new Error('Invalid progress index path');
  if(path.posix.basename(relative).toLowerCase()!=='tasks.md') throw new Error('Progress index path must identify tasks.md');
  const current=collectGitDelta(repo,baseline);
  if(JSON.stringify(canonical(delta))!==JSON.stringify(canonical(current))) throw new Error('Stale, incomplete or fabricated Git delta ledger');
  if(!delta.changedFiles.includes(relative)) throw new Error(`Progress index mutation missing from Git delta: ${relative}`);
  const requested=mutation.progressRequested,committed=mutation.progressCommitted;
  if(requested?.indexBeforeHash!==baseline.observedPathHashes[relative]) throw new Error('Progress before hash does not match observed baseline bytes');
  const root=fs.realpathSync.native(repo),bytes=regularFileBytes(root,relative),afterHash=createHash('sha256').update(bytes).digest('hex');
  const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(committed?.indexAfterHash!==afterHash) throw new Error('Progress after hash does not match current readback bytes');
  verifyTaskIndexProgressReadback({source,task:mutation.task,progressRequested:requested,progressCommitted:committed});
  return {
    ...current,
    changedFiles:current.changedFiles.filter(file=>file!==relative),
    progressChangedFiles:[relative],
    progressMutation:{owner:mutation.owner,indexPath:relative,task:structuredClone(mutation.task),beforeHash:requested.indexBeforeHash,afterHash:committed.indexAfterHash,
      baselineRevision:baseline.workspaceRevision,currentRevision:current.workspaceRevision,receiptDigest:requested.receiptDigest},
  };
}
