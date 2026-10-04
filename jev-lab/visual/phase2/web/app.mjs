import { createRigSampler } from "/rig.mjs";

const labels = {gazeX:"Mirada horizontal",gazeY:"Mirada vertical",leftOpen:"Apertura ojo izquierdo",rightOpen:"Apertura ojo derecho",leftTilt:"Inclinación ojo izquierdo (rad)",rightTilt:"Inclinación ojo derecho (rad)",blink:"Parpadeo · 0 cerrado / 1 abierto",bodyX:"Posición horizontal",bodyY:"Posición vertical",bodyRotation:"Giro corporal (rad)",bodyScaleX:"Deformación horizontal",bodyScaleY:"Deformación vertical",light:"Intensidad de luz",morph:"Transición entre formas"};
const shapeLabels = {base:"Base",star:"Estrella",square:"Cuadrado",triangle:"Triángulo",ghost:"Fantasma",flower:"Flor",cloud:"Nube"};
const status = document.getElementById("status"), diagnostics = document.getElementById("diagnostics");
const canvas = document.getElementById("character");
const abort = new AbortController();
let runtime, file, artboard, renderer, sampler, observer, contract, state, ready=false, disposed=false, frame=null, theme="dark";
const inputs = new Map();

async function get(url, json=false) {
  const response = await fetch(url,{cache:"no-store",signal:abort.signal});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return json ? response.json() : response.arrayBuffer();
}

function draw() {
  frame=null;
  if (!ready || disposed || document.hidden) return;
  try {
    sampler.sample(state);
    const rect=canvas.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,3);
    canvas.width=Math.max(1,Math.round(rect.width*dpr)); canvas.height=Math.max(1,Math.round(rect.height*dpr));
    renderer.clear();renderer.save();
    renderer.align(runtime.Fit.contain,runtime.Alignment.center,{minX:0,minY:0,maxX:canvas.width,maxY:canvas.height},artboard.bounds);
    artboard.draw(renderer);renderer.restore();renderer.flush();runtime.resolveAnimationFrame();
    diagnostics.textContent=JSON.stringify(state,null,2);diagnostics.dataset.state="ready";
    canvas.dataset.shape=state.morph===0?state.shapeFrom:state.morph===1?state.shapeTo:`${state.shapeFrom}-${state.shapeTo}`;
  } catch(error) { fail(error); }
}

function wake() {
  if (!ready||disposed||document.hidden||frame!==null) return;
  frame=runtime.requestAnimationFrame(draw);
}

function sync() {
  for(const [key,input] of inputs){input.value=state[key];const output=document.getElementById(`value-${key}`);if(output)output.value=Number(state[key]).toFixed(2);}
  wake();
}

function slider(parent,key,range) {
  const row=document.createElement("div");row.className="control";
  const label=document.createElement("label");label.htmlFor=key;label.textContent=labels[key];
  const output=document.createElement("output");output.id=`value-${key}`;output.htmlFor=key;
  const input=document.createElement("input");input.id=key;input.type="range";input.min=range[0];input.max=range[1];input.step=key.startsWith("body")&&key.endsWith("X")&&!key.includes("Scale")?.1:.01;
  input.addEventListener("input",()=>{state={...state,[key]:Number(input.value)};sync();status.textContent="Pose compuesta. Neutral restaura geometría, ojos, cuerpo y luz.";},{signal:abort.signal});
  inputs.set(key,input);row.append(label,output,input);parent.append(row);
}

