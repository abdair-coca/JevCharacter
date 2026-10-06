import { createRigSampler } from '../../phase2/web/rig.mjs';

/** Rive evaluates every cubic. One entry bump precedes the active clock;
 * one frozen outgoing owner bridges replacements, with only the latest order. */
export function createController({runtime,artboard,contract,catalog,now=()=>performance.now(),subscribe=()=>()=>{},onChange=()=>{}}) {
  const clips=new Map(); let sampler,release,disposed=false,order=null,active=null,recovery=null,bump=null;
  let ambient={},gaze={},frame=null,last=now(),ambientEnabled=catalog.behavior.ambient.enabled;
  let seed=catalog.behavior.ambient.seed,randomState=seed,schedules={},scheduleLog=[],occupiedMs={breath:0,blink:0};
  const neutral={...contract.neutral},takeoverMs=catalog.behavior.takeoverMs,recoveryMs=catalog.behavior.recoveryMs,transitionBump=catalog.transitionBump;
  function report(event){onChange(event);}
  function cleanup(){for(const clip of clips.values())clip.delete();clips.clear();sampler?.dispose();}
  try {
    sampler=createRigSampler(runtime,artboard,contract);
    if(!Number.isFinite(last))throw Error('Clock must return finite milliseconds');
    const names=[catalog.envelope.clip,transitionBump.clip,...Object.values(catalog.ambientClips).flatMap(Object.values),...Object.values(catalog.actions).flatMap(a=>Object.values(a.variants).map(v=>v.clip))];
    for(const name of new Set(names)){const animation=artboard.animationByName(name);if(!animation)throw Error(`Clip absent: ${name}`);clips.set(name,new runtime.LinearAnimationInstance(animation,artboard));}
    if(!artboard.node(catalog.envelope.node))throw Error('PlaybackEnvelope node absent');
  } catch(error){cleanup();throw error;}
  function alive(){if(disposed)throw Error('Controller disposed');}
  function numeric(value,low,high,key){if(typeof value!=='number'||!Number.isFinite(value)||value<low||value>high)throw Error(`${key}: expected finite number in [${low}, ${high}]`);return value;}
  function object(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected an object');for(const key of Object.keys(value))if(!allowed.includes(key))throw Error(`Unknown field: ${key}`);}
  function time(){const value=now();if(!Number.isFinite(value)||value<last)throw Error('Clock must be finite and monotonic');last=value;return value;}
  function apply(name,seconds,mix=1){const clip=clips.get(name);clip.time=seconds;clip.advance(0);clip.apply(mix);}
  function weight(elapsed,duration){apply(catalog.envelope.clip,Math.max(0,Math.min(1,elapsed/duration))*catalog.envelope.durationMs/1000);artboard.advance(0);const value=artboard.node(catalog.envelope.node).x;if(!Number.isFinite(value))throw Error('Native envelope nonfinite');return Math.max(0,Math.min(1,value));}
  function random(){randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;}
  function pause(kind){const [a,b]=catalog.behavior.ambient[kind].pauseMs;return a+(b-a)*random();}
  function resetSchedule(t){schedules={};scheduleLog=[];occupiedMs={breath:0,blink:0};randomState=seed;for(const kind of ['breath','blink'])schedules[kind]={next:t+pause(kind),start:null};}
  resetSchedule(last);
  function ambientLayers(t){
    if(!ambientEnabled)return [];
    const layers=[];
    // Consume the seeded stream in chronological event order. Sparse frames
    // and dense frames must produce exactly the same schedule and pose.
    while(true){
      const kind=schedules.breath.next<=schedules.blink.next?'breath':'blink';
      const s=schedules[kind],definition=catalog.behavior.ambient[kind];
      if(t<s.next)break;
      s.start=s.next;s.next=s.start+definition.durationMs+pause(kind);occupiedMs[kind]+=definition.durationMs;
      scheduleLog.push({kind,startMs:s.start,endMs:s.start+definition.durationMs});if(scheduleLog.length>32)scheduleLog.shift();
    }
    for(const kind of ['breath','blink']){
      const s=schedules[kind],definition=catalog.behavior.ambient[kind];
      if(s.start!==null&&t<s.start+definition.durationMs)for(const [channel,clip]of Object.entries(catalog.ambientClips[kind]))layers.push({kind,channel,clip,time:(t-s.start)/1000,mix:1});
    }
    return layers;
  }
  function prepare(id,options={},sequence=false){
    if(typeof id!=='string'||!Object.hasOwn(catalog.actions,id))throw Error(`Unknown action: ${id}`);
    object(options,['intensity','speed','variant','durationMs','loop']);
    const action=catalog.actions[id],variant=Object.hasOwn(options,'variant')?options.variant:'default';
    if(typeof variant!=='string'||!Object.hasOwn(action.variants,variant))throw Error(`Unknown variant: ${variant}`);
    const intensity=numeric(options.intensity??1,0,1,'intensity'),speed=numeric(options.speed??1,.1,4,'speed');
    // Explicit null is invalid; defaults apply only to absent properties.
    for(const key of ['intensity','speed'])if(Object.hasOwn(options,key))numeric(options[key],...(key==='intensity'?[0,1]:[.1,4]),key);
    if(Object.hasOwn(options,'loop')&&typeof options.loop!=='boolean')throw Error('loop: expected boolean');
    if(Object.hasOwn(options,'durationMs')&&Object.hasOwn(options,'loop'))throw Error('durationMs and loop are mutually exclusive');
    if((Object.hasOwn(options,'durationMs')||Object.hasOwn(options,'loop'))&&!action.behavior)throw Error('Duration/loop requires sustained behavior metadata');
    if(sequence&&options.loop===true)throw Error('Indefinite sequence items are not allowed');
    const duration=Object.hasOwn(options,'durationMs')?numeric(options.durationMs,1,3600000,'durationMs'):options.loop===true?Infinity:action.durationMs/speed;
    return {id,variant,intensity,speed,action,clip:action.variants[variant].clip,duration,cycling:options.loop===true||Object.hasOwn(options,'durationMs')};
  }
  function settle(target,status,reason){if(!target||target.done)return;target.done=true;const result={status,reason,completedItems:target.index,totalItems:target.items.length};target.resolve(result);report({type:'finished',...result});}
  function clipTime(item,elapsed){let t=elapsed*item.speed;if(item.cycling){const b=item.action.behavior;if(t>=b.cycleEndMs)t=b.cycleStartMs+(t-b.cycleStartMs)%(b.cycleEndMs-b.cycleStartMs);}return Math.min(item.action.durationMs,t)/1000;}
  function targetBaseline(){return {...neutral,...ambient,...gaze};}
  function enter(target,t){order=target;target.started=t;active={item:target.items[target.index],entryStarted:t,started:t+transitionBump.durationMs,entryBaseline:targetBaseline(),entryAmbient:ambientLayers(t).map(layer=>({...layer}))};bump={kind:'entry',started:t,intensity:active.item.intensity};}
  function sampleBump(t){
    if(!bump)return null;
    const elapsed=t-bump.started;
    if(elapsed>=transitionBump.durationMs){bump=null;return null;}
    apply(transitionBump.clip,Math.max(0,elapsed)/1000);artboard.advance(0);
    const transform=artboard.node(transitionBump.node);return {kind:bump.kind,elapsedMs:elapsed,scaleX:1+(transform.scaleX-1)*bump.intensity,scaleY:1+(transform.scaleY-1)*bump.intensity};
  }
  function render(t){
    const bumpTransform=artboard.node(transitionBump.node);bumpTransform.scaleX=1;bumpTransform.scaleY=1;
    let state=targetBaseline(),layers=ambientLayers(t),playing=null,owned=[];
    if(recovery&&recovery.out.intensity>0){
      const w=weight(t-recovery.started,recoveryMs),out=recovery.out;
      for(const key of Object.keys(contract.ranges))state[key]=state[key]+(out.baseline[key]-state[key])*w;
      layers=[...out.ambientLayers.map(layer=>({...layer,mix:layer.mix*w})),...layers.map(layer=>({...layer,mix:layer.mix*(1-w)}))];
      playing=out.playing?{...out.playing,mix:out.playing.mix*w}:null;owned=out.ownedChannels;
    } else if(active){
      const item=active.item,w=weight(t-active.entryStarted,takeoverMs);owned=item.intensity===0?[]:item.action.channels;
      for(const key of owned)if(key!=='morph')state[key]=neutral[key]+(active.entryBaseline[key]-neutral[key])*w;
      // Freeze the owned ambient sample at takeover. Native envelope fades it
      // while live unowned channels continue independently.
      layers=[...layers.filter(layer=>!owned.includes(layer.channel)),...active.entryAmbient.filter(layer=>owned.includes(layer.channel)).map(layer=>({...layer,mix:layer.mix*w}))];
      playing={clip:item.clip,time:clipTime(item,Math.max(0,t-active.started)),mix:item.intensity*(1-w)};
    }
    // Native Rive samples supply ambient deltas around the saved numeric
    // baseline. Static body/gaze inputs therefore survive a breath/blink.
    const shown={...state};
    const readAmbient={bodyScaleX:()=>artboard.node('BodyDeform').scaleX,bodyScaleY:()=>artboard.node('BodyDeform').scaleY,bodyY:()=>artboard.node('BodyRoot').y-contract.body.centerY,gazeX:()=>artboard.node('Gaze').x,gazeY:()=>artboard.node('Gaze').y,leftOpen:()=>artboard.node('leftOpen').scaleY,rightOpen:()=>artboard.node('rightOpen').scaleY,blink:()=>artboard.node('leftBlink').scaleY};
    for(const layer of layers)if(layer.mix>0){sampler.neutral();apply(layer.clip,layer.time,1);artboard.advance(0);const value=readAmbient[layer.channel]();const [low,high]=contract.ranges[layer.channel];shown[layer.channel]=Math.max(low,Math.min(high,shown[layer.channel]+(value-neutral[layer.channel])*layer.mix));}
    const transition=sampleBump(t);
    sampler.sample(shown);
    if(playing)apply(playing.clip,playing.time,playing.mix);
    const residual=recovery?weight(t-recovery.started,recoveryMs):0;
    const scaleX=transition?.scaleX??(recovery?1+(recovery.out.bumpScaleX-1)*residual:1),scaleY=transition?.scaleY??(recovery?1+(recovery.out.bumpScaleY-1)*residual:1);
    const deform=artboard.node('BodyDeform'),maxX=contract.ranges.bodyScaleX[1],maxY=contract.ranges.bodyScaleY[1];
    bumpTransform.scaleX=Math.max(1,Math.min(scaleX,maxX/deform.scaleX));bumpTransform.scaleY=Math.max(1,Math.min(scaleY,maxY/deform.scaleY));
    artboard.advance(0);
    frame={type:'frame',action:active?.item.id??null,variant:active?.item.variant??null,elapsedMs:active?Math.max(0,t-active.started):0,clipTimeMs:playing?playing.time*1000:0,stage:recovery?'recovery':active?(t<active.started?'entry':active.item.cycling?'sustained':'action'):transition?'return':'idle',baseline:state,ambientLayers:layers,playing,transition:transition?{kind:transition.kind,elapsedMs:transition.elapsedMs,durationMs:transitionBump.durationMs}:null,bumpScaleX:bumpTransform.scaleX,bumpScaleY:bumpTransform.scaleY,intensity:active?.item.intensity??recovery?.out.intensity??bump?.intensity??0,ownedChannels:owned,outgoingOwners:recovery?1:0,pendingOrders:recovery&&order&&order.index<order.items.length?1:0,ambientEnabled,seed,schedule:scheduleLog.map(x=>({...x})),scheduledOccupancyMs:{...occupiedMs},neutral:(!playing||playing.mix===0)&&bumpTransform.scaleX===1&&bumpTransform.scaleY===1&&layers.length===0&&Object.keys(neutral).every(key=>state[key]===neutral[key])};report(frame);
  }
  function recover(t){if(recovery)return;render(t);recovery={started:t,out:frame};active=null;bump=null;}
  function updateAt(current){
    let iterations=0;
    while(iterations++<205){
      if(recovery){if(current+1e-7<recovery.started+recoveryMs)break;const end=recovery.started+recoveryMs,intensity=recovery.out.intensity;recovery=null;if(order&&order.index<order.items.length)enter(order,end);else bump={kind:'return',started:end,intensity};continue;}
      if(!active){if(bump&&current+1e-7>=bump.started+transitionBump.durationMs){bump=null;if(order){const done=order;order=null;settle(done,'completed','completed');}}break;}
      const end=active.started+active.item.duration;if(current+1e-7<end)break;
      recover(end);order.index++;report({type:'itemCompleted',action:recovery.out.action,index:order.index-1});
    }
    render(current);
  }
  function update(){if(!disposed)updateAt(time());}
  function start(items){
    const t=time();updateAt(t);const previous=order;
    if(active||bump)recover(t);
    settle(previous,'cancelled','replaced');
    let resolve;const finished=new Promise(done=>{resolve=done;});const target={items,index:0,started:t,resolve,done:false};order=target;
    if(!recovery)enter(target,t);render(t);
    return Object.freeze({finished,cancel(){if(disposed||target.done||order!==target)return;const current=time();updateAt(current);if(target.done||order!==target)return;if(active||bump)recover(current);order=null;settle(target,'cancelled','handle');render(current);}});
  }
  const controller={
    play(id,options={}){alive();return start([prepare(id,options)]);},
    sequence(items){alive();if(!Array.isArray(items)||!items.length||items.length>100)throw Error('Sequence requires 1–100 items');const prepared=items.map(item=>{if(typeof item==='string')return prepare(item,{},true);object(item,['action','intensity','speed','variant','durationMs','loop']);const {action,...options}=item;return prepare(action,options,true);});return start(prepared);},
    lookAt(x,y){alive();numeric(x,...contract.ranges.gazeX,'gazeX');numeric(y,...contract.ranges.gazeY,'gazeY');const t=time();updateAt(t);gaze={gazeX:x,gazeY:y};render(t);},
    setAmbient(values){alive();object(values,[...Object.keys(contract.ranges),'enabled','seed']);const next={};for(const [key,value]of Object.entries(values)){if(key==='enabled'){if(typeof value!=='boolean')throw Error('enabled: expected boolean');}else if(key==='seed'){if(!Number.isInteger(value)||value<0||value>4294967295)throw Error('seed: expected uint32');}else{numeric(value,...contract.ranges[key],key);next[key]=value;}}const t=time();updateAt(t);if(Object.keys(next).length||(!Object.hasOwn(values,'enabled')&&!Object.hasOwn(values,'seed')))ambient=next;if(Object.hasOwn(values,'seed'))seed=values.seed;if(Object.hasOwn(values,'enabled'))ambientEnabled=values.enabled;if(Object.hasOwn(values,'seed')||Object.hasOwn(values,'enabled'))resetSchedule(t);render(t);},
    stop(){alive();const t=time();settle(order,'cancelled','stopped');order=active=recovery=null;bump=null;ambient={};gaze={};ambientEnabled=false;resetSchedule(t);sampler.neutral();render(t);},
    dispose(){if(disposed)return;settle(order,'cancelled','disposed');order=active=recovery=null;bump=null;ambient={};gaze={};ambientEnabled=false;sampler.neutral();const transform=artboard.node(transitionBump.node);transform.scaleX=1;transform.scaleY=1;artboard.advance(0);disposed=true;try{release?.();}finally{cleanup();}report({type:'disposed'});},
  };
  try{release=subscribe(update);if(typeof release!=='function')throw Error('subscribe must return cleanup function');render(last);}catch(error){controller.dispose();throw error;}
  return Object.freeze(controller);
}
