import json,sys
for line in sys.stdin:
 try: event=json.loads(line)
 except json.JSONDecodeError: continue
 kind=event.get('type')
 if 'event' in event:
  label=event.get('event')
  if isinstance(event.get('result'),dict):
   result=event['result'];out={'event':label,'result':{k:result[k] for k in ('conversation_id','status','response','result','error','duration_seconds','num_turns','model') if k in result}}
  else:
   update=event.get('step_update',{});out={'event':label,'step':{k:update[k] for k in ('conversation_id','step_index','state','step_type','tool_name','duration_seconds') if k in update},'tool_info':{k:update.get('tool_info',{})[k] for k in ('name','parameters') if k in update.get('tool_info',{})}}
  print(json.dumps(out,ensure_ascii=False),flush=True);continue
 if kind in ('thread.started','turn.started','turn.completed','turn.failed','error'):
  out={k:event[k] for k in ('type','thread_id','error','message') if k in event}
 elif kind in ('item.started','item.completed'):
  item=event.get('item',{});category=item.get('type')
  if category not in ('agent_message','command_execution','mcp_tool_call','web_search','file_change'): continue
  out={'type':kind,'item':{k:item[k] for k in ('id','type','text','command','exit_code','status','server','tool','arguments','changes') if k in item}}
 elif kind in ('assistant','user'):
  message=event.get('message',{});blocks=message.get('content',[])
  public=[]
  for block in blocks if isinstance(blocks,list) else []:
   if block.get('type')=='text':public.append({'type':'text','text':block.get('text')})
   elif block.get('type')=='tool_use':public.append({k:block[k] for k in ('type','id','name','input') if k in block})
   elif block.get('type')=='tool_result':public.append({k:block[k] for k in ('type','tool_use_id','is_error') if k in block})
  out={'type':kind,'content':public}
 elif kind in ('result','system'):
  out={k:event[k] for k in ('type','subtype','conversation_id','session_id','status','result','response','is_error','duration_ms','num_turns','model') if k in event}
 else:
  out={'type':kind,'keys':sorted(event.keys())}
 print(json.dumps(out,ensure_ascii=False),flush=True)
