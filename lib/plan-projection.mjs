import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { safePath, validateTasks } from './contracts.mjs';
import { digest } from './orchestration.mjs';

// Only canonical index checkbox state is progress. Text/order/IDs remain material.
export function canonicalIndexContent(text) {
  // Conservative documented subset: HTML-bearing indexes are exact sources.
  // Never interpret their literal blocks as progress or implement an HTML parser.
  if (/^ {0,3}<[A-Za-z!/?]/m.test(text) || /^---\r?\n/.test(text) || /^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+(?:`{3,}|~{3,})/m.test(text)) return text;
  let fence = null;
  return text.split(/(?<=\n)/).map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)(?:\r?\n)?$/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return line;
    }
    if (marker) { fence = { char: marker[1][0], length: marker[1].length }; return line; }
    // Four-space indentation and blockquote prefixes remain material.
    return line.replace(/^( {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+\[)[ xX](\](?:[ \t]|\r?$))/, '$1 $2');
  }).join('');
}
export const projectionSourceDigest = (text, isIndex = false) => createHash('sha256').update(isIndex ? canonicalIndexContent(text) : text).digest('hex');

// Explicit, reviewed extraction of a pre-existing plan. No Markdown heuristics,
// rewriting the original index, imported completion, or implicit OpenSpec init.
export function loadProjection(file) {
  const input=JSON.parse(fs.readFileSync(file,'utf8'));
  if (input.version !== 1 || !path.isAbsolute(input.root ?? '') || !safePath(input.canonicalIndex) || !Array.isArray(input.sources) || !input.sources.length) throw new Error('invalid plan projection');
  const sources=new Map();
  for (const source of input.sources) {
    if (!safePath(source.path) || sources.has(source.path)) throw new Error('invalid/duplicate projection source');
    let location=path.resolve(input.root);
    for (const part of source.path.split('/')) {
      location=path.join(location,part);
      if (fs.lstatSync(location).isSymbolicLink()) throw new Error('projection source symlink refused');
    }
    const bytes=fs.readFileSync(location, 'utf8');
    if (projectionSourceDigest(bytes, source.path === input.canonicalIndex) !== source.sha256) throw new Error(`projection source changed: ${source.path}`);
    sources.set(source.path, source.path === input.canonicalIndex ? canonicalIndexContent(bytes) : bytes);
  }
  if (!sources.has(input.canonicalIndex)) throw new Error('canonical index must be a bound source');
  const errors=validateTasks(input.tasks); if (errors.length) throw new Error(errors.join('; '));
  return input.tasks.map(task=>{
    const source=sources.get(task.source?.path), anchor=task.source?.anchor;
    if (!source || typeof anchor !== 'string' || !anchor.trim() || source.split(anchor).length !== 2) throw new Error(`${task.id}: unique source anchor required`);
    // Bind extraction itself and every supplied source: editing either invalidates old receipts.
    const { contractRevision: ignored, ...contract }=task;
    return {...contract,contractRevision:digest({sources:input.sources,canonicalIndex:input.canonicalIndex,tasks:input.tasks.map(({contractRevision,...rest})=>rest)}),
      planningSource:{kind:'projection',root:input.root,canonicalIndex:input.canonicalIndex}};
  });
}
