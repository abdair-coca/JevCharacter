import copy,json,sys,tempfile,unittest,shutil
from pathlib import Path
import xml.etree.ElementTree as ET
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'validators'))
import personality_phase4 as p
import rig_phase2 as rig
class PersonalityPhase4Tests(unittest.TestCase):
    def source(self):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup);folder=Path(temp.name)/'source';shutil.copytree(p.SOURCE,folder);return folder
    def mutate(self,folder,name,operation):
        path=folder/'actions'/f'{name}.json';value=json.loads(path.read_text(encoding='utf-8'));operation(value);path.write_text(json.dumps(value),encoding='utf-8')
    def test_discovery_and_deterministic_native_scene(self):
        a,c=p.generate();b,d=p.generate();self.assertEqual(ET.tostring(a),ET.tostring(b));self.assertEqual(c,d);self.assertEqual(len(c['actions']),13);self.assertEqual(sum(len(a['variants']) for a in c['actions'].values()),18)
        self.assertEqual(c['transitionBump'],{'clip':'transition_bump','node':'BumpTransform','durationMs':150});self.assertEqual(c['behavior']['ambient']['enabled'],True);self.assertEqual(set(c['ambientClips']['breath']),{'bodyScaleX','bodyScaleY','bodyY','gazeX','gazeY','leftOpen','rightOpen'})
        self.assertEqual({a['targetShape'] for a in c['actions'].values() if a['targetShape']},set(rig.SHAPES)-{'base'});self.assertEqual(len(c['actions']['speech']['variants']),4)
        board=a.find('Artboard');body=next(n for n in board.iter('Node') if n.get('name')=='BodyRoot');self.assertEqual([n.get('name') for n in body.findall('Node')],['BumpTransform']);self.assertEqual([n.get('name') for n in body.find("Node[@name='BumpTransform']").findall('Node')],['BodyDeform'])
        ids=[e.get('id') for e in a.iter() if e.get('id')];self.assertEqual(len(ids),len(set(ids)));board=a.find('Artboard');self.assertEqual(next(n for n in board.findall('Node') if n.get('name')=='PlaybackEnvelope').get('x'),'1');self.assertTrue(all(float(e.get('value'))==float(e.get('value')) for e in a.iter('KeyFrameDouble')))

    def test_five_reference_actions_have_distinct_expressive_motion_arcs(self):
        definitions={value['id']:value for _,value in p.discover()};self.assertTrue({'happy_bounce','curious_look','hello','think','speech'}<=set(definitions))
        def values(action,channel):return [pose[channel] for pose in action['poses'].values()]
        happy=definitions['happy_bounce'];self.assertIn('recoil',[phase['name'] for phase in happy['phases']]);self.assertLessEqual(min(values(happy,'bodyY')),-10);self.assertGreaterEqual(max(values(happy,'bodyScaleY')),1.09)
        curious=definitions['curious_look'];phase_names=[phase['name'] for phase in curious['phases']];self.assertLess(phase_names.index('eyes_first'),phase_names.index('lean'));self.assertGreaterEqual(max(values(curious,'bodyRotation')),0.12);self.assertGreaterEqual(max(values(curious,'bodyScaleY')),1.1)
        hello=definitions['hello'];self.assertIn('lean_again',[phase['name'] for phase in hello['phases']]);self.assertGreaterEqual(max(values(hello,'bodyRotation'))-min(values(hello,'bodyRotation')),0.2)
        think=definitions['think'];self.assertEqual(think['behavior']['kind'],'sustained');self.assertGreaterEqual(max(values(think,'bodyScaleY')),1.075);self.assertGreater(max(values(think,'gazeX'))-min(values(think,'gazeX')),8)
        speech=definitions['speech'];self.assertEqual(set(speech['variants']),{'b','c','bc'});rotation=values(speech,'bodyRotation')+[variant['beat'].get('bodyRotation',speech['poses']['beat']['bodyRotation']) for variant in speech['variants'].values()];scale_y=values(speech,'bodyScaleY')+[variant['beat'].get('bodyScaleY',speech['poses']['beat']['bodyScaleY']) for variant in speech['variants'].values()];self.assertGreaterEqual(max(rotation)-min(rotation),0.22);self.assertGreaterEqual(max(scale_y),1.08)

    def test_continuous_idle_and_bump_contract_reject_gaps_and_out_of_range_scale(self):
        folder=self.source();behavior=p.read_behavior(folder);self.assertTrue(behavior['ambient']['enabled']);self.assertEqual(behavior['ambient']['breath']['pauseMs'],[0,0]);self.assertEqual(behavior['bump']['durationMs'],150)
        for pointer,value in [('/ambient/breath/pauseMs',[1,1]),('/bump/peakScale',1.2)]:
            changed=self.source();path=changed/'behavior.json';data=json.loads(path.read_text(encoding='utf-8'));target=data
            for part in pointer.strip('/').split('/')[:-1]:target=target[part]
            target[pointer.strip('/').split('/')[-1]]=value;path.write_text(json.dumps(data),encoding='utf-8')
            with self.assertRaises(ValueError):p.read_behavior(changed)
    def test_unknown_fields_nonfinite_and_channels_rejected(self):
        for change in [lambda v:v.update(extra=1),lambda v:v['poses']['ponder'].update(gazeX=float('nan')),lambda v:v['channels'].append('unknown')]:
            folder=self.source();self.mutate(folder,'think',change)
            with self.assertRaises(ValueError):p.discover(folder)
    def test_cycle_endpoint_all_variants_and_phase_times_validated(self):
        def mismatch_variant(value):
            value['poses']['cycle_finish']=dict(value['poses']['ponder'])
            next(phase for phase in value['phases'] if phase['name']=='cycle_end')['pose']='cycle_finish'
            value['variants']={'broken':{'ponder':{'gazeX':1},'cycle_finish':{'gazeX':2}}}
        changes=[lambda v:v['behavior'].update(cycleEndMs=1599),lambda v:next(phase for phase in v['phases'] if phase['name']=='cycle_end').update(pose='reflect'),mismatch_variant]
        for change in changes:
            folder=self.source();self.mutate(folder,'think',change)
            with self.assertRaises(ValueError):p.discover(folder)
    def test_no_shape_variants_or_ambient_shapes(self):
        folder=self.source();self.mutate(folder,'transform_star',lambda v:v.setdefault('variants',{}).update(bad={'shape':{'shapeTo':'cloud'}}))
        with self.assertRaises(ValueError):p.discover(folder)
        b=json.loads((folder/'behavior.json').read_text());b['ambient']['shape']='cloud';(folder/'behavior.json').write_text(json.dumps(b))
        with self.assertRaises(ValueError):p.read_behavior(folder)
    def test_definition_discovery_needs_no_controller_list(self):
        folder=self.source();value=json.loads((folder/'actions/hello.json').read_text());value['id']='new_salute';(folder/'actions/new_salute.json').write_text(json.dumps(value));_,catalog=p.generate(folder);self.assertIn('new_salute',catalog['actions']);self.assertEqual(len(catalog['actions']),14)
    def test_adapter_never_writes_previous_sources(self):
        paths=[*rig.SOURCE.rglob('*'),*p.author.SOURCE.rglob('*')];before={str(x):rig.digest(x) for x in paths if x.is_file()};p.generate();self.assertEqual(before,{str(x):rig.digest(x) for x in paths if x.is_file()})
    def test_last_valid_store_error_retains_immutable_snapshot(self):
        folder=self.source();store=p.PersonalityStore(folder,Path(tempfile.mkdtemp()));self.addCleanup(shutil.rmtree,store.output);store.generation='abc';store.snapshots['abc']=(b'catalog',b'riv');self.mutate(folder,'hello',lambda v:v.update(durationMs=1));self.assertFalse(store.refresh());self.assertEqual(store.status()['generation'],'abc');self.assertEqual(store.snapshots['abc'],(b'catalog',b'riv'));self.assertIsNotNone(store.status()['error'])
    def test_route_allowlist_original_and_generation(self):
        store=p.PersonalityStore();store.snapshots['a'*20]=(b'catalog',b'riv');self.assertEqual(p.route('/generation/'+'a'*20+'/catalog.json',store)[1],b'catalog');self.assertEqual(p.route('/original.riv',store)[1],(rig.LAB.parent/'public/rive/prove1.riv').read_bytes())
        for path in ['/../AGENTS.md','/%2e%2e/package.json','/phase3/scene.rml']:
            with self.assertRaises(PermissionError):p.route(path,store)
if __name__=='__main__':unittest.main()
