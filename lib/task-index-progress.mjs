import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const nonempty = value => typeof value === 'string' && value.length > 0 && !value.includes('\0');
const decodeUtf8 = bytes => new TextDecoder('utf-8',{fatal:true}).decode(bytes);

function fail(message,code='PROGRESS_CONFLICT') { const error=new Error(message);error.code=code;throw error; }
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');

function indexedLines(source) {
  const entries=[];
  for(const match of source.matchAll(/^(\s*[-*] \[)([ xX])(\] \[Task ([A-Za-z0-9_-]+)\]\(tasks\/task-([A-Za-z0-9_-]+)\.md\): )(.+)$/gm)) {
    entries.push({match,completed:match[2].toLowerCase()==='x',id:match[4],fileId:match[5],title:match[6].trim()});
  }
  return entries;
}

function taskWave(source,id) {
  const waves=[];
  for(const line of source.split(/\r?\n/)) {
    const match=line.match(/^\s*(?:[-*]\s*)?(?:\*\*)?(?:Wave|Onda)\s+(\d+)(?:\*\*)?:\s*([A-Za-z0-9_-]+(?:\s*,\s*[A-Za-z0-9_-]+)*)\s*$/i);
    if(match&&match[2].split(',').map(value=>value.trim()).includes(id)) waves.push(Number(match[1]));
  }
  return waves;
}

export function validateTaskIndexProgress({before,after,task}={}) {
  const errors=[];
  if(typeof before!=='string'||typeof after!=='string') return ['task index progress requires before and after text'];
  if(!task||typeof task.id!=='string'||!task.id||typeof task.title!=='string'||!task.title.trim()) return ['task index progress requires task id and title'];
  const beforeEntries=indexedLines(before).filter(entry=>entry.id===task.id),afterEntries=indexedLines(after).filter(entry=>entry.id===task.id);
  if(beforeEntries.length!==1||afterEntries.length!==1) errors.push(`${task.id}: task index anchor must be unique before and after`);
  const from=beforeEntries[0],to=afterEntries[0];
  if(from&&to) {
    if(from.fileId!==task.id||to.fileId!==task.id) errors.push(`${task.id}: task index link/id differs`);
    if(from.title!==task.title||to.title!==task.title) errors.push(`${task.id}: task index title differs`);
    if(from.completed||!to.completed) errors.push(`${task.id}: expected one open-to-closed checkbox transition`);
    const expected=before.slice(0,from.match.index+from.match[1].length)+'x'+before.slice(from.match.index+from.match[1].length+1);
    if(after!==expected) errors.push(`${task.id}: progress changed bytes other than the exact checkbox`);
  }
  const beforeWaves=taskWave(before,task.id),afterWaves=taskWave(after,task.id);
  if(beforeWaves.length!==1||afterWaves.length!==1||beforeWaves[0]!==afterWaves[0]) errors.push(`${task.id}: task wave anchor differs`);
  if(task.wave!==undefined&&(!Number.isInteger(task.wave)||beforeWaves[0]!==task.wave)) errors.push(`${task.id}: task wave differs from request`);
  return errors;
}

