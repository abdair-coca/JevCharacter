"""Ensamblado XML propio; no es una API Include de Rive. Solo stdlib."""
import argparse
import copy
import json
from pathlib import Path
import xml.etree.ElementTree as ET

LAB = Path(__file__).resolve().parents[1]


def contract():
    return json.loads((LAB / "rive/character/body_contract.json").read_text(encoding="utf-8"))


def catalog():
    data=json.loads((LAB / "rive/animations/catalog.json").read_text(encoding="utf-8"))
    if list(data) != ["happy_bounce","curious_look"]:
        raise ValueError("Catálogo debe contener solo happy_bounce y curious_look")
    return data


def selection():
    config=json.loads((LAB / "rive/preview.json").read_text(encoding="utf-8"))
    if set(config) != {"animation"} or config["animation"] not in catalog():
        raise ValueError("Selección de preview desconocida")
    return config["animation"]


def output_dir(animation):
    return LAB / "output" if animation == "happy_bounce" else LAB / "output" / animation


def element(tag, **attrs):
    return ET.Element(tag, {key: str(value) for key, value in attrs.items()})


def character(c):
    i, n, b, e, p, g = (c[k] for k in ("ids", "neutral", "body", "eyes", "palette", "gradient"))
    root = element("Rive", version=1, kind="fragment")
    node = element("Node", id=i["root"], name="Jev", x=n["x"], y=n["y"], rotation=n["rotation"], scaleX=n["scaleX"], scaleY=n["scaleY"])
    root.append(node)
    body = element("Node", id=i["bodyTransform"], name="BodyTransform", scaleX=1, scaleY=1)
    node.append(body)
    eyes = element("Node", id=i["eyes"], name="Eyes", x=n["eyeX"], y=n["eyeY"], scaleX=n["eyeScale"], scaleY=n["eyeScale"])
    body.append(eyes)
    blink = element("Node", id=i["blink"], name="Blink", scaleY=n["blinkScale"])
    eyes.append(blink)
    for side, sign in (("left", -1), ("right", 1)):
        shape = element("Shape", id=i[side + "Eye"], name=side.title() + "Eye", x=sign * e["separation"] / 2)
        blink.append(shape)
        shape.append(element("Ellipse", id=i[side + "Geometry"], width=e["width"], height=e["height"], originX=0.5, originY=0.5))
        fill = element("Fill", id=i[side + "Fill"])
        shape.append(fill)
        fill.append(element("SolidColor", id=i[side + "Color"], colorValue=e["color"]))
    shape = element("Shape", id=i["body"], name="Body")
    body.append(shape)
    shape.append(element("Rectangle", id=i["bodyGeometry"], width=b["width"], height=b["height"], originX=0.5, originY=0.5, cornerRadiusTL=b["roundness"], linkCornerRadius="true"))
    fill = element("Fill", id=i["bodyFill"])
    shape.append(fill)
    gradient = element("LinearGradient", id=i["bodyGradient"], startX=g["startX"], startY=g["startY"], endX=g["endX"], endY=g["endY"])
    fill.append(gradient)
    for number, color, position in ((1, "light", 0), (2, "mid", g["midPosition"]), (3, "dark", 1)):
        gradient.append(element("GradientStop", id=i["bodyStop" + str(number)], colorValue=p[color], position=position))
    shape = element("Shape", id=i["halo"], name="VioletHalo")
    body.append(shape)
    shape.append(element("Rectangle", id=i["haloGeometry"], width=b["haloWidth"], height=b["haloHeight"], originX=0.5, originY=0.5, cornerRadiusTL=b["haloRadius"], linkCornerRadius="true"))
    fill = element("Fill", id=i["haloFill"])
    shape.append(fill)
    gradient = element("RadialGradient", id=i["haloGradient"], startX=0, startY=0, endX=g["haloEndX"], endY=0)
    fill.append(gradient)
    gradient.append(element("GradientStop", id=i["haloStop1"], colorValue=p["haloInner"], position=0))
    gradient.append(element("GradientStop", id=i["haloStop2"], colorValue=p["haloOuter"], position=1))
    return root


def assemble(c, body, animation, selected=None):
    i, a = c["ids"], c["artboard"]
    root = element("Rive", version=1, kind="fragment")
    art = element("Artboard", id=i["artboard"], name=a["name"], width=a["width"], height=a["height"], originX=0, originY=0, styleId=i["style"], defaultStateMachineId=i["machine"])
    root.append(art)
    art.append(element("LayoutComponentStyle", id=i["style"]))
    fill = element("Fill", id=i["backgroundFill"])
    fill.append(element("SolidColor", id=i["backgroundColor"], colorValue=a["background"]))
    art.append(fill)
    machine = element("StateMachine", id=i["machine"], name="Preview")
    art.append(machine)
    layer = element("StateMachineLayer", id=i["layer"], name="Motion")
    machine.append(layer)
    layer.append(element("AnyState", id=i["any"], x=0, y=-100))
    layer.append(element("ExitState", id=i["exit"], x=300, y=-100))
    entry = element("EntryState", id=i["entry"], x=0, y=0)
    entry.append(element("StateTransition", id=i["transition"], stateToId=i["state"]))
    layer.append(entry)
    layer.append(element("AnimationState", id=i["state"], x=200, y=0, animationId=catalog()[selected or selection()]["id"]))
    for fragment in (body, animation):
        if fragment.tag != "Rive" or fragment.attrib != {"version": "1", "kind": "fragment"}:
            raise ValueError("Fragmento RML inválido")
        for child in fragment:
            art.append(copy.deepcopy(child))
    return root


def serialize(root):
    ET.indent(root, space="  ")
    return ET.tostring(root, encoding="unicode") + "\n"


def build(check=False, animation=None):
    chosen=animation or selection()
    if chosen not in catalog(): raise ValueError("Animación no admitida")
    if check and chosen != selection(): raise ValueError("Selección distinta de preview.json")
    c = contract()
    body = character(c)
    animations=element("Rive",version=1,kind="fragment")
    for name in catalog():
        fragment=ET.parse(LAB / "rive/animations" / f"{name}.rml").getroot()
        if fragment.tag != "Rive" or fragment.attrib != {"version":"1","kind":"fragment"}:
            raise ValueError("Fragmento RML inválido")
        animations.extend(copy.deepcopy(list(fragment)))
    products = {LAB / "rive/character/body.rml": serialize(body), LAB / "rive/main.rml": serialize(assemble(c, body, animations,chosen))}
    for path, content in products.items():
        if check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                raise ValueError(f"Salida obsoleta: {path.relative_to(LAB)}; ejecutar validators/build.py")
        elif not path.exists() or path.read_text(encoding="utf-8") != content:
            path.write_text(content, encoding="utf-8")
    if not check and chosen != selection():
        (LAB / "rive/preview.json").write_text(json.dumps({"animation":chosen},indent=2)+"\n",encoding="utf-8")
    print("PASS: body.rml y main.rml " + ("sin cambios pendientes" if check else "ensamblados"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--animation",choices=tuple(catalog()))
    args=parser.parse_args()
    build(args.check,args.animation)
