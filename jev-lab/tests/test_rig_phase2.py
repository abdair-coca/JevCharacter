import copy
import itertools
import json
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'validators'))
import rig_phase2 as rig


class RigPhase2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = rig.load_contract()
        cls.builder, cls.board, cls.shapes, cls.channels = rig.build_scene(cls.c)

    def test_all_pairs_actual_polar_interpolation_and_continuous_segments(self):
        report = rig.validate_contract(self.c)
        self.assertEqual(report['samples'], 861)
        self.assertGreater(report['minimumEyeMargin'], 6)
        self.assertGreater(report['minimumPolarCoefficient'], 0)
        self.assertLess(report['baseRadiusError'], .03)
        self.assertLess(report['artboardExtent'], 170)

    def test_malformed_contour_crossing_winding_and_collapse_rejected(self):
        for name, change in [('crossing', lambda v: v.__setitem__(10, v[40])), ('winding', lambda v: v.reverse()), ('collapse', lambda v: [p.update(x=0, y=0) for p in v]), ('nan', lambda v: v[0].update(x=float('nan'))), ('negative handle', lambda v: v[0].update(inDistance=-1))]:
            with self.subTest(name=name):
                vertices = copy.deepcopy(self.c['shapes']['base'])
                change(vertices)
                with self.assertRaises(ValueError):
                    rig.certify_contour(vertices)

    def test_state_all_ranges_nonfinite_bool_unknown_and_missing(self):
        for key, (low, high) in self.c['ranges'].items():
            for value in (low - .001, high + .001, float('inf'), float('nan'), True, '1'):
                with self.subTest(key=key, value=value):
                    with self.assertRaises(ValueError):
                        rig.validate_state({**self.c['neutral'], key: value}, self.c)
            for value in (low, high):
                rig.validate_state({**self.c['neutral'], key: value}, self.c)
        for state in ({**self.c['neutral'], 'unknown': 1}, {**self.c['neutral'], 'shapeTo': 'invalid'}, {**self.c['neutral'], 'morph': float('nan')}, {}):
            with self.assertRaises(ValueError):
                rig.validate_state(state, self.c)

    def test_channels_disjoint_shape_light_composition_and_neutral_complete(self):
        owners = {}
        for channel, objects in self.channels.items():
            for obj, properties in objects.items():
                for key in properties:
                    self.assertNotIn((obj, key), owners)
                    owners[obj, key] = channel
                    self.assertIn(key, self.builder.neutral[obj])
        shape_properties = {(obj, key) for objects in self.shapes.values() for obj, properties in objects.items() for key in properties}
        self.assertTrue(shape_properties.isdisjoint(owners))
        for obj, key in shape_properties:
            self.assertIn(key, self.builder.neutral[obj])
        neutral = rig.pose_properties(self.c['neutral'], self.c, self.builder, self.shapes, self.channels)
        for obj, properties in neutral.items():
            for key, value in properties.items():
                self.assertAlmostEqual(value, self.builder.neutral[obj][key], places=12)

    def test_same_ids_and_order_for_seven_shape_clips(self):
        topology = [{obj: tuple(properties) for obj, properties in objects.items()} for objects in self.shapes.values()]
        for candidate in topology:
            self.assertEqual(candidate, topology[0])
        paths = self.board.findall('.//PointsPath')
        self.assertEqual(len(paths), 4)
        self.assertTrue(all(p.get('isClosed') == 'true' and p.get('isClockwise') == 'true' and len(p.findall('CubicDetachedVertex')) == 60 for p in paths))

    def test_eyes_nested_multiplicative_and_per_eye_independent(self):
        for side in ('left', 'right'):
            placement = self.board.find(f'.//Node[@name="{side}Placement"]')
            blink = placement.find(f'Node[@name="{side}Tilt"]/Node[@name="{side}Open"]/Node[@name="{side}Blink"]')
            self.assertIsNotNone(blink)
            self.assertEqual(blink.find('Shape/Ellipse').get('height'), '11')
            self.assertEqual(self.channels['blink'][blink.get('id')][17], [(0, 0), (60, 1)])
        self.assertNotEqual(set(self.channels['leftOpen']), set(self.channels['rightOpen']))
        self.assertNotEqual(set(self.channels['leftTilt']), set(self.channels['rightTilt']))

    def test_generated_source_deterministic_and_routes_allowlisted(self):
        ET.indent(self.builder.root, space='  ')
        self.assertEqual((rig.SOURCE / 'scene.rml').read_text(encoding='utf-8'), ET.tostring(self.builder.root, encoding='unicode') + '\n')
        self.assertEqual(rig.resolve_route('/contract.json?ignored=1'), rig.SOURCE / 'body_contract.v2.json')
        for url in ('/../rive/main.rml', '/%2e%2e/AGENTS.md', '/harness/', '/original.riv', '/contract.json/extra'):
            with self.assertRaises(ValueError):
                rig.resolve_route(url)

    def test_contract_provenance_anatomy_and_pose_validation(self):
        for key in ('body', 'eyes', 'lighting'):
            changed = copy.deepcopy(self.c)
            if key == 'lighting':
                changed[key][0]['coordinates']['endX'] += 1
            else:
                changed[key]['width'] += 1
            with self.assertRaises(ValueError):
                rig.validate_contract(changed, 1)

    def test_invalid_contract_ranges_and_artboard_overflow(self):
        for key, bounds in [('blink', [0, 2]), ('light', [.75, 1.15]), ('bodyScaleX', [0, 1.12]), ('gazeX', [float('nan'), 8]), ('leftOpen', [1, 1])]:
            with self.subTest(key=key):
                changed = copy.deepcopy(self.c)
                changed['ranges'][key] = bounds
                with self.assertRaises(ValueError):
                    rig.validate_contract(changed, 1)
        changed = copy.deepcopy(self.c)
        for shape in changed['shapes'].values():
            for v in shape:
                for key in ('x', 'y', 'inDistance', 'outDistance'):
                    v[key] *= 3
        # Base error also rejects oversized geometry; both guards cover it.
        with self.assertRaises(ValueError):
            rig.validate_contract(changed, 1)


if __name__ == '__main__':
    unittest.main()
