import fs from 'node:fs';
import path from 'node:path';
const stat=p=>{try{return fs.lstatSync(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
/** Passive filesystem inventory; no installer or launcher import. */
export function discoverSkills(collection,names=new Set()) {
  for(let part=path.resolve(collection);;part=path.dirname(part)){
    const info=stat(part);if(info?.isSymbolicLink())throw Error(`symlink refused: ${part}`);
    if(info&&!info.isDirectory())throw Error(`conflict: unexpected file type at ${part}`);
    if(part===path.dirname(part))break;
  }
  const sources=[];
  for(const entry of fs.readdirSync(collection,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const source=path.join(collection,entry.name);
    if(entry.isSymbolicLink())throw Error(`symlink refused: ${source}`);
    if(!entry.isDirectory())continue;
    const skill=path.join(source,'SKILL.md'),info=stat(skill);if(!info)continue;
    if(info.isSymbolicLink())throw Error(`symlink refused: ${skill}`);
    if(!info.isFile()||!fs.readFileSync(skill,'utf8').trim())throw Error(`Invalid skill source: ${skill}`);
    if(names.has(entry.name))throw Error(`Duplicate skill source: ${entry.name}`);
    names.add(entry.name);sources.push(source);
  }
  return sources;
}
