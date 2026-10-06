import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createController} from '../../../visual/phase4/web/controller.mjs';
import {createController as createPhase3Controller} from '../../../visual/phase3/web/controller.mjs';

const root=new URL('../../../',import.meta.url),project=new URL('../../../../',import.meta.url);
const read=relative=>fs.readFileSync(new URL(relative,root));
const catalog=JSON.parse(read('visual/phase4/catalog.json'));
const contract=JSON.parse(read('visual/phase2/body_contract.v2.json'));
const require=createRequire(import.meta.url),rive=require('../../../../node_modules/@rive-app/webgl2/rive.js');
const wasm=fs.readFileSync(new URL('node_modules/@rive-app/webgl2/rive.wasm',project));
rive.RuntimeLoader.setWasmBinary(wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength));
rive.RuntimeLoader.setWasmFallbackUrl(null);
const runtime=await rive.RuntimeLoader.awaitInstance();
const binary=`output/visual-phase4/build/${catalog.generation}/jev_personality_v4.riv`;
const file=await runtime.load(new Uint8Array(read(binary)),undefined,false);
const hash=relative=>crypto.createHash('sha256').update(read(relative)).digest('hex');
const sourceFiles=['visual/phase4/web/controller.mjs','visual/phase4/catalog.json','visual/phase4/behavior.json','validators/personality_phase4.py','visual/phase2/web/rig.mjs','visual/phase2/body_contract.v2.json',binary];
const report={status:'PASS',runtime:'@rive-app/webgl2 2.42.2 actual native WASM',generation:catalog.generation,startedUtc:new Date().toISOString(),sourceHashes:Object.fromEntries(sourceFiles.map(x=>[x,hash(x)])),tests:[],limitations:['Finite native node samples; no analytical geometry certification, pixel-quality judgment, or C1 claim.','Compiled morph geometry is exercised but node readbacks do not expose all Bézier vertex coordinates.']};
report.programSha256=crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex');
report.wasmSha256=crypto.createHash('sha256').update(wasm).digest('hex');
report.installedRuntimeVersion=JSON.parse(fs.readFileSync(new URL('node_modules/@rive-app/webgl2/package.json',project))).version;
assert.equal(report.installedRuntimeVersion,'2.42.2');
const nodes=['BodyRoot','BodyDeform','Gaze','leftTilt','rightTilt','leftOpen','rightOpen','leftBlink','rightBlink'];
const fields=['x','y','rotation','scaleX','scaleY'];
function pose(board){return Object.fromEntries(nodes.flatMap(name=>fields.map(field=>[`${name}.${field}`,board.node(name)[field]])));}
function delta(a,b){let max=0,key=null;for(const k of Object.keys(a)){assert.ok(Number.isFinite(a[k])&&Number.isFinite(b[k]),`nonfinite ${k}`);if(Math.abs(a[k]-b[k])>max){max=Math.abs(a[k]-b[k]);key=k;}}return{max,key};}
function exact(a,b,tolerance=1e-5){const d=delta(a,b);assert.ok(d.max<tolerance,`native C0 delta ${d.max} at ${d.key}`);return d.max;}
function fixture({tracked=false}={}){
 const board=file.artboardByName(contract.artboard.name);let clock=0,tick,lastFrame,releases=0,created=0,deleted=0,doubleDeletes=0;
 const actual=runtime.LinearAnimationInstance;
 const adapter=tracked?{LinearAnimationInstance:class{constructor(...args){const clip=new actual(...args),nativeDelete=clip.delete.bind(clip);let gone=false;created++;clip.delete=()=>{if(gone){doubleDeletes++;throw Error('double native delete');}gone=true;deleted++;nativeDelete();};return clip;}}}:runtime;
 const controller=createController({runtime:adapter,artboard:board,contract,catalog,now:()=>clock,subscribe(callback){tick=callback;return()=>{releases++;tick=null;};},onChange(event){if(event.type==='frame')lastFrame=event;}});
 return{board,controller,get frame(){return lastFrame;},at(t){assert.ok(t>=clock);clock=t;tick?.();},pose(){return pose(board);},counts(){return{created,deleted,doubleDeletes,releases,subscribed:!!tick};},dispose(){controller.dispose();board.delete();}};
}
async function check(name,fn){try{const measurements=await fn();report.tests.push({name,status:'PASS',measurements});console.log(`PASS ${name}`);}catch(error){report.status='FAIL';report.tests.push({name,status:'FAIL',error:error.stack});console.log(`FAIL ${name}: ${error.message}`);}}

