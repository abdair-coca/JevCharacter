"""Seguridad del comparador y preservación del punto de partida visual."""
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen
import xml.etree.ElementTree as ET

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB / "validators"))
from visual_phase1 import ComparisonHandler, ORIGINAL, SOURCE, check_preservation, digest, resolve_route


class VisualReferenceTests(unittest.TestCase):
    def test_all_original_sources_and_renders_preserved(self):
        self.assertGreaterEqual(check_preservation(), 125)

    def test_reference_only_separates_the_backdrop(self):
        raw = ET.parse(SOURCE / "reference-source/rive/main.rml").getroot()
        actual = ET.parse(SOURCE / "current-reference/scene.rml").getroot()
        board = raw.find("Artboard")
        board.attrib.pop("defaultStateMachineId", None)
        for child in list(board):
            if child.tag == "Fill": board.remove(child)
        # Whitespace is not part of the RML geometry or animation contract.
        for tree in (raw, actual):
            for node in tree.iter(): node.text = None; node.tail = None
        self.assertEqual(ET.tostring(raw), ET.tostring(actual))

    def test_proposal_is_neutral_only_with_two_eyes(self):
        root = ET.parse(SOURCE / "proposal/scene.rml").getroot()
        self.assertFalse(root.findall(".//LinearAnimation"))
        self.assertFalse(root.findall(".//StateMachine"))
        self.assertFalse(root.findall(".//ScriptAsset"))
        eyes = [node for node in root.findall(".//Shape") if node.get("name") in ("LeftEye", "RightEye")]
        self.assertEqual(len(eyes), 2)

    def test_revised_proposal_has_circular_body_and_centered_round_eyes(self):
        root = ET.parse(SOURCE / "proposal/scene.rml").getroot()
        body = root.find(".//Shape[@name='PurpleVolume']/Ellipse")
        self.assertIsNotNone(body, "El cuerpo debe usar una esfera, no un rectángulo redondeado")
        self.assertEqual(float(body.get("width")), float(body.get("height")))
        eyes = [root.find(f".//Shape[@name='{name}']") for name in ("LeftEye", "RightEye")]
        self.assertEqual(sum(float(eye.get("x")) for eye in eyes), 0)
        for eye in eyes:
            self.assertEqual(float(eye.get("y")), 0)
            geometry = eye.find("Ellipse")
            ratio = float(geometry.get("height")) / float(geometry.get("width"))
            self.assertGreaterEqual(ratio, 0.9)
            self.assertLessEqual(ratio, 1.3, "Ojos redonditos: conservar proporción cercana al círculo")
        config = json.loads((SOURCE / "comparison.json").read_text(encoding="utf-8"))
        calibration = next(version["body"] for version in config["versions"] if version["id"] == "proposal")
        self.assertEqual(calibration["width"], float(body.get("width")))
        self.assertEqual(calibration["height"], float(body.get("height")))

    def test_rejected_revision_is_preserved_by_checksum(self):
        revision = LAB / "output/visual-phase1/revisions/revision-01"
        manifest = json.loads((revision / "manifest.json").read_text(encoding="utf-8"))
        for name, expected in manifest["files"].items():
            with self.subTest(name=name): self.assertEqual(digest(revision / name), expected)

    def test_original_endpoint_cannot_select_other_files(self):
        self.assertEqual(resolve_route("/original.riv?name=package.json"), ORIGINAL)
        for route in ("/", "/current.riv", "/proposal.riv", "/rive.wasm"):
            self.assertTrue(resolve_route(route).is_file())
        for route in ("/../package.json", "/%2e%2e/package.json", "/..%5cpackage.json", "/original.riv/../package.json", "/public/rive/prove1.riv", "/", "/C:%5cUsers"):
            if route == "/": continue
            with self.subTest(route=route), self.assertRaises(ValueError): resolve_route(route)

    def test_server_rejects_lists_traversal_and_allows_exact_read_only_original(self):
        before = digest(ORIGINAL)
        server = ThreadingHTTPServer(("127.0.0.1", 0), ComparisonHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        try:
            with urlopen(base + "/original.riv") as response:
                self.assertEqual(len(response.read()), 78380)
            for route in ("/../package.json", "/%2e%2e/package.json", "/visual/", "/original.riv/", "/output/"):
                with self.subTest(route=route), self.assertRaises(HTTPError) as context:
                    urlopen(base + route)
                self.assertEqual(context.exception.code, 403)
        finally:
            server.shutdown(); server.server_close(); thread.join()
        self.assertEqual(digest(ORIGINAL), before)


if __name__ == "__main__": unittest.main()