function validateRequest(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.root!=='string') fail('Structured progress request required','INVALID_PROGRESS_REQUEST');
  const allowed=new Set(['root','indexPath','task','progressRequested','progressCommitted']);
  for(const key of Object.keys(input)) if(!allowed.has(key)) fail(`Unknown progress request field: ${key}`,'INVALID_PROGRESS_REQUEST');
  const indexPath=input.indexPath??'tasks.md',parts=indexPath.split('/');
  if(!nonempty(indexPath)||path.isAbsolute(indexPath)||indexPath.includes('\\')||parts.some(part=>!part||part==='.'||part==='..')||path.posix.basename(indexPath)!=='tasks.md') fail('Invalid task index path','INVALID_PROGRESS_REQUEST');
  const task=input.task,requested=input.progressRequested;
  if(!task||!nonempty(task.id)||!/^[A-Za-z0-9_-]+$/.test(task.id)||!nonempty(task.title)||/[\r\n]/.test(task.title)||(task.wave!==undefined&&!Number.isInteger(task.wave))) fail('Task id, title and integer wave are required','INVALID_PROGRESS_REQUEST');
  const requestedKeys=['type','taskId','planningRevision','contractRevision','integrationRevision','receiptDigest','indexBeforeHash','expectedChange'];
  if(!exactKeys(requested,requestedKeys)||requested.type!=='progressRequested'||requested.taskId!==task.id||!nonempty(requested.planningRevision)||!nonempty(requested.contractRevision)||
    !nonempty(requested.integrationRevision)||!nonempty(requested.receiptDigest)||!/^[a-f0-9]{64}$/.test(requested.indexBeforeHash??'')||
    requested.expectedChange?.from!=='[ ]'||requested.expectedChange?.to!=='[x]'||Object.keys(requested.expectedChange).length!==2) fail('Invalid progressRequested binding','INVALID_PROGRESS_REQUEST');
  if(input.progressCommitted) {
    const committed=input.progressCommitted;
    if(!exactKeys(committed,['type','taskId','receiptDigest','indexBeforeHash','indexAfterHash'])||committed.type!=='progressCommitted'||committed.taskId!==task.id||committed.receiptDigest!==requested.receiptDigest||committed.indexBeforeHash!==requested.indexBeforeHash||
      !/^[a-f0-9]{64}$/.test(committed.indexAfterHash??'')||committed.indexAfterHash===committed.indexBeforeHash) fail('progressCommitted conflicts with progressRequested receipt or hashes');
  }
  return {...input,indexPath,task:{id:task.id,title:task.title,wave:task.wave},progressRequested:requested};
}

function bindingDigest(input) {
  const requested=input.progressRequested;
  return sha256(JSON.stringify({
    indexPath:input.indexPath,
    task:{id:input.task.id,title:input.task.title,wave:input.task.wave},
    progressRequested:{
      type:requested.type,
      taskId:requested.taskId,
      planningRevision:requested.planningRevision,
      contractRevision:requested.contractRevision,
      integrationRevision:requested.integrationRevision,
      receiptDigest:requested.receiptDigest,
      indexBeforeHash:requested.indexBeforeHash,
      expectedChange:{from:requested.expectedChange.from,to:requested.expectedChange.to},
    },
  }));
}

function fdPath(fd,fallback) { const candidate=`/proc/self/fd/${fd}`;return fs.existsSync(candidate)?candidate:fallback; }

function validateAnchors(resolved) {
  for(const anchor of resolved.anchors) {
    let stat;try{stat=fs.lstatSync(anchor.path);}catch{fail('Progress directory anchor disappeared');}
    if(stat.isSymbolicLink()||!stat.isDirectory()||stat.dev!==anchor.stat.dev||stat.ino!==anchor.stat.ino) fail('Progress directory anchor identity changed');
  }
  if(resolved.indexFd===undefined) return;
  let direct,anchored;try{direct=fs.lstatSync(resolved.originalIndex);anchored=fs.lstatSync(resolved.index);}catch{fail('Task index anchor disappeared');}
  for(const stat of [direct,anchored]) if(stat.isSymbolicLink()||!stat.isFile()||(!resolved.allowLinked&&stat.nlink!==1)||stat.dev!==resolved.indexStat.dev||stat.ino!==resolved.indexStat.ino) fail('Task index anchor identity changed');
}

function openIndexHandle(result,write,allowLinked=false) {
  let indexFd;try{indexFd=fs.openSync(result.index,(write?fs.constants.O_RDWR:fs.constants.O_RDONLY)|fs.constants.O_NOFOLLOW);}catch(error){if(error.code==='ELOOP')fail(`Symlink refused in task index path: ${result.relative}`,'INVALID_PROGRESS_PATH');throw error;}
  result.indexFd=indexFd;result.fds.push(indexFd);result.indexStat=fs.fstatSync(indexFd);
  result.allowLinked=allowLinked;
  if(!result.indexStat.isFile()||(!allowLinked&&result.indexStat.nlink!==1)||result.indexStat.nlink>2)fail('Task index must be one regular, non-hardlinked file','INVALID_PROGRESS_PATH');
  validateAnchors(result);
}

