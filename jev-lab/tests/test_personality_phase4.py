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
        self.assertEqual({a['targetShape'] for a in c['actions'].values() if a['targetShape']},set(rig.SHAPES)-{'base'});self.assertEqual(len(c['actions']['speech']['variants']),4)
        ids=[e.get('id') for e in a.iter() if e.get('id')];self.assertEqual(len(ids),len(set(ids)));board=a.find('Artboard');self.assertEqual(next(n for n in board.findall('Node') if n.get('name')=='PlaybackEnvelope').get('x'),'1');self.assertTrue(all(float(e.get('value'))==float(e.get('value')) for e in a.iter('KeyFrameDouble')))
    def test_unknown_fields_nonfinite_and_channels_rejected(self):
        for change in [lambda v:v.update(extra=1),lambda v:v['poses']['ponder'].update(gazeX=float('nan')),lambda v:v['channels'].append('unknown')]:
            folder=self.source();self.mutate(folder,'think',change)
            with self.assertRaises(ValueError):p.discover(folder)
    def test_cycle_endpoint_all_variants_and_phase_times_validated(self):
        for change in [lambda v:v['behavior'].update(cycleEndMs=1599),lambda v:v['phases'][5].update(pose='reflect'),lambda v:v.update(variants={'broken':{'reflect':{'gazeX':2},'ponder':{'gazeX':1}}})]:
            folder=self.source();self.mutate(folder,'think',change)
            if 'variants' in json.loads((folder/'actions/think.json').read_text()):
                # Endpoint pose differs only when two endpoint names are distinct.
                v=json.loads((folder/'actions/think.json').read_text());v['poses']['cycle_finish']=dict(v['poses']['ponder']);v['phases'][5]['pose']='cycle_finish';v['variants']['broken']['cycle_finish']={'gazeX':2};(folder/'actions/think.json').write_text(json.dumps(v))
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