await check('C0 replacements across every action and sustained-cycle phase',async()=>{
 let maximum=0,count=0;const recoveryMaxima={};
 for(const action of Object.values(catalog.actions))for(const variant of Object.keys(action.variants))for(const fraction of [.09,.39,.77]){
  const f=fixture();f.controller.setAmbient({bodyY:3.25,bodyScaleX:1.08,bodyScaleY:.94,blink:.82,light:.8});f.controller.lookAt(-4,2);
  const h=f.controller.play(action.id,{variant,...(action.behavior?{loop:true}:{})});const t=action.durationMs*fraction;f.at(t);
  let prior=f.pose();const next=f.controller.play('hello');maximum=Math.max(maximum,exact(prior,f.pose()));
  for(let elapsed=1;elapsed<=150;elapsed++){f.at(t+elapsed);const current=f.pose();for(const key of Object.keys(prior))recoveryMaxima[key]=Math.max(recoveryMaxima[key]??0,Math.abs(prior[key]-current[key]));prior=current;assert.equal(f.frame.outgoingOwners,elapsed<150?1:0);}
  assert.equal((await h.finished).reason,'replaced');assert.equal(f.frame.action,'hello');f.controller.stop();assert.equal((await next.finished).reason,'stopped');f.dispose();count++;
 }
 return{cases:count,sameTimestampMaxNativeDelta:maximum,perOneMsRecoveryMaxima:recoveryMaxima};
});

await check('latest pending replacement cannot restart frozen recovery or inherit stale cancellation',async()=>{
 const f=fixture();const first=f.controller.play('transform_star');f.at(663.5);const freeze=f.pose();const replaced=[];
 let latest=f.controller.play('yes');exact(freeze,f.pose());
 for(const offset of [0,.001,1,29,87,149.999]){f.at(663.5+offset);const before=f.pose();replaced.push(latest);latest=f.controller.play(offset===149.999?'speech':'no',{...(offset===149.999?{variant:'bc',loop:true}:{})});exact(before,f.pose());first.cancel();for(const stale of replaced)stale.cancel();assert.equal(f.frame.outgoingOwners,1);assert.equal(f.frame.pendingOrders,1);}
 f.at(813.5);assert.equal(f.frame.action,'speech');assert.equal(f.frame.elapsedMs,0);assert.equal(f.frame.outgoingOwners,0);
 for(const handle of [first,...replaced])assert.equal((await handle.finished).reason,'replaced');
 f.at(999.5);const before=f.pose();latest.cancel();exact(before,f.pose());f.at(1149.5);assert.equal(f.frame.stage,'idle');assert.equal((await latest.finished).reason,'handle');f.dispose();
 return{replacements:replaced.length,originalRecoveryEndMs:813.5};
});

await check('wallclock duration, cycle loops, speed and late sequence frames',async()=>{
 const results=[];
 for(const action of ['think','speech'])for(const variant of Object.keys(catalog.actions[action].variants))for(const speed of [.1,.37,1,4]){
  const f=fixture();const handle=f.controller.play(action,{variant,speed,durationMs:977.25});f.at(977.249);assert.equal(f.frame.stage,'sustained');const before=f.pose();f.at(977.25);exact(before,f.pose(),.001);assert.equal(f.frame.stage,'recovery');f.at(1127.25);assert.equal((await handle.finished).status,'completed');assert.equal(f.frame.neutral,true);results.push({action,variant,speed,totalMs:1127.25});f.dispose();
 }
 const f=fixture(),items=Array.from({length:100},(_,i)=>({action:i%2?'speech':'think',durationMs:1,speed:i%2?.1:4})),h=f.controller.sequence(items);f.at(15100);assert.equal((await h.finished).completedItems,100);assert.equal(f.frame.neutral,true);f.dispose();
 return{durations:results,maximumAcceptedSequenceItems:100,overshootToMs:15100};
});

await check('native loop seam positions and directional velocities',()=>{
 const f=fixture(),results=[];
 for(const action of Object.values(catalog.actions).filter(a=>a.behavior))for(const [variant,v]of Object.entries(action.variants)){
  const clip=new runtime.LinearAnimationInstance(f.board.animationByName(v.clip),f.board),b=action.behavior;
  const sample=ms=>{f.controller.stop();clip.time=ms/1000;clip.advance(0);clip.apply(1);f.board.advance(0);return f.pose();};
  const start=sample(b.cycleStartMs),end=sample(b.cycleEndMs),after=sample(b.cycleStartMs+.25),before=sample(b.cycleEndMs-.25);
  const positionDelta=exact(start,end),velocityDifference=Math.max(...Object.keys(start).map(k=>Math.abs((after[k]-start[k])/.25-(end[k]-before[k])/.25)));
  assert.ok(velocityDifference<.001,`loop velocity mismatch ${action.id}:${variant} ${velocityDifference}`);results.push({action:action.id,variant,positionDelta,finiteDifferenceVelocityMismatchPerMs:velocityDifference});clip.delete();
 }
 f.dispose();return results;
});