function openAnchored(rootInput,relative,write=false,allowMissing=false) {
  let root;try{root=fs.realpathSync.native(rootInput);}catch(cause){throw new Error('Invalid progress root realpath',{cause});}
  if(path.resolve(rootInput)!==root) fail('Progress root must be its canonical realpath','INVALID_PROGRESS_PATH');
  const fds=[],anchors=[];
  try {
    const directoryFlags=fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW;
    const parts=relative.split('/');
    let original=root,anchored=root;
    if(process.platform==='win32') {
      const rootStat=fs.lstatSync(original);
      if(rootStat.isSymbolicLink()||!rootStat.isDirectory()) fail(`Symlink or non-directory refused in task index path: ${relative}`,'INVALID_PROGRESS_PATH');
      anchors.push({path:original,stat:rootStat});
      for(const part of parts.slice(0,-1)) {
        original=path.join(original,part);const stat=fs.lstatSync(original);
        if(stat.isSymbolicLink()||!stat.isDirectory()) fail(`Symlink or non-directory refused in task index path: ${relative}`,'INVALID_PROGRESS_PATH');
        anchors.push({path:original,stat});anchored=original;
      }
    } else {
      let fd=fs.openSync(original,directoryFlags);anchored=fdPath(fd,original);fds.push(fd);anchors.push({path:original,stat:fs.fstatSync(fd)});
      for(const part of parts.slice(0,-1)) {
        original=path.join(original,part);const stat=fs.lstatSync(original);
        if(stat.isSymbolicLink()||!stat.isDirectory()) fail(`Symlink or non-directory refused in task index path: ${relative}`,'INVALID_PROGRESS_PATH');
        fd=fs.openSync(path.join(anchored,part),directoryFlags);fds.push(fd);anchors.push({path:original,stat:fs.fstatSync(fd)});anchored=fdPath(fd,original);
      }
    }
    const originalIndex=path.join(root,relative),index=path.join(anchored,parts.at(-1)),result={root,index,originalIndex,parent:anchored,indexFd:undefined,indexStat:undefined,anchors,fds,relative};
    try{openIndexHandle(result,write,allowMissing);}catch(error){if(!(allowMissing&&error.code==='ENOENT'))throw error;}
    validateAnchors(result);return result;
  } catch(error){for(const fd of fds.reverse())try{fs.closeSync(fd);}catch{}throw error;}
}

function closeIndexHandle(resolved) {
  if(resolved.indexFd===undefined) return;
  try{fs.closeSync(resolved.indexFd);}catch{}
  resolved.fds=resolved.fds.filter(fd=>fd!==resolved.indexFd);
  resolved.indexFd=undefined;
}

function closeAnchored(resolved) { for(const fd of [...resolved.fds].reverse())try{fs.closeSync(fd);}catch{} }

function fsyncDirectory(directory) {
  if(process.platform==='win32') return;
  try{const fd=fs.openSync(directory,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY);try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
  catch(error){if(!['EINVAL','ENOTSUP','EBADF','EPERM','EACCES','EISDIR'].includes(error.code))throw error;}
}

function readFd(fd) {
  const before=fs.fstatSync(fd,{bigint:true});if(before.size>BigInt(Number.MAX_SAFE_INTEGER)) fail('Task index is too large');
  const bytes=Buffer.alloc(Number(before.size));let offset=0;
  while(offset<bytes.length){const count=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(!count)fail('Short task index read');offset+=count;}
  const after=fs.fstatSync(fd,{bigint:true});
  if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs) fail('Task index changed during read');
  return bytes;
}

function closedToOpen(source,task) {
  const escaped=task.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern=new RegExp(`^(\\s*[-*] \\[)x(\\] \\[Task ${escaped}\\]\\(tasks/task-${escaped}\\.md\\): .+)$`,'gmi');
  let count=0;const before=source.replace(pattern,(_all,prefix,suffix)=>{count++;return `${prefix} ${suffix}`;});return {before,count};
}

