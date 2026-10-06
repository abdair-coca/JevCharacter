import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[3]
output = root / 'jev-lab/output/visual-phase4'
checks = []
for name in ['previous-phases-preservation.json', 'application-preservation.json']:
    manifest = json.loads((output / name).read_text())
    changed = [path for path, digest in manifest['files'].items()
               if not (root / path).is_file()
               or hashlib.sha256((root / path).read_bytes()).hexdigest() != digest]
    checks.append({'manifest': name, 'files': len(manifest['files']), 'changed': changed})
    assert not changed, changed
sys.path.insert(0, str(root / 'jev-lab/validators'))
import visual_phase1
historical = visual_phase1.check_preservation()
report = {'status': 'PASS', 'checks': checks, 'historicalFiles': historical}
(output / 'parent-preservation-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
