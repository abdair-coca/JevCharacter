import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "validators"))
import author_phase3 as author
import rig_phase2 as rig


class AuthorPhase3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = rig.load_contract()
        cls.definitions = {action["id"]: action for _, action in author.discover()}

    def test_deterministic_discovery_real_machines_curves_and_owned_properties(self):
        root, catalog = author.generate()
        second, second_catalog = author.generate()
        self.assertEqual(ET.tostring(root), ET.tostring(second))
        self.assertEqual(catalog, second_catalog)
        builder, _, shapes, channels = rig.build_scene(self.contract)
        board = root.find("Artboard")
        self.assertEqual(board.get("defaultStateMachineId"), board.find("StateMachine").get("id"))
        self.assertEqual(len(board.findall("StateMachine")), 8)
        all_ids = [node.get("id") for node in root.iter() if node.get("id")]
        self.assertEqual(len(all_ids), len(set(all_ids)))
        for action in catalog["actions"].values():
            owned = set()
            for channel in action["channels"]:
                keys = shapes[action["targetShape"]] if channel == "morph" else channels[channel]
                next_keys = {(obj, prop) for obj, props in keys.items() for prop in props}
                self.assertFalse(owned & next_keys)
                owned |= next_keys
            for variant in action["variants"].values():
                clip = next(c for c in board.findall("LinearAnimation") if c.get("name") == variant["clip"])
                actual = set()
                for obj in clip.findall("KeyedObject"):
                    for prop in obj:
                        key = int(prop.get("propertyKey"))
                        actual.add((obj.get("objectId"), key))
                        frames = list(prop)
                        self.assertEqual(float(frames[-1].get("value")), builder.neutral[obj.get("objectId")][key])
                        self.assertEqual(frames[-2].get("value"), frames[-1].get("value"))
                        self.assertGreaterEqual(int(frames[-1].get("frame")) - int(frames[-2].get("frame")), 2)
                        self.assertTrue(all(frame.find("CubicEaseInterpolator") is not None for frame in frames))
                self.assertEqual(actual, owned)
                machine = next(m for m in board.findall("StateMachine") if m.get("name") == variant["machine"])
                states = machine.find("StateMachineLayer").findall("AnimationState")
                self.assertEqual(states[0].get("animationId"), clip.get("id"))
                self.assertEqual(states[0].get("reset"), "true")
                transition = states[0].find("StateTransition")
                self.assertEqual(transition.get("exitTime"), "100")
                self.assertEqual(transition.get("exitTimeIsPercetange"), "true")
                self.assertEqual(transition.get("stateToId"), states[1].get("id"))

    def test_historical_intention_timing_and_amplitude_adaptation(self):
        happy, curious = self.definitions["happy_bounce"], self.definitions["curious_look"]
        self.assertEqual(happy["durationMs"], 750)
        self.assertEqual(curious["durationMs"], 800)
        self.assertEqual(happy["poses"]["notice"]["bodyY"], 0)
        self.assertEqual(min(pose["bodyY"] for pose in happy["poses"].values()), -10)
        self.assertEqual(happy["phases"][2]["pose"], "notice")
        self.assertEqual(curious["phases"][1]["timeMs"], 100)
        self.assertEqual(curious["poses"]["look"]["bodyRotation"], 0)
        self.assertEqual(curious["poses"]["observe"]["gazeX"], 7)
        self.assertAlmostEqual(curious["poses"]["observe"]["bodyRotation"], .06981317007977318)
        self.assertEqual(curious["poses"]["observe"]["bodyScaleY"], 1.07)
        self.assertEqual([p["timeMs"] for p in curious["phases"]][2:4], [300, 500])
        self.assertEqual(round(curious["phases"][-2]["timeMs"] * .06), 46)
        self.assertFalse({"leftOpen", "rightOpen", "blink"} & set(curious["channels"]))

    def test_unknown_fields_channels_duplicate_identifiers_and_collapsed_frames(self):
        original = self.definitions["curious_look"]
        mutations = [
            lambda d: d.update(unknown=1), lambda d: d["channels"].append("nose"),
            lambda d: d["channels"].append("gazeX"), lambda d: d.update(id="name__collision"),
            lambda d: d["phases"][1].update(name="entry"),
            lambda d: d["phases"][1].update(timeMs=1),
            lambda d: d["phases"][1].update(timeMs=-1),
            lambda d: d["phases"][1].update(pose="missing"),
            lambda d: d["phases"][1].update(curve=[.8, 0, .2, 1]),
            lambda d: d["phases"][1].update(curve=[.2, .8, .8, .2]),
            lambda d: d["phases"][1].update(curve=[0, -1, 1, 1]),
            lambda d: d["phases"][-2].update(timeMs=790),
            lambda d: d["poses"]["neutral"].update(gazeX=1),
            lambda d: d["poses"]["observe"].pop("bodyRotation"),
            lambda d: d["poses"]["observe"].update(blink=0),
            lambda d: d.update(targetShape=[]),
            lambda d: d.update(schema=True), lambda d: d.update(durationMs=801),
            lambda d: d["variants"].update(default={}),
            lambda d: d["variants"].update(bad=dict(neutral=dict(gazeX=1))),
        ]
        for mutate in mutations:
            value = copy.deepcopy(original); mutate(value)
            with self.subTest(value=value):
                with self.assertRaises(author.DefinitionError) as error:
                    author.validate_definition(value, self.contract, "localized.json")
                self.assertEqual(error.exception.source, "localized.json")
                self.assertTrue(error.exception.pointer.startswith("/"))

    def test_numeric_bounds_nonfinite_bool_rejected_and_edges_accepted(self):
        for key, bounds in {**self.contract["ranges"], "morph": [0, 1]}.items():
            for amount in [bounds[0] - .001, bounds[1] + .001, float("nan"), float("inf"), True, "1", None]:
                with self.subTest(key=key, amount=amount):
                    with self.assertRaises(author.DefinitionError):
                        author.number(amount, *bounds, "numeric.json", "/poses/peak/" + key)
            for amount in bounds:
                self.assertEqual(author.number(amount, *bounds, "numeric.json", "/" + key), amount)

    def test_new_action_requires_only_one_json_and_duplicate_action_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            shutil.copytree(author.SOURCE / "actions", folder / "actions")
            before = {file.name: file.read_bytes() for file in (folder / "actions").glob("*.json")}
            new = copy.deepcopy(self.definitions["curious_look"])
            new.update(id="single_definition_demo", intent="An independently discovered example")
            (folder / "actions/single_definition_demo.json").write_text(json.dumps(new), encoding="utf-8")
            root, catalog = author.generate(folder)
            self.assertIn("single_definition_demo", catalog["actions"])
            self.assertIn("Action_single_definition_demo__default", [m.get("name") for m in root.findall("Artboard/StateMachine")])
            for name, content in before.items():
                self.assertEqual((folder / "actions" / name).read_bytes(), content)
            self.assertEqual(set(file.name for file in folder.iterdir()), {"actions"})
            (folder / "actions/duplicate.json").write_text(json.dumps(new), encoding="utf-8")
            with self.assertRaises(author.DefinitionError):
                author.generate(folder)

    def test_json_syntax_line_column_and_duplicate_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "broken.json"
            file.write_text('{\n "id":\n}', encoding="utf-8")
            with self.assertRaisesRegex(author.DefinitionError, "line 3, column 1"):
                author.read_definition(file)
            file.write_text('{"id":"one","id":"two"}', encoding="utf-8")
            with self.assertRaisesRegex(author.DefinitionError, "Duplicate JSON field"):
                author.read_definition(file)
            file.write_text('{"poses":{"peak":{"gazeX":1,"gazeX":2}}}', encoding="utf-8")
            with self.assertRaises(author.DefinitionError) as error:
                author.read_definition(file)
            self.assertEqual(error.exception.pointer, "/poses/peak/gazeX")
            file.write_text('{"name/part~":{"value":1,"value":2}}', encoding="utf-8")
            with self.assertRaises(author.DefinitionError) as error:
                author.read_definition(file)
            self.assertEqual(error.exception.pointer, "/name~1part~0/value")

    def test_real_cli_watch_last_valid_immutable_pair_and_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source"
            output = Path(directory) / "output"
            shutil.copytree(author.SOURCE / "actions", source / "actions")
            store = author.AuthoringStore(source, output)
            self.assertTrue(store.refresh())
            generation = store.status()["generation"]
            initial = store.snapshots[generation]
            previous_source = (source / "scene.rml").read_bytes(), (source / "catalog.json").read_bytes()
            file = source / "actions/curious_look.json"
            value = json.loads(file.read_text())
            file.write_text('{"id":', encoding="utf-8")
            self.assertFalse(store.refresh())

            self.assertEqual(store.status()["generation"], generation)
            self.assertEqual(store.snapshots[generation], initial)
            self.assertEqual(previous_source, ((source / "scene.rml").read_bytes(), (source / "catalog.json").read_bytes()))
            self.assertIn("line", store.status()["error"]["message"])
            revision = store.status()["revision"]
            self.assertFalse(store.refresh())
            self.assertEqual(store.status()["revision"], revision)
            value["poses"]["observe"]["gazeX"] = 6
            file.write_text(json.dumps(value), encoding="utf-8")
            self.assertTrue(store.refresh())
            self.assertIsNone(store.status()["error"])
            recovered = store.status()["generation"]
            self.assertNotEqual(recovered, generation)
            self.assertNotEqual(store.snapshots[recovered][1], initial[1])
            self.assertEqual(store.snapshots[generation], initial)
            self.assertEqual(json.loads(author.route(f"/generation/{generation}/catalog.json", store)[1])["generation"], generation)
            self.assertEqual(author.route(f"/generation/{generation}/actions.riv", store)[1], initial[1])
            for path in ["/../AGENTS.md", "/%2e%2e/AGENTS.md", "/actions/curious_look.json", "/generation/", "/"]:
                if path == "/": continue
                with self.assertRaises(PermissionError): author.route(path, store)
            with self.assertRaises(FileNotFoundError): author.route("/generation/aaaaaaaaaaaaaaaaaaaa/actions.riv", store)
            self.assertFalse(store.refresh())

    def test_transient_source_read_error_retains_generation_and_retries(self):
        store = author.AuthoringStore()
        store.generation = "aaaaaaaaaaaaaaaaaaaa"
        store.fingerprint = "same-fingerprint"
        with patch.object(store, "sources_hash", side_effect=FileNotFoundError("Editor atomic rename")):
            self.assertFalse(store.refresh())
        self.assertEqual(store.status()["generation"], "aaaaaaaaaaaaaaaaaaaa")
        self.assertIn("Editor atomic rename", store.status()["error"]["message"])
        # Same content after a transient failure must retry rather than being
        # skipped as an unchanged source. Stop before any disk/build mutation.
        with patch.object(store, "sources_hash", return_value="same-fingerprint"), patch.object(author, "generate", side_effect=author.DefinitionError("retry.json", "/", "retry reached")) as generate:
            self.assertFalse(store.refresh())
            generate.assert_called_once()
            self.assertEqual(store.status()["error"]["file"], "retry.json")


if __name__ == "__main__":
    unittest.main()
