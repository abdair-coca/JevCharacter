import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRigSampler, validateState } from "../visual/phase2/web/rig.mjs";

const contract=JSON.parse(fs.readFileSync(new URL("../visual/phase2/body_contract.v2.json",import.meta.url),"utf8"));
function setup(missing=null){
  const events=[], instances=[];
  class Instance{
    constructor(animation){this.name=animation;instances.push(this);}
    advance(value){events.push(["advance",this.name,this.time,value]);}
    apply(mix){events.push(["apply",this.name,this.time,mix]);}
    delete(){events.push(["delete",this.name]);}
  }
  const board={animationByName:name=>name===missing?null:name,advance:time=>events.push(["board",time])};
  return {runtime:{LinearAnimationInstance:Instance},board,events,instances};
}

test("all finite range edges accepted; malformed input rejected before Rive writes",()=>{
  for(const [key,[low,high]] of Object.entries(contract.ranges)){
    for(const value of [low,high])assert.equal(validateState({...contract.neutral,[key]:value},contract)[key],value);
    for(const value of [low-.001,high+.001,NaN,Infinity,true,"1",null])assert.throws(()=>validateState({...contract.neutral,[key]:value},contract));
  }
  for(const state of [{},null,{...contract.neutral,unknown:1},{...contract.neutral,shapeTo:"__proto__"},{...contract.neutral,morph:NaN}])assert.throws(()=>validateState(state,contract));
  const fixture=setup(),sampler=createRigSampler(fixture.runtime,fixture.board,contract);
  assert.throws(()=>sampler.sample({...contract.neutral,blink:Infinity}));assert.deepEqual(fixture.events,[]);
});

test("each sample resets full neutral, then pair blend, then disjoint channels",()=>{
  const fixture=setup(),sampler=createRigSampler(fixture.runtime,fixture.board,contract);
  sampler.sample({...contract.neutral,shapeFrom:"star",shapeTo:"cloud",morph:.4,leftOpen:.15,rightOpen:1.35,leftTilt:-.5,rightTilt:.5,blink:.35});
  const applies=fixture.events.filter(([kind])=>kind==="apply");
  assert.deepEqual(applies.slice(0,3),[["apply","neutral",0,1],["apply","shape_star",0,1],["apply","shape_cloud",0,.4]]);
  assert.deepEqual(applies.find(event=>event[1]==="channel_leftOpen"),["apply","channel_leftOpen",0,1]);
  assert.deepEqual(applies.find(event=>event[1]==="channel_rightOpen"),["apply","channel_rightOpen",1,1]);
  assert.deepEqual(applies.find(event=>event[1]==="channel_blink"),["apply","channel_blink",.35,1]);
  assert.deepEqual(fixture.events.at(-1),["board",0]);
  fixture.events.length=0;const neutral=sampler.neutral();assert.deepEqual(neutral,contract.neutral);
  assert.deepEqual(fixture.events[0],["advance","neutral",0,0]);
  assert.deepEqual(fixture.events[1],["apply","neutral",0,1]);
  assert.equal(fixture.events.filter(([kind,name])=>kind==="apply"&&name==="channel_blink")[0][2],1);
});

test("independent eye channels compose with closure and repeated neutral",()=>{
  const fixture=setup(),sampler=createRigSampler(fixture.runtime,fixture.board,contract);
  for(const shapeFrom of Object.keys(contract.shapes)){
    sampler.sample({...contract.neutral,shapeFrom,leftOpen:1.35,rightOpen:.15,leftTilt:.5,rightTilt:-.5,blink:0});
    assert.deepEqual(sampler.neutral(),contract.neutral);
  }
  assert.equal(fixture.events.filter(([kind,name,time])=>kind==="apply"&&name==="channel_blink"&&time===0).length,7);
});

test("dispose idempotent; incomplete runtime cleans earlier instances",()=>{
  const fixture=setup(),sampler=createRigSampler(fixture.runtime,fixture.board,contract);
  sampler.dispose();sampler.dispose();assert.equal(fixture.events.filter(([kind])=>kind==="delete").length,fixture.instances.length);
  assert.throws(()=>sampler.neutral(),/cerrado/);
  const incomplete=setup("shape_cloud");assert.throws(()=>createRigSampler(incomplete.runtime,incomplete.board,contract),/ausente/);
  assert.equal(incomplete.events.filter(([kind])=>kind==="delete").length,incomplete.instances.length);
});