await check('ambient enabled replacement and ownership release match moving numeric target',async()=>{
 const results=[];
 for(const time of [7100,8477.4751883,9120,9156.1347,9200]){
  const f=fixture(),reference=fixture(),values={enabled:true,seed:731,bodyY:4,bodyScaleX:1.07,bodyScaleY:.95,blink:.8};
  for(const g of [f,reference]){g.controller.setAmbient(values);g.controller.lookAt(3,-2);}
  const original=f.controller.play('speech',{loop:true,variant:'bc'});f.at(time);const before=f.pose();const pending=f.controller.play('hello');const commandDelta=exact(before,f.pose());pending.cancel();original.cancel();
  f.at(time+149.999);const near=f.pose();f.at(time+150);reference.at(time+150);const targetDelta=exact(reference.pose(),f.pose()),endpointDelta=exact(near,f.pose(),.001);assert.equal((await original.finished).reason,'replaced');assert.equal((await pending.finished).reason,'handle');
  results.push({timeMs:time,commandDelta,targetDelta,endpointDelta});f.dispose();reference.dispose();
 }return results;
});

await check('ten-minute ambient occupancy is quiet, deterministic and schedule log bounded',()=>{
 const f=fixture(),reference=fixture();for(const g of [f,reference])g.controller.setAmbient({enabled:true,seed:731});const baseline=f.pose();let quiet=0,total=0,maxLog=0,nativeQuietDelta=0;
 for(let t=0;t<=600000;t+=100){f.at(t);total++;maxLog=Math.max(maxLog,f.frame.schedule.length);if(!f.frame.ambientLayers.length){quiet++;nativeQuietDelta=Math.max(nativeQuietDelta,exact(baseline,f.pose()));}}
 reference.at(600000);const result={horizonMs:600000,samplePeriodMs:100,quietSampleFraction:quiet/total,maxScheduleEntries:maxLog,scheduledOccupancyMs:f.frame.scheduledOccupancyMs,nativeQuietDelta,fineSchedule:f.frame.schedule,coarseSchedule:reference.frame.schedule,coarseOccupancyMs:reference.frame.scheduledOccupancyMs,nativeCadencePoseDelta:delta(f.pose(),reference.pose())};report.scheduleCadence=result;f.dispose();reference.dispose();
 assert.ok(JSON.stringify(result.fineSchedule)===JSON.stringify(result.coarseSchedule),'Seeded ambient schedule differs between 100ms ticks and one 600000ms late tick');assert.deepEqual(result.scheduledOccupancyMs,result.coarseOccupancyMs);assert.equal(result.nativeCadencePoseDelta.max,0);assert.ok(quiet/total>.65);assert.ok(maxLog<=32);return result;
});

await check('same-time replacement improves measured native node discontinuity against phase 3',async()=>{
 const oldCatalog=JSON.parse(read('visual/phase3/catalog.json')),oldBinary=`output/visual-phase3/build/${oldCatalog.generation}/jev_actions_v3.riv`;
 // Read-only comparison uses each phase's own compiled source and accepted action.
 const oldFile=await runtime.load(new Uint8Array(read(oldBinary)),undefined,false),board=oldFile.artboardByName(contract.artboard.name);let clock=0,tick;
 const old=createPhase3Controller({runtime,artboard:board,contract,catalog:oldCatalog,now:()=>clock,subscribe(callback){tick=callback;return()=>{tick=null;};}});
 old.play('happy_bounce');clock=250;tick();const previous=pose(board);old.play('curious_look');const phase3Delta=delta(previous,pose(board));
 const f=fixture();f.controller.play('happy_bounce');f.at(250);const previous4=f.pose();f.controller.play('curious_look');const phase4Delta=delta(previous4,f.pose());assert.ok(phase3Delta.max>.01);assert.equal(phase4Delta.max,0);
 old.dispose();board.delete();oldFile.unref();f.dispose();return{timeMs:250,phase3Delta,phase4Delta,phase3CatalogHash:hash('visual/phase3/catalog.json'),phase3BinaryHash:hash(oldBinary),scope:'Mixed-unit native node maximum at same timestamp; finite C0 evidence only, no subjective superiority or C1 claim.'};
});