function buildControls() {
  const shapes=document.getElementById("shapes"), selects=document.createElement("div");selects.className="shape-selects";
  for(const [key,labelText] of [["shapeFrom","Desde"],["shapeTo","Hasta"]]) {
    const label=document.createElement("label");label.textContent=labelText;
    const select=document.createElement("select");select.id=key;
    for(const name of Object.keys(contract.shapes)){const option=document.createElement("option");option.value=name;option.textContent=shapeLabels[name];select.append(option);}
    select.addEventListener("change",()=>{state={...state,[key]:select.value};sync();},{signal:abort.signal});inputs.set(key,select);label.append(select);selects.append(label);
  }
  shapes.append(selects);slider(shapes,"morph",[0,1]);
  for(const [group,keys] of [["Mirada y ojos",["gazeX","gazeY","leftOpen","rightOpen","leftTilt","rightTilt","blink"]],["Cuerpo y luz",["bodyX","bodyY","bodyRotation","bodyScaleX","bodyScaleY","light"]]]){
    const heading=document.createElement("p");heading.className="group-label";heading.textContent=group;document.getElementById("sliders").append(heading);
    for(const key of keys)slider(document.getElementById("sliders"),key,contract.ranges[key]);
  }
  for(const [name,pose] of Object.entries(contract.poses)){
    const button=document.createElement("button");button.textContent=name[0].toUpperCase()+name.slice(1);button.dataset.pose=name;
    button.addEventListener("click",()=>{state={...contract.neutral,...pose};sync();status.textContent=`Pose ilustrativa: ${name}.`;},{signal:abort.signal});document.getElementById("poses").append(button);
  }
  for(const button of document.querySelectorAll(".toolbar button"))button.disabled=false;
}

function cleanup() {
  if(disposed)return;disposed=true;abort.abort();observer?.disconnect();
  if(frame!==null)runtime?.cancelAnimationFrame(frame);frame=null;
  sampler?.dispose();renderer?.delete();artboard?.delete();file?.unref();runtime?.cleanup?.();
  for(const input of inputs.values())input.disabled=true;
  for(const button of document.querySelectorAll("button"))button.disabled=true;
}

function fail(error){cleanup();diagnostics.dataset.state="error";status.textContent=`Rig no disponible: ${error.message}. Revisa servidor y recarga.`;console.error(error);}

document.getElementById("neutral").addEventListener("click",()=>{state={...contract.neutral};sync();status.textContent="Neutral completo restaurado.";},{signal:abort.signal});
document.getElementById("extreme").addEventListener("click",()=>{state={...contract.neutral,shapeFrom:"star",shapeTo:"cloud",morph:.5,gazeX:8,gazeY:-6,leftOpen:1.35,rightOpen:.15,leftTilt:-.5,rightTilt:.5,blink:.5,bodyX:10,bodyY:-10,bodyRotation:.2,bodyScaleX:1.12,bodyScaleY:.82,light:1};sync();status.textContent="Extremos combinados: canales independientes y ojos contenidos.";},{signal:abort.signal});
document.getElementById("theme").addEventListener("click",event=>{theme=theme==="dark"?"light":"dark";document.documentElement.style.setProperty("--stage",theme==="dark"?"#15131e":"#ebe8f2");event.currentTarget.textContent=theme==="dark"?"Fondo claro":"Fondo oscuro";wake();},{signal:abort.signal});
document.getElementById("capture").addEventListener("click",()=>{
  draw();const capture=document.createElement("canvas");capture.width=canvas.width;capture.height=canvas.height;
  const context=capture.getContext("2d");context.fillStyle=theme==="dark"?"#15131e":"#ebe8f2";context.fillRect(0,0,capture.width,capture.height);context.drawImage(canvas,0,0);
  capture.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="jev-fase2-pose.png";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},"image/png");
},{signal:abort.signal});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&frame!==null){runtime.cancelAnimationFrame(frame);frame=null;}else wake();},{signal:abort.signal});
window.addEventListener("pagehide",cleanup,{once:true});
window.addEventListener("pageshow",event=>{if(event.persisted&&disposed)window.location.reload();});

async function start(){
  try{
    contract=await get("/contract.json",true);state={...contract.neutral};
    window.rive.RuntimeLoader.setWasmUrl("/rive.wasm");window.rive.RuntimeLoader.setWasmFallbackUrl(null);
    runtime=await window.rive.RuntimeLoader.awaitInstance();if(disposed){runtime.cleanup?.();return;}
    file=await runtime.load(new Uint8Array(await get("/rig.riv")),undefined,false);if(disposed){file.unref();return;}
    artboard=file.artboardByName(contract.artboard.name);if(!artboard)throw new Error("Artboard ausente");
    sampler=createRigSampler(runtime,artboard,contract);renderer=runtime.makeRenderer(canvas,true);
    ready=true;buildControls();sync();observer=new ResizeObserver(wake);observer.observe(canvas);
    status.textContent="Rig listo · 7 formas · neutral de revisión 04 · Rive 2.42.2.";
  }catch(error){if(!disposed)fail(error);}
}
start();
