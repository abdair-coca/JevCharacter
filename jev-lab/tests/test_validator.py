"""Regresiones negativas del contrato; mutaciones en memoria, sin tocar RML."""
import copy
import json
import math
from pathlib import Path
import sys
import subprocess
import unittest
import xml.etree.ElementTree as ET

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(LAB/"validators"))
from build import contract
from validate import validate_scene, verify_inspect


class ValidatorTests(unittest.TestCase):
    def setUp(self):
        self.scene=ET.parse(LAB/"rive/main.rml").getroot()
        self.contract=contract()
        self.spec=json.loads((LAB/"specs/happy_bounce.json").read_text(encoding="utf-8"))

    def check(self):
        return validate_scene(self.scene,self.contract,self.spec)

    def track(self,obj,prop):
        identity=self.contract["ids"][obj]; key=str(self.contract["propertyKeys"][prop])
        return self.scene.find(f"./Artboard/LinearAnimation/KeyedObject[@objectId='{identity}']/KeyedProperty[@propertyKey='{key}']")

    def add_key(self,track,frame,value,identity):
        key=ET.Element("KeyFrameDouble",{"id":f"0:{identity}","frame":str(frame),"value":str(value),"interpolationType":"linear"})
        for index,existing in enumerate(track):
            if int(existing.get("frame"))>frame:track.insert(index,key);return

    def geometry_track(self,prop,value,identity):
        animation=self.scene.find("./Artboard/LinearAnimation")
        obj=animation.find(f"KeyedObject[@objectId='{self.contract['ids']['bodyGeometry']}']")
        if obj is None:
            obj=ET.SubElement(animation,"KeyedObject",{"id":"0:980","objectId":self.contract["ids"]["bodyGeometry"]})
        track=ET.SubElement(obj,"KeyedProperty",{"id":f"0:{identity}","propertyKey":str(self.contract["propertyKeys"][prop])})
        base=self.contract["body"][{"width":"width","height":"height","cornerRadiusTL":"roundness"}[prop]]
        for index,(frame,v) in enumerate(((0,base),(9,value),(43,base),(45,base))):
            ET.SubElement(track,"KeyFrameDouble",{"id":f"0:{identity+index+1}","frame":str(frame),"value":str(v),"interpolationType":"linear"})

    def test_valid_scene(self):
        self.assertTrue(self.check()["neutralExact"])

    def test_scale_out_of_bounds(self):
        self.track("bodyTransform","scaleX")[2].set("value","1.5")
        with self.assertRaisesRegex(ValueError,"límite|excede"):self.check()

    def test_composed_scale_not_only_local_keys(self):
        self.track("root","scaleX").insert(1,copy.deepcopy(self.track("root","scaleX")[0]))
        key=self.track("root","scaleX")[1];key.set("id","0:900");key[0].set("id","0:901");key.set("frame","9");key.set("value","1.18")
        with self.assertRaisesRegex(ValueError,"excede spec"):self.check()

    def test_illegal_local_scales_cannot_cancel(self):
        self.add_key(self.track("root","scaleX"),9,2,902)
        self.track("bodyTransform","scaleX")[2].set("value","0.5")
        with self.assertRaisesRegex(ValueError,"escala root|Escala local"):self.check()

    def test_expanded_body_visibility_not_only_halo(self):
        self.add_key(self.track("root","x"),9,90,903)
        self.track("root","rotation")[2].set("value",str(math.radians(8)))
        self.track("bodyTransform","scaleX")[2].set("value","1.04")
        self.track("bodyTransform","scaleY")[2].set("value","1")
        self.geometry_track("width",164,910)
        self.geometry_track("height",140,920)
        self.geometry_track("cornerRadiusTL",62,930)
        with self.assertRaisesRegex(ValueError,"fuera de artboard"):self.check()

    def test_eye_scale_must_be_uniform(self):
        self.track("eyes","scaleX")[1].set("value","1.1")
        with self.assertRaisesRegex(ValueError,"uniforme"):self.check()

    def test_cubic_overshoot_rejected(self):
        self.track("root","y")[2][0].set("y2","1.4")
        with self.assertRaisesRegex(ValueError,"monótona"):self.check()

    def test_unsupported_easing(self):
        self.track("root","y")[2].set("interpolationType","hold")
        with self.assertRaisesRegex(ValueError,"Easing"):self.check()

    def test_final_pose_residue(self):
        self.track("root","y")[-1].set("value","207.001")
        with self.assertRaisesRegex(ValueError,"neutral"):self.check()

    def test_hold_must_already_be_neutral(self):
        self.track("root","y")[-2].set("value","207.01")
        with self.assertRaisesRegex(ValueError,"Hold final"):self.check()

    def test_unknown_track(self):
        self.track("eyes","x").set("propertyKey","18")
        with self.assertRaisesRegex(ValueError,"no permitida"):self.check()

    def test_missing_required_track(self):
        obj=self.scene.find("./Artboard/LinearAnimation/KeyedObject")
        obj.remove(self.track("root","rotation"))
        with self.assertRaisesRegex(ValueError,"Faltan pistas"):self.check()

    def test_static_anatomy_changed(self):
        self.scene.find(".//Ellipse").set("width","40")
        with self.assertRaisesRegex(ValueError,"Anatomía"):self.check()

    def test_eye_containment_even_with_legal_local_values(self):
        self.track("eyes","x")[1].set("value","24")
        self.track("eyes","y")[1].set("value","-27")
        self.track("eyes","scaleX")[1].set("value","1.3")
        self.track("eyes","scaleY")[1].set("value","1.3")
        with self.assertRaisesRegex(ValueError,"Ojo fuera"):self.check()

    def test_nonfinite(self):
        self.track("root","y")[2].set("value","NaN")
        with self.assertRaisesRegex(ValueError,"no finito"):self.check()

    def test_duplicate_frame(self):
        self.track("root","y")[2].set("frame","4")
        with self.assertRaisesRegex(ValueError,"Frames"):self.check()

    def test_duration_spec(self):
        self.scene.find("./Artboard/LinearAnimation").set("duration","60")
        with self.assertRaisesRegex(ValueError,"duration"):self.check()

    def test_resolved_runtime_mismatch(self):
        result=subprocess.run([str(LAB/"output/tools/rive.exe"),"inspect",str(LAB/"rive"),"--json"],capture_output=True,text=True,encoding="utf-8",check=True)
        resolved=json.loads(result.stdout)
        def mutate(node):
            if node.get("id")==self.contract["ids"]["bodyGeometry"]:node["width"]=999
            for child in node.get("children",[]):mutate(child)
        for art in resolved["artboards"]:mutate(art)
        with self.assertRaisesRegex(ValueError,"Inspect difiere"):verify_inspect(self.scene,resolved)


if __name__ == "__main__": unittest.main()