function deriveState(input,source) {
  const currentHash=sha256(source),requested=input.progressRequested;
  if(currentHash===requested.indexBeforeHash) {
    if(input.progressCommitted) fail('progressCommitted exists but task index checkbox is still open');
    const entries=indexedLines(source).filter(entry=>entry.id===input.task.id);
    if(entries.length!==1||entries[0].completed) fail(`${input.task.id}: expected one open canonical task index anchor`);
    const entry=entries[0];if(entry.title!==input.task.title||entry.fileId!==input.task.id) fail(`${input.task.id}: task index title or link differs`);
    const charOffset=entry.match.index+entry.match[1].length,after=source.slice(0,charOffset)+'x'+source.slice(charOffset+1);
    const errors=validateTaskIndexProgress({before:source,after,task:input.task});if(errors.length)fail(errors.join('; '));
    return {status:'pending_write',before:source,after,beforeHash:currentHash,afterHash:sha256(after),byteOffset:Buffer.byteLength(source.slice(0,charOffset))};
  }
  const reconstructed=closedToOpen(source,input.task);
  if(reconstructed.count!==1||sha256(reconstructed.before)!==requested.indexBeforeHash) fail('Task index CAS conflict or non-checkbox drift');
  const errors=validateTaskIndexProgress({before:reconstructed.before,after:source,task:input.task});if(errors.length)fail(errors.join('; '));
  const afterHash=sha256(source);if(input.progressCommitted&&input.progressCommitted.indexAfterHash!==afterHash) fail('progressCommitted readback hash conflicts with task index');
  return {status:'already_committed',before:reconstructed.before,after:source,beforeHash:requested.indexBeforeHash,afterHash};
}

export function verifyTaskIndexProgressReadback({source,task,progressRequested,progressCommitted}) {
  const input=validateRequest({root:'/',indexPath:'tasks.md',task,progressRequested,progressCommitted}),state=deriveState(input,source);
  if(state.status!=='already_committed'||!progressCommitted||state.afterHash!==progressCommitted.indexAfterHash) fail('Materialized progress readback is not committed');
  return {beforeHash:state.beforeHash,afterHash:state.afterHash};
}

function processStart(pid) { try{const source=fs.readFileSync(`/proc/${pid}/stat`,'utf8'),end=source.lastIndexOf(')');return source.slice(end+2).trim().split(/\s+/)[19]??null;}catch{return null;} }
function leaseAlive(lease) { try{process.kill(lease.pid,0);}catch(error){if(error.code==='ESRCH')return false;return true;}const start=processStart(lease.pid);return start===null||start===lease.processStart; }

function readLease(lock) {
  const fd=fs.openSync(lock,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try {
    const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.nlink!==1) fail('Progress lease is not a safe regular file','PROGRESS_LOCKED');
    let lease;try{lease=JSON.parse(fs.readFileSync(fd,'utf8'));}catch{fail('Progress lease is malformed and cannot be recovered','PROGRESS_LOCKED');}
    const keys=['version','pid','processStart','token','taskId','receiptDigest','tempName','displacedName','indexBeforeHash','bindingDigest'];
    if(!lease||lease.version!==1||!Number.isInteger(lease.pid)||!keys.every(key=>Object.hasOwn(lease,key))||Object.keys(lease).some(key=>!keys.includes(key))||
      ![lease.processStart,lease.token,lease.taskId,lease.receiptDigest,lease.tempName,lease.displacedName].every(nonempty)||
      ![lease.indexBeforeHash,lease.bindingDigest].every(value=>/^[a-f0-9]{64}$/.test(value??''))) fail('Progress lease is unverifiable','PROGRESS_LOCKED');
    return {lease,stat};
  } finally{fs.closeSync(fd);}
}

function sameIdentity(file,expected) { try{const stat=fs.lstatSync(file);return stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.dev===expected.dev&&stat.ino===expected.ino;}catch(error){if(error.code==='ENOENT')return false;throw error;} }

