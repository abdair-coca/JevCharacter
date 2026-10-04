"""Phase-4 semantic repertoire, native envelopes, isolated immutable preview."""
import argparse, copy, hashlib, json, math, shutil, subprocess, tempfile, threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET
import author_phase3 as author
import rig_phase2 as rig
LAB=rig.LAB
SOURCE=LAB/'visual/phase4'
OUTPUT=LAB/'output/visual-phase4'
EXTRAS={'behavior','originalState','originalVariants'}

def discover(source=SOURCE):
    contract=rig.load_contract(); result=[]; ids=set()
    for path in sorted((Path(source)/'actions').glob('*.json')):
        value=author.read_definition(path)
        stripped={key:item for key,item in value.items() if key not in EXTRAS}
        author.validate_definition(stripped,contract,path.name)
        if value['id'] in ids: author.fail(path.name,'/id','Duplicate action identifier')
        ids.add(value['id'])
        if 'originalState' in value and value['originalState'] is not None and (not isinstance(value['originalState'],str) or not value['originalState']): author.fail(path.name,'/originalState','Expected nonempty string or null')
        if 'originalVariants' in value:
            author.fields(value['originalVariants'],{'default',*value.get('variants',{})},[],path.name,'/originalVariants')
            for key,item in value['originalVariants'].items():
                if not isinstance(item,str) or not item: author.fail(path.name,'/originalVariants/'+key,'Expected nonempty string')
        behavior=value.get('behavior')
        if behavior:
            author.fields(behavior,{'kind','entryEndMs','cycleStartMs','cycleEndMs','exitStartMs'}, {'kind','entryEndMs','cycleStartMs','cycleEndMs','exitStartMs'},path.name,'/behavior')
            if behavior['kind']!='sustained': author.fail(path.name,'/behavior/kind','Expected sustained')
            times=[behavior[key] for key in ('entryEndMs','cycleStartMs','cycleEndMs','exitStartMs')]
            for key in ('entryEndMs','cycleStartMs','cycleEndMs','exitStartMs'): author.number(behavior[key],0,value['durationMs'],path.name,'/behavior/'+key)
            if not 0<times[0]==times[1]<times[2]<=times[3]<value['durationMs']: author.fail(path.name,'/behavior','Invalid entry/cycle/exit order')
            phases={phase['timeMs']:phase for phase in value['phases']}
            if any(t not in phases for t in times): author.fail(path.name,'/behavior','Semantic times must identify authored phases')
            for variant,overrides in [('default',{}),*value.get('variants',{}).items()]:
                a=phases[times[1]]['pose']; b=phases[times[2]]['pose']
                if {**value['poses'][a],**overrides.get(a,{})}!={**value['poses'][b],**overrides.get(b,{})}: author.fail(path.name,'/behavior/cycleEndMs',f'{variant}: every owned channel must match cycle endpoints')
            for phase in value['phases']:
                if phase['curve'][1]!=0 or phase['curve'][3]!=1: author.fail(path.name,'/phases','Sustained joins require flat endpoint cubic tangents')
        elif 'behavior' in value: author.fail(path.name,'/behavior','Expected behavior object')
        result.append((path,value))
    if not result: author.fail('actions','/','No definitions')
    return result

def read_behavior(source):
    path=Path(source)/'behavior.json'; b=author.read_definition(path)
    author.fields(b,{'schema','recoveryMs','takeoverMs','ambient'},{'schema','recoveryMs','takeoverMs','ambient'},path.name,'')
    if b['schema']!=1: author.fail(path.name,'/schema','Expected schema 1')
    for key in ('recoveryMs','takeoverMs'): author.number(b[key],120,180,path.name,'/'+key)
    a=b['ambient'];author.fields(a,{'seed','enabled','breath','blink'},{'seed','enabled','breath','blink'},path.name,'/ambient')
    if type(a['seed']) is not int or not 0<=a['seed']<=4294967295: author.fail(path.name,'/ambient/seed','Expected uint32')
    if type(a['enabled']) is not bool: author.fail(path.name,'/ambient/enabled','Expected boolean')
    for name,duration,bounds,channels in [('breath',2800,[5000,9000],['bodyScaleX','bodyScaleY','bodyY']),('blink',150,[5000,12000],['blink'])]:
        entry=a[name];author.fields(entry,{'durationMs','pauseMs','channels'},{'durationMs','pauseMs','channels'},path.name,'/ambient/'+name)
        if entry['durationMs']!=duration or entry['pauseMs']!=bounds or entry['channels']!=channels: author.fail(path.name,'/ambient/'+name,'Scheduler contract changed; fixed discreet timing and channels required')
    return b

