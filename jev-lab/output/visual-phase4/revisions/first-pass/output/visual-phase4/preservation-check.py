import json,hashlib,sys
from pathlib import Path
root=Path.cwd();output=root/'jev-lab/output/visual-phase4';results=[]
for name in ['previous-phases-preservation.json','application-preservation.json']:
    manifest=json.loads((output/name).read_text());changed=[path for path,digest in manifest['files'].items() if not (root/path).is_file() or hashlib.sha256((root/path).read_bytes()).hexdigest()!=digest];results.append(dict(manifest=name,files=len(manifest['files']),changed=changed));assert not changed,changed
sys.path.insert(0,str(root/'jev-lab/validators'));import visual_phase1
count=visual_phase1.check_preservation();original=hashlib.sha256((root/'public/rive/prove1.riv').read_bytes()).hexdigest();report=dict(status='PASS',checks=results,historicalFiles=count,originalSha256=original);(output/'writer-preservation-check.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