function recoverDeadLease(lock,parent,input) {
  const observed=readLease(lock),{lease}=observed;
  if(lease.taskId!==input.task.id||lease.receiptDigest!==input.progressRequested.receiptDigest||lease.indexBeforeHash!==input.progressRequested.indexBeforeHash||lease.bindingDigest!==bindingDigest(input)) fail('Dead progress lease binding or provenance differs from this request','PROGRESS_LOCKED');
  if(leaseAlive(lease)) fail('Task index progress lease is active','PROGRESS_LOCKED');
  if(lease.tempName!==`.tasks.md.asds-progress.${lease.token}.tmp`||lease.displacedName!==`.tasks.md.asds-progress.${lease.token}.displaced`||lease.tempName.includes('/')||lease.displacedName.includes('/')) fail('Dead progress lease has unsafe temporary binding','PROGRESS_LOCKED');
  const temp=path.join(parent,lease.tempName),displaced=path.join(parent,lease.displacedName),index=path.join(parent,'tasks.md');
  if(fs.existsSync(temp)){
    const stat=fs.lstatSync(temp);if(stat.isSymbolicLink()||!stat.isFile()||![1,2].includes(stat.nlink))fail('Orphan progress temporary is unsafe','PROGRESS_LOCKED');
    if(stat.nlink===2){const indexStat=fs.lstatSync(index);if(!indexStat.isFile()||indexStat.dev!==stat.dev||indexStat.ino!==stat.ino)fail('Orphan linked progress temporary is ambiguous','PROGRESS_LOCKED');}
    fs.unlinkSync(temp);
  }
  if(fs.existsSync(displaced)) {
    const stat=fs.lstatSync(displaced);if(stat.isSymbolicLink()||!stat.isFile())fail('Orphan displaced index is unsafe','PROGRESS_LOCKED');
    if(!fs.existsSync(index)) { fs.linkSync(displaced,index);fs.unlinkSync(displaced); }
    else {
      const bytes=fs.readFileSync(displaced);
      if(sha256(bytes)!==lease.indexBeforeHash) fail('Orphan displaced index contains concurrent drift','PROGRESS_LOCKED');
      fs.unlinkSync(displaced);
    }
  }
  if(!sameIdentity(lock,observed.stat)) fail('Progress lease changed during recovery','PROGRESS_LOCKED');
  const quarantine=path.join(parent,`.tasks.md.asds-progress.stale.${process.pid}.${randomBytes(8).toString('hex')}`);fs.renameSync(lock,quarantine);
  try{const moved=readLease(quarantine);if(moved.lease.token!==lease.token)fail('Progress lease changed during recovery','PROGRESS_LOCKED');}
  finally{try{fs.unlinkSync(quarantine);}catch(error){if(error.code!=='ENOENT')throw error;}}
}

function acquireLease(resolved,input) {
  const lock=path.join(resolved.parent,'.tasks.md.asds-progress.lock');
  for(let attempt=0;attempt<3;attempt++) {
    const token=randomBytes(16).toString('hex'),tempName=`.tasks.md.asds-progress.${token}.tmp`,displacedName=`.tasks.md.asds-progress.${token}.displaced`;let fd;
    try{fd=fs.openSync(lock,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY,0o600);}catch(error){if(error.code!=='EEXIST')throw error;recoverDeadLease(lock,resolved.parent,input);continue;}
    const lease={version:1,pid:process.pid,processStart:processStart(process.pid)??'unavailable',token,taskId:input.task.id,receiptDigest:input.progressRequested.receiptDigest,tempName,displacedName,indexBeforeHash:input.progressRequested.indexBeforeHash,bindingDigest:bindingDigest(input)};
    try{fs.writeFileSync(fd,JSON.stringify(lease));fs.fsyncSync(fd);fsyncDirectory(resolved.parent);return {fd,stat:fs.fstatSync(fd),lock,temp:path.join(resolved.parent,tempName),lease};}
    catch(error){try{fs.closeSync(fd);}catch{}try{fs.unlinkSync(lock);}catch{}throw error;}
  }
  fail('Unable to acquire progress lease','PROGRESS_LOCKED');
}