def generate(source=SOURCE):
    definitions=discover(source); behavior=read_behavior(source)
    # Read-only phase-3 compiler adapter: explicit temporary source, never defaults.
    with tempfile.TemporaryDirectory(prefix='jev-phase4-') as temp:
        folder=Path(temp);(folder/'actions').mkdir()
        for path,value in definitions: (folder/'actions'/path.name).write_text(json.dumps({k:v for k,v in value.items() if k not in EXTRAS}),encoding='utf-8')
        root,catalog=author.generate(folder)
    catalog['schema']=2;catalog['behavior']=behavior
    for path,value in definitions:
        record=catalog['actions'][value['id']]
        record['sourceSha256']=rig.digest(path)
        for key in EXTRAS:
            if key in value: record[key]=value[key]
    s=rig.SceneBuilder();s.root=root;s.serial=max(int(e.get('id').split(':')[1]) for e in root.iter() if e.get('id'))
    board=root.find('Artboard'); envelope=s.node(board,'PlaybackEnvelope',x=1)
    def timeline(name,keys,phases,duration):
        clip=s.add(board,'LinearAnimation',name=name,fps=60,duration=round(duration*.06),loopValue='oneShot')
        for object_id,props in keys.items():
            obj=s.add(clip,'KeyedObject',objectId=object_id)
            for key,values in props.items():
                prop=s.add(obj,'KeyedProperty',propertyKey=key)
                for (milliseconds,_),amount in zip(phases,values):
                    frame=s.add(prop,'KeyFrameDouble',frame=round(milliseconds*.06),value=amount,interpolationType='cubic')
                    s.add(frame,'CubicEaseInterpolator',x1=.42,y1=0,x2=.58,y2=1)
        return clip
    timeline('playback_envelope',{envelope.get('id'):{13:[1,0]}},[(0,None),(150,None)],150)
    catalog['envelope']=dict(clip='playback_envelope',node='PlaybackEnvelope',durationMs=150)
    contract=rig.load_contract(); sampler,_,shapes,channels=rig.build_scene(contract)
    catalog['ambientClips']={}
    for name,phases in [('breath',[(0,{}),(1400,dict(bodyScaleX=1.004,bodyScaleY=1.008,bodyY=-.35)),(2800,{})]),('blink',[(0,{}),(66.66666666666667,dict(blink=0)),(83.33333333333333,dict(blink=0)),(150,{})])]:
        catalog['ambientClips'][name]={}
        samples=[rig.pose_properties({**contract['neutral'],**pose},contract,sampler,shapes,channels) for _,pose in phases]
        for channel in behavior['ambient'][name]['channels']:
            keys={obj:{key:[sample[obj][key] for sample in samples] for key in props} for obj,props in channels[channel].items()}
            clip='ambient_'+name+'__'+channel;timeline(clip,keys,phases,phases[-1][0]);catalog['ambientClips'][name][channel]=clip
    ET.indent(root,space='  ')
    return root,catalog

