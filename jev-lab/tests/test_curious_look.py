"""Secuencia perceptiva: mirada, respuesta diferida, hold y neutral."""
import json
import math
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

LAB=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(LAB/"validators"))
from build import contract
from validate import validate_scene


class CuriousLookTests(unittest.TestCase):
    def setUp(self):
        self.scene=ET.parse(LAB/"rive/main.rml").getroot()
        self.contract=contract()
        self.spec=json.loads((LAB/"specs/curious_look.json").read_text(encoding="utf-8"))

    def track(self,obj,prop):
        identity=self.contract["ids"][obj];key=str(self.contract["propertyKeys"][prop])
        return self.scene.find(f"./Artboard/LinearAnimation[@name='curious_look']/KeyedObject[@objectId='{identity}']/KeyedProperty[@propertyKey='{key}']")

    def check(self):return validate_scene(self.scene,self.contract,self.spec)

    def test_valid_perceptive_sequence(self):
        result=self.check()
        self.assertEqual(result["durationMs"],800)
        self.assertEqual(result["curiosity"]["bodyDelayMs"],100)
        self.assertAlmostEqual(result["curiosity"]["verticalStretchPercent"],7)
        self.assertEqual(result["curiosity"]["holdMs"],200)

    def test_delay_measures_segment_start_not_arrival(self):
        # Llegar en frame18 no legitima empezar demasiado pronto en frame4.
        self.track("root","rotation")[1].set("frame","4")
        with self.assertRaisesRegex(ValueError,"bodyDelayMs"):self.check()

    def test_body_cannot_start_too_late(self):
        self.track("root","rotation")[1].set("frame","8")
        with self.assertRaisesRegex(ValueError,"bodyDelayMs"):self.check()

    def test_stretch_follows_tilt_onset(self):
        self.track("bodyTransform","scaleY")[1].set("frame","5")
        with self.assertRaisesRegex(ValueError,"responder juntos"):self.check()

    def test_tilt_direction_top_moves_right(self):
        tilt=self.check()["curiosity"]["tiltDegrees"]
        # Rive usa x hacia derecha, y hacia abajo. Punto superior (0,-h/2)
        # gira a x positivo con rotación positiva.
        self.assertGreater(math.sin(math.radians(tilt))*self.contract["body"]["height"]/2,0)
        for key in self.track("root","rotation"):
            key.set("value",str(-float(key.get("value"))))
        with self.assertRaisesRegex(ValueError,"dirección incorrecta"):self.check()

    def test_eyes_cannot_look_left(self):
        for key in self.track("eyes","x"):
            key.set("value",str(-float(key.get("value"))))
        with self.assertRaisesRegex(ValueError,"dirección incorrecta"):self.check()

    def test_stretch_at_least_five_percent(self):
        for key in self.track("bodyTransform","scaleY"):
            if float(key.get("value"))>1:key.set("value","1.04")
        with self.assertRaisesRegex(ValueError,"verticalStretch"):self.check()

    def test_stretch_at_most_ten_percent(self):
        self.track("bodyTransform","scaleY")[2].set("value","1.11")
        with self.assertRaisesRegex(ValueError,"excede spec"):self.check()

    def test_brief_hold_required(self):
        self.track("root","rotation")[3].set("frame","20")
        with self.assertRaisesRegex(ValueError,"holdMs"):self.check()

    def test_eyes_do_not_signal_surprise(self):
        for prop in ("scaleX","scaleY"):
            track=self.track("eyes",prop)
            key=ET.Element("KeyFrameDouble",{"id":"0:995" if prop=="scaleX" else "0:996","frame":"18","value":"1.08","interpolationType":"linear"})
            track.insert(1,key)
        with self.assertRaisesRegex(ValueError,"propiedad no prevista"):self.check()

    def test_neutral_hold_has_no_residual(self):
        self.track("root","rotation")[-2].set("value","0.001")
        with self.assertRaisesRegex(ValueError,"Hold final"):self.check()

    def test_only_two_known_animations(self):
        self.scene.find("./Artboard/LinearAnimation[@name='curious_look']").set("name","surprised")
        with self.assertRaisesRegex(ValueError,"dos animaciones"):self.check()

    def test_scene_selection_must_match_preview(self):
        state=self.scene.find(".//AnimationState")
        state.set("animationId","0:999")
        with self.assertRaisesRegex(ValueError,"escena alterada"):self.check()


if __name__ == "__main__":unittest.main()