function cleanupLease(owned,tempCreated,tempStat) {
  if(tempCreated&&tempStat&&sameIdentity(owned.temp,tempStat))try{fs.unlinkSync(owned.temp);}catch(error){if(error.code!=='ENOENT')throw error;}
  try{fs.closeSync(owned.fd);}catch{}
  if(sameIdentity(owned.lock,owned.stat))try{fs.unlinkSync(owned.lock);}catch(error){if(error.code!=='ENOENT')throw error;}
}

function restoreOrCleanDisplaced(owned,beforeHash) {
  const displaced=path.join(path.dirname(owned.lock),owned.lease.displacedName),index=path.join(path.dirname(owned.lock),'tasks.md');
  if(!fs.existsSync(displaced)) return;
  const stat=fs.lstatSync(displaced);if(stat.isSymbolicLink()||!stat.isFile())fail('Displaced task index became unsafe');
  const exact=sha256(fs.readFileSync(displaced))===beforeHash;
  if(!fs.existsSync(index)) { fs.linkSync(displaced,index);fs.unlinkSync(displaced);return; }
  if(exact) { fs.unlinkSync(displaced);return; }
  fail('Concurrent drift preserved in displaced task index');
}

function safeRegularHash(file) {
  try{const stat=fs.lstatSync(file);if(stat.isSymbolicLink()||!stat.isFile())return null;const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{return sha256(fs.readFileSync(fd));}finally{fs.closeSync(fd);}}
  catch(error){if(['ENOENT','ELOOP'].includes(error.code))return null;throw error;}
}

function rollbackPublished(owned,beforeHash,afterHash) {
  const parent=path.dirname(owned.lock),displaced=path.join(parent,owned.lease.displacedName),index=path.join(parent,'tasks.md');
  if(!fs.existsSync(displaced)||!fs.existsSync(index)) return restoreOrCleanDisplaced(owned,beforeHash);
  const currentHash=safeRegularHash(index);
  if(currentHash===afterHash) { fs.unlinkSync(index);fs.linkSync(displaced,index);fs.unlinkSync(displaced);return; }
  restoreOrCleanDisplaced(owned,beforeHash);
}

function result(input,state) {
  const pending=state.status==='pending_write',value={status:pending?'progress_pending':state.status,indexPath:input.indexPath,beforeHash:state.beforeHash,afterHash:state.afterHash,
    readback:{indexPath:input.indexPath,sha256:pending?state.beforeHash:state.afterHash}};
  if(!pending)value.event={type:'progressCommitted',taskId:input.task.id,receiptDigest:input.progressRequested.receiptDigest,indexBeforeHash:state.beforeHash,indexAfterHash:state.afterHash};
  return value;
}

export function hashTaskIndex(root,indexPath='tasks.md') { const resolved=openAnchored(root,indexPath);try{return sha256(readFd(resolved.indexFd));}finally{closeAnchored(resolved);} }
export function inspectTaskIndexProgress(rawInput) { const input=validateRequest(rawInput),resolved=openAnchored(input.root,input.indexPath);try{return result(input,deriveState(input,decodeUtf8(readFd(resolved.indexFd))));}finally{closeAnchored(resolved);} }
function crash(fault,name) { if(fault===name)process.kill(process.pid,'SIGKILL'); }