class PersonalityStore(author.AuthoringStore):
    def __init__(self,source=SOURCE,output=OUTPUT): super().__init__(source,output)
    def sources_hash(self):
        paths=[*sorted((self.source/'actions').glob('*.json')),self.source/'behavior.json']
        return hashlib.sha256(b''.join(path.name.encode()+path.read_bytes() for path in paths)).hexdigest()
    def refresh(self,force=False):
        try:
            fingerprint=self.sources_hash()
            if not force and fingerprint==self.fingerprint:return False
            self.fingerprint=fingerprint
            root,catalog=generate(self.source); scene=ET.tostring(root,encoding='unicode')+'\n'
            generation=hashlib.sha256((scene+json.dumps(catalog,sort_keys=True)).encode()).hexdigest()[:20]
            stage=self.output/'build'/generation; project=stage/'project';project.mkdir(parents=True,exist_ok=True)
            rig.write_xml(root,project/'scene.rml');(project/'rive.yaml').write_text(f'name: jev_personality_v4\nmain: JevRigV2\noutput:\n  dir: {stage.as_posix()}\n',encoding='utf-8')
            logs={}
            for mode,args in [('verify',['--verify','--format=json']),('once',['--once','--format=json']),('inspect',['--summary'])]:
                command=[str(rig.CLI),str(project),*args] if mode!='inspect' else [str(rig.CLI),'inspect',str(project),*args]
                result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8');logs[mode]=dict(command=command,exitCode=result.returncode,stdout=result.stdout,stderr=result.stderr)
                (self.output/f'cli-{mode}.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
                if result.returncode: author.fail('scene.rml','/',f'CLI {mode}: {result.stderr or result.stdout}')
                parsed=json.loads(result.stdout)
                if parsed.get('problems'):author.fail('scene.rml','/',str(parsed['problems']))
            catalog['generation']=generation; riv=(stage/'jev_personality_v4.riv').read_bytes();data=(json.dumps(catalog,indent=2,ensure_ascii=False)+'\n').encode()
            if self.sources_hash()!=fingerprint: author.fail('actions','/','Sources changed during compilation')
            (self.source/'scene.rml').write_text(scene,encoding='utf-8');(self.source/'catalog.json').write_bytes(data)
            (self.source/'rive.yaml').write_text('name: jev_personality_v4\nmain: JevRigV2\noutput:\n  dir: ../../output/visual-phase4/build/manual\n',encoding='utf-8')
            (self.output/'compile-validation.json').write_text(json.dumps(dict(status='PASS',cli='1.3.0',runtime='2.42.2',generation=generation,actions=len(catalog['actions']),variants=sum(len(a['variants']) for a in catalog['actions'].values()),bytes=len(riv),logs=logs),indent=2)+'\n',encoding='utf-8')
            with self.lock:self.snapshots[generation]=(data,riv);self.generation=generation;self.error=None;self.revision+=1
            print(f'Built phase4 {generation}',flush=True);return True
        except (ValueError,OSError,subprocess.SubprocessError) as error:
            diagnostic=error.diagnostic() if isinstance(error,author.DefinitionError) else dict(file='actions',pointer='/',message=str(error))
            with self.lock:self.error=diagnostic;self.revision+=1
            print(f'Last valid retained: {diagnostic}',flush=True);return False

def route(path,store):
    path=unquote(urlsplit(path).path)
    if path=='/status.json':return 'application/json',json.dumps(store.status()).encode()
    if path.startswith('/generation/'):return author.route(path,store)
    paths={'/':(SOURCE/'web/index.html','text/html'),'/style.css':(SOURCE/'web/style.css','text/css'),'/app.mjs':(SOURCE/'web/app.mjs','text/javascript'),'/controller.mjs':(SOURCE/'web/controller.mjs','text/javascript'),'/phase2/web/rig.mjs':(rig.SOURCE/'web/rig.mjs','text/javascript'),'/contract.json':(rig.SOURCE/'body_contract.v2.json','application/json'),'/rive.js':(OUTPUT/'browser/rive.js','text/javascript'),'/rive.wasm':(OUTPUT/'browser/rive.wasm','application/wasm'),'/original.riv':(LAB.parent/'public/rive/prove1.riv','application/octet-stream')}
    if path not in paths:raise PermissionError('Route not authorized')
    file,mime=paths[path];return mime,file.read_bytes()

def serve(store,port):
    package=LAB.parent/'node_modules/@rive-app/webgl2'
    if json.loads((package/'package.json').read_text())['version']!='2.42.2':raise ValueError('Runtime mismatch')
    browser=OUTPUT/'browser';browser.mkdir(exist_ok=True)
    for name in ('rive.js','rive.wasm'):shutil.copyfile(package/name,browser/name)
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            try:mime,data=route(self.path,store)
            except PermissionError:self.send_error(403);return
            except FileNotFoundError:self.send_error(404);return
            self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
        def log_message(self,*args):pass
    stop=threading.Event()
    def watch():
        while not stop.wait(.5):store.refresh()
    threading.Thread(target=watch,daemon=True).start()
    print(f'Phase4 preview http://127.0.0.1:{port}/',flush=True)
    try:ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
    finally:stop.set()

def render_evidence(store):
    """Focused real CLI captures; controller recovery is measured by native harness."""
    from PIL import Image,ImageChops,ImageDraw
    root,catalog=generate(store.source);frames=store.output/'renders';frames.mkdir(parents=True,exist_ok=True);captures={};logs=[];checks=[]
    def project(label,machine_name='RigNeutral',interrupted=False,ambient_clip=None):
        tree=copy.deepcopy(root);board=tree.find('Artboard');selected=next(m for m in board.findall('StateMachine') if m.get('name')==machine_name)
        if interrupted:
            layer=selected.find('StateMachineLayer');playing=layer.findall('AnimationState')[0];transition=playing.find('StateTransition');transition.set('exitTimeIsPercetange','false');transition.set('exitTime','425');transition.set('duration','150')
        if ambient_clip:
            clip=next(c for c in board.findall('LinearAnimation') if c.get('name')==ambient_clip);selected.find('StateMachineLayer/AnimationState').set('animationId',clip.get('id'))
        needed={state.get('animationId') for state in selected.iter('AnimationState')}
        for node in list(board):
            if node.tag=='StateMachine' and node is not selected:board.remove(node)
            elif node.tag=='LinearAnimation' and node.get('id') not in needed:board.remove(node)
        board.set('defaultStateMachineId',selected.get('id'));directory=store.output/'harness'/label;directory.mkdir(parents=True,exist_ok=True);rig.write_xml(tree,directory/'scene.rml');(directory/'rive.yaml').write_text('name: proof\nmain: JevRigV2\n',encoding='utf-8');return directory
    def capture(directory,label,frame):
        path=frames/(label+'.png');command=[str(rig.CLI),str(directory),f'--screenshot={path}',f'--advance={frame}','--fit=contain'];result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',check=True);image=Image.open(path).convert('RGBA');background=Image.new('RGB',image.size,image.getpixel((0,0))[:3]);
        if image.size!=(360,340) or ImageChops.difference(image.convert('RGB'),background).getbbox() is None:raise ValueError('Invalid invisible render '+label)
        captures[label]=image;logs.append(dict(label=label,frame=frame,command=command,exitCode=result.returncode,stdout=result.stdout,stderr=result.stderr));return image
    baseline=capture(project('neutral'),'neutral-initial',1)
    for action in catalog['actions'].values():
        for variant,v in action['variants'].items():
            label=action['id']+'-'+variant;directory=project(label,v['machine']);phase=next((p for p in action['phases'] if p['name']=='beat_one'),None) or next((p for p in action['phases'] if p['name'] in ('recognize','hold','apex','quiet_hold')),action['phases'][len(action['phases'])//2]);capture(directory,label+'-active',round(phase['timeMs']*.06)+1);final=capture(directory,label+'-neutral',round(action['durationMs']*.06)+10)
            if final.tobytes()!=baseline.tobytes():raise ValueError('Neutral mismatch '+label)
            checks.append(label);print('Rendered '+label+'; neutral RGBA exact',flush=True)
    for kind,channels in catalog['ambientClips'].items():
        for channel,clip in channels.items():capture(project(kind+'-'+channel,ambient_clip=clip),kind+'-'+channel+'-active',85 if kind=='breath' else 5)
    directory=project('interruption',catalog['actions']['hello']['variants']['default']['machine'],True)
    for label,frame in [('interruption-before',20),('interruption-native-machine-blend',29),('interruption-neutral',45)]:image=capture(directory,label,frame)
    if image.tobytes()!=baseline.tobytes():raise ValueError('Interruption neutral differs')
    labels=[name for name in captures if name.endswith('-active')]+['interruption-before','interruption-native-machine-blend','interruption-neutral','neutral-initial'];sheet=Image.new('RGB',(360*4,370*math.ceil(len(labels)/4)),'#15131e');draw=ImageDraw.Draw(sheet)
    for i,label in enumerate(labels):x,y=i%4*360,i//4*370;sheet.paste(captures[label],(x,y),captures[label]);draw.text((x+8,y+345),label,fill='#eee4f8')
    sheet.save(store.output/'contact-sheet.png');report=dict(status='PASS',source='Real Rive CLI 1.3.0 focused generated machines',frames=len(logs),neutralComparisons=len(checks)+1,neutralRgbaEquality=True,variants=checks,interruptionScope='Native machine blend to neutral at425ms for150ms; frozen public controller recovery separately measured by native-validation.json')
    (store.output/'render-validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');(store.output/'render-log.json').write_text(json.dumps(logs,indent=2)+'\n',encoding='utf-8')

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--prepare',action='store_true');parser.add_argument('--check',action='store_true');parser.add_argument('--render',action='store_true');parser.add_argument('--port',type=int,default=4184);args=parser.parse_args()
    if args.check:
        root,catalog=generate();expected=json.loads((SOURCE/'catalog.json').read_text(encoding='utf-8'));expected.pop('generation',None)
        if expected!=catalog or ET.tostring(root,encoding='unicode')+'\n'!=(SOURCE/'scene.rml').read_text(encoding='utf-8'):raise ValueError('Generated sources differ')
        print(json.dumps(dict(status='PASS',actions=len(catalog['actions']))));return
    store=PersonalityStore()
    if not store.refresh(True):raise ValueError(store.status()['error'])
    if args.render:render_evidence(store);return
    if not args.prepare:serve(store,args.port)

if __name__=='__main__':main()
