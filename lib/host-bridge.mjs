import { assertCurrentPlan, readyWave, packetFor, replay } from './orchestration.mjs';

// Injected host methods are trusted capability adapters, not task-provided code.
// prepare may create a standby session, but MUST NOT execute project work.
// Only start may release the reserved worker. A failed start retains the lease
// until an explicit stopped observation; a transport exception is not a stop.
export async function hostDispatch({store,loadTasks,host,taskId,role}) {
  let journal=store.read();
  assertCurrentPlan(journal,loadTasks());
  const grant=await host.authorize({taskId,role,context:replay(journal).context});
  if (grant?.granted !== true || typeof grant.source !== 'string' || !grant.source.trim()) throw new Error('host authorization required');
  let capabilities=await host.capabilities();
  if (!readyWave(journal,capabilities,role).selected.includes(taskId)) throw new Error('task is not in ready wave');
  const prepared=await host.prepare({taskId,role});
  try {
    // Preparation can take time: observe the live plan, pause, source and capacities again.
    journal=store.read(); assertCurrentPlan(journal,loadTasks());
    const freshGrant=await host.authorize({taskId,role,context:replay(journal).context});
    if (freshGrant?.granted !== true || typeof freshGrant.source !== 'string' || !freshGrant.source.trim()) throw new Error('host authorization revoked');
    capabilities=await host.capabilities();
    // No await between final source/state check and synchronous CAS reservation.
    journal=store.read(); assertCurrentPlan(journal,loadTasks());
    if (!readyWave(journal,capabilities,role).selected.includes(taskId)) throw new Error('task is no longer ready');
    store.append({type:'dispatch',taskId,role,session:prepared.session,context:prepared.context,capabilities},replay(journal).sequence);
  } catch(error) {
    // No project work was allowed. Host owns cleanup of its standby session.
    if (host.cancelPrepared) await host.cancelPrepared(prepared);
    throw error;
  }
  journal=store.read(); assertCurrentPlan(journal,loadTasks());
  const current=replay(journal);
  if (current.paused) throw new Error('host start paused; reservation retained');
  if (current.tasks[taskId]?.status !== (role === 'executor' ? 'executing' : 'reviewing')) throw new Error('host task state changed; reservation retained');
  if (current.tasks[taskId]?.operationBlocks?.[role]) throw new Error('host start blocked; reservation retained');
  const packet=packetFor(journal,taskId);
  if (packet.assignment.session !== prepared.session || packet.assignment.role !== role) throw new Error('host assignment changed; reservation retained');
  const observation=await host.start(packet);
  if (observation?.session !== prepared.session || typeof observation.toolCall !== 'string' || !observation.toolCall.trim()) throw new Error('host start requires matching session and tool-call evidence; reservation retained');
  return {started:true,session:prepared.session,observation,planRevision:packet.planRevision,sequence:packet.sequence};
}