export function commitTaskIndexProgress(rawInput,options={}) {
  const allowedFaults=['beforeWrite','beforeRename','afterRename','afterReadback','crashBeforeWrite','crashAfterDisplace','crashAfterLink','crashAfterPublish','crashAfterWrite','crashAfterReadback'];
  if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>key!=='fault')||options.fault!==undefined&&!allowedFaults.includes(options.fault))fail('Invalid progress broker options','INVALID_PROGRESS_REQUEST');
  const input=validateRequest(rawInput),resolved=openAnchored(input.root,input.indexPath,true,true);let owned,tempCreated=false,tempStat,displaced=false,initial;
  try {
    owned=acquireLease(resolved,input);
    if(resolved.indexFd===undefined)openIndexHandle(resolved,true);
    else { const stat=fs.fstatSync(resolved.indexFd);if(stat.nlink!==1)fail('Recovered task index remains hardlinked','INVALID_PROGRESS_PATH');resolved.indexStat=stat;resolved.allowLinked=false;validateAnchors(resolved); }
    initial=deriveState(input,decodeUtf8(readFd(resolved.indexFd)));if(initial.status==='already_committed')return result(input,initial);
    const tempFd=fs.openSync(owned.temp,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY,resolved.indexStat.mode&0o777);tempCreated=true;tempStat=fs.fstatSync(tempFd);
    try{fs.writeFileSync(tempFd,initial.after);fs.fsyncSync(tempFd);}finally{fs.closeSync(tempFd);}
    crash(options.fault,'crashBeforeWrite');if(options.fault==='beforeWrite'||options.fault==='beforeRename')throw new Error('Injected failure before write');
    validateAnchors(resolved);const before=readFd(resolved.indexFd);if(sha256(before)!==initial.beforeHash)fail('Task index drifted before checkbox CAS');validateAnchors(resolved);
    const displacedPath=path.join(resolved.parent,owned.lease.displacedName);
    fs.renameSync(resolved.index,displacedPath);displaced=true;
    crash(options.fault,'crashAfterDisplace');
    const displacedBytes=readFd(resolved.indexFd);
    closeIndexHandle(resolved);
    if(sha256(displacedBytes)!==initial.beforeHash) { restoreOrCleanDisplaced(owned,initial.beforeHash);displaced=false;fail('Task index CAS captured concurrent drift without overwriting it'); }
    for(const anchor of resolved.anchors) { const stat=fs.lstatSync(anchor.path);if(stat.isSymbolicLink()||stat.dev!==anchor.stat.dev||stat.ino!==anchor.stat.ino) { restoreOrCleanDisplaced(owned,initial.beforeHash);displaced=false;fail('Progress directory anchor identity changed'); } }
    try{fs.linkSync(owned.temp,resolved.index);}catch(error){restoreOrCleanDisplaced(owned,initial.beforeHash);displaced=false;if(error.code==='EEXIST')fail('Task index CAS lost to an external writer');throw error;}
    crash(options.fault,'crashAfterLink');
    fs.unlinkSync(owned.temp);tempCreated=false;
    crash(options.fault,'crashAfterPublish');
    const readbackFd=fs.openSync(resolved.index,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    let readback,readbackStat;try{readback=readFd(readbackFd);readbackStat=fs.fstatSync(readbackFd);}finally{fs.closeSync(readbackFd);}
    if(sha256(readback)!==initial.afterHash||readbackStat.nlink!==1){restoreOrCleanDisplaced(owned,initial.beforeHash);displaced=false;fail('Task index CAS readback detected concurrent drift');}
    try {
      for(const anchor of resolved.anchors){const stat=fs.lstatSync(anchor.path);if(stat.isSymbolicLink()||stat.dev!==anchor.stat.dev||stat.ino!==anchor.stat.ino)fail('Progress directory anchor identity changed');}
      const direct=fs.lstatSync(resolved.originalIndex),anchored=fs.lstatSync(resolved.index);
      for(const stat of [direct,anchored])if(stat.isSymbolicLink()||stat.dev!==readbackStat.dev||stat.ino!==readbackStat.ino)fail('Published task index anchor identity changed');
    } catch(error) { rollbackPublished(owned,initial.beforeHash,initial.afterHash);displaced=false;throw error; }
    const finalDisplacedHash=sha256(fs.readFileSync(displacedPath));
    if(finalDisplacedHash!==initial.beforeHash){rollbackPublished(owned,initial.beforeHash,initial.afterHash);displaced=false;fail('Concurrent drift in displaced index was restored without committing progress');}
    fs.unlinkSync(displacedPath);displaced=false;
    fsyncDirectory(resolved.parent);
    crash(options.fault,'crashAfterWrite');if(options.fault==='afterRename')throw new Error('Injected failure after write');
    crash(options.fault,'crashAfterReadback');if(options.fault==='afterReadback')throw new Error('Injected failure after readback');
    return result(input,{...initial,status:'committed'});
  } finally { if(owned){if(displaced)rollbackPublished(owned,input.progressRequested.indexBeforeHash,initial?.afterHash??'');cleanupLease(owned,tempCreated,tempStat);}closeAnchored(resolved); }
}