await check('recovery toward nonneutral numeric baseline has no endpoint pop',async()=>{
 let endpointMaximum=0,sameTimeMaximum=0;const targets=[];
 for(const action of ['hello','think','speech','transform_cloud','curious_look']){
  const f=fixture();f.controller.setAmbient({bodyY:4,bodyRotation:.075,bodyScaleX:1.12,bodyScaleY:.9,blink:.69,leftOpen:.81,rightOpen:1.17,light:.78});f.controller.lookAt(5,-3);const target=f.pose();
  const h=f.controller.play(action,{...(catalog.actions[action].behavior?{loop:true}:{}),...(action==='speech'?{variant:'bc'}:{})});f.at(615.25);const before=f.pose();h.cancel();sameTimeMaximum=Math.max(sameTimeMaximum,exact(before,f.pose()));f.at(765.249);const near=f.pose();f.at(765.25);endpointMaximum=Math.max(endpointMaximum,exact(near,f.pose(),.0001));exact(target,f.pose());assert.equal((await h.finished).reason,'handle');targets.push(action);f.dispose();
 }
 return{actions:targets,sameTimeMaximum,endpointMaximum,endpointSampleDistanceMs:.001};
});

await check('ambient actual native samples add to numeric baseline; owned channels suppress live layers',()=>{
 const f=fixture();f.controller.setAmbient({enabled:true,seed:731,bodyY:4,bodyScaleX:1.08,bodyScaleY:.93,blink:.75});
 const base=f.pose();let events;for(let t=0;t<25000;t+=10){f.at(t);if(f.frame.schedule.some(e=>e.kind==='blink')&&f.frame.schedule.some(e=>e.kind==='breath')){events=f.frame.schedule;break;}}
 // Use an independent fixture and native direct clips; no frame.baseline oracle.
 const observations=[];
 for(const kind of ['breath','blink']){
  const event=events.find(e=>e.kind===kind),g=fixture();g.controller.setAmbient({enabled:true,seed:731,bodyY:4,bodyScaleX:1.08,bodyScaleY:.93,blink:.75});const time=event.startMs+catalog.behavior.ambient[kind].durationMs/2;g.at(time);
  const direct=fixture(),channels=kind==='breath'?{bodyY:['BodyRoot.y',contract.body.centerY,4],bodyScaleX:['BodyDeform.scaleX',1,1.08],bodyScaleY:['BodyDeform.scaleY',1,.93]}:{blink:['leftBlink.scaleY',1,.75]};
  for(const [channel,[key,neutral,baseline]]of Object.entries(channels)){
   direct.controller.stop();const clip=new runtime.LinearAnimationInstance(direct.board.animationByName(catalog.ambientClips[kind][channel]),direct.board);clip.time=(time-event.startMs)/1000;clip.advance(0);clip.apply(1);direct.board.advance(0);
   const nativeDelta=direct.pose()[key]-neutral,[low,high]=contract.ranges[channel],expected=Math.max(low,Math.min(high,baseline+nativeDelta))+(channel==='bodyY'?contract.body.centerY:0),actual=g.pose()[key];assert.ok(Math.abs(expected-actual)<1e-5,`${kind}.${channel} expected ${expected}, actual ${actual}`);observations.push({kind,channel,timeMs:time,nativeDelta,baseline,expected,actual});clip.delete();
  }direct.dispose();g.dispose();
 }
 const enabled=fixture(),disabled=fixture();enabled.controller.setAmbient({enabled:true,seed:731});const breath=events.find(e=>e.kind==='breath');enabled.at(breath.startMs+1000);disabled.at(breath.startMs+1000);enabled.controller.play('speech',{loop:true});disabled.controller.play('speech',{loop:true});enabled.at(breath.startMs+1400);disabled.at(breath.startMs+1400);
 for(const channel of catalog.actions.speech.channels){const keys={bodyY:['BodyRoot.y'],bodyRotation:['BodyRoot.rotation'],bodyScaleX:['BodyDeform.scaleX'],bodyScaleY:['BodyDeform.scaleY'],blink:['leftBlink.scaleY','rightBlink.scaleY'],gazeX:['Gaze.x'],gazeY:['Gaze.y'],leftOpen:['leftOpen.scaleY'],rightOpen:['rightOpen.scaleY']}[channel]??[];for(const key of keys)assert.ok(Math.abs(enabled.pose()[key]-disabled.pose()[key])<1e-5,`owned live ambient leaked ${key}`);}
 enabled.dispose();disabled.dispose();f.dispose();return observations;
});

await check('enabled and seed toggles preserve existing numeric baseline and gaze',()=>{
 const f=fixture();f.controller.setAmbient({bodyY:4,bodyScaleX:1.07,bodyScaleY:1.03,blink:.72,leftOpen:.84});f.controller.lookAt(-5,3);const baseline=f.pose();
 f.controller.setAmbient({enabled:true});exact(baseline,f.pose());f.controller.setAmbient({seed:777});exact(baseline,f.pose());f.at(50);exact(baseline,f.pose());f.controller.setAmbient({enabled:false});exact(baseline,f.pose());f.controller.setAmbient({seed:731});exact(baseline,f.pose());
 f.controller.setAmbient({bodyY:2});const replaced=f.pose();assert.ok(Math.abs(replaced['BodyRoot.y']-172)<1e-5);assert.ok(Math.abs(replaced['BodyDeform.scaleY']-1)<1e-5);assert.ok(Math.abs(replaced['Gaze.x']+5)<1e-5);f.dispose();return{toggleCommands:4,numericBaselineAndGazeDelta:0,numericReplacementSemanticsVerified:true};
});

await check('invalid options preserve good native order and schedule',async()=>{
 const f=fixture();f.controller.setAmbient({enabled:true,seed:111,bodyY:2});const h=f.controller.play('speech',{loop:true,variant:'c'});f.at(500);const prior=f.pose(),frame=f.frame;
 const bad=[()=>f.controller.play('speech',{variant:'absent'}),()=>f.controller.play('think',{durationMs:0}),()=>f.controller.play('think',{loop:true,durationMs:100}),()=>f.controller.play('hello',{loop:false}),()=>f.controller.play('no',{intensity:Infinity}),()=>f.controller.play('yes',{speed:undefined}),()=>f.controller.sequence(['yes',{action:'think',speed:-1}]),()=>f.controller.setAmbient({seed:2**32}),()=>f.controller.lookAt(NaN,0)];
 for(const fn of bad){assert.throws(fn);exact(prior,f.pose());assert.equal(f.frame,frame);}f.at(900);assert.equal(f.frame.action,'speech');h.cancel();f.at(1050);assert.equal((await h.finished).reason,'handle');f.dispose();return{rejectedOrders:bad.length};
});

await check('intensity zero variants remain exact neutral; stop and dispose clear future activity',async()=>{
 let cases=0;for(const action of Object.values(catalog.actions))for(const variant of Object.keys(action.variants)){
  const f=fixture(),baseline=f.pose(),h=f.controller.play(action.id,{variant,intensity:0,...(action.behavior?{loop:true}:{})});for(const t of [51,199,617]){f.at(t);exact(baseline,f.pose());}f.controller.stop();const stopped=f.pose();f.at(120000);exact(stopped,f.pose());assert.equal(f.frame.schedule.length,0);assert.equal(f.frame.neutral,true);assert.equal((await h.finished).reason,'stopped');f.dispose();cases++;
 }return{variants:cases};
});

await check('1000 orders keep fixed native allocation; idempotent dispose deletes each exactly once',async()=>{
 const f=fixture({tracked:true}),initial=f.counts();f.controller.setAmbient({enabled:true,seed:731});f.controller.play('think',{loop:true});f.at(777);let latest;
 for(let i=0;i<1000;i++){const before=f.pose();latest=f.controller.play(i%2?'transform_square':'speech',i%2?{}:{loop:true,variant:'b'});exact(before,f.pose());assert.equal(f.frame.outgoingOwners,1);assert.equal(f.frame.pendingOrders,1);assert.equal(f.counts().created,initial.created);}
 f.at(927);assert.equal(f.frame.action,'transform_square');f.controller.dispose();f.controller.dispose();f.at(1000000);const end=f.counts();assert.equal(end.deleted,end.created);assert.equal(end.doubleDeletes,0);assert.equal(end.releases,1);assert.equal(end.subscribed,false);assert.equal((await latest.finished).reason,'disposed');assert.throws(()=>f.controller.play('yes'),/disposed/);f.board.delete();return{initial,end,orders:1000};
});

report.finishedUtc=new Date().toISOString();report.sourceHashesAfter=Object.fromEntries(sourceFiles.map(x=>[x,hash(x)]));report.sourceStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);
if(!report.sourceStable){report.status='UNSTABLE_SOURCE';console.log('UNSTABLE_SOURCE: rerun after final writer handoff');}
fs.writeFileSync(new URL('native-independent-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
file.unref();runtime.cleanup?.();console.log(`${report.status}: ${report.tests.filter(t=>t.status==='PASS').length}/${report.tests.length}`);
process.exitCode=report.status==='PASS'?0:1;
