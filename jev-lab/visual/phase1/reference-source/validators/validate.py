"""Validador cerrado para esta anatomía y RML numérico con curvas monótonas."""
import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path
import xml.etree.ElementTree as ET
from build import LAB, assemble, character, contract, serialize, build, catalog, selection, output_dir


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(value):
    require(not isinstance(value, bool), "Número booleano inválido")
    result = float(value)
    require(math.isfinite(result), "Número no finito")
    return result


def attributes(node, allowed):
    require(set(node.attrib) == set(allowed), f"Atributos inesperados/ausentes en {node.tag}")


def in_range(value, limits, label):
    require(limits[0] - 1e-9 <= value <= limits[1] + 1e-9, f"Fuera de límite: {label}={value}")


def curve_value(key, progress, iterations):
    if key.get("interpolationType") == "linear":
        return progress
    curve = key[0]
    x1, y1, x2, y2 = (number(curve.get(k)) for k in ("x1", "y1", "x2", "y2"))
    def bezier(t, first, second):
        return 3 * (1-t)**2*t*first + 3*(1-t)*t*t*second + t**3
    low, high = 0.0, 1.0
    for _ in range(iterations):
        middle = (low + high) / 2
        if bezier(middle, x1, x2) < progress:
            low = middle
        else:
            high = middle
    return bezier((low+high)/2, y1, y2)


def evaluate(keys, frame, iterations):
    if frame >= number(keys[-1].get("frame")):
        return number(keys[-1].get("value"))
    for left, right in zip(keys, keys[1:]):
        f0, f1 = number(left.get("frame")), number(right.get("frame"))
        if f0 <= frame <= f1:
            progress = curve_value(left, (frame-f0)/(f1-f0), iterations)
            v0, v1 = number(left.get("value")), number(right.get("value"))
            return v0 + (v1-v0)*progress
    raise ValueError("Tiempo no cubierto")


def validate_animation(animation, c, spec):
    supported=catalog(); name=spec["name"]
    require(spec["schema"] == 1 and name in supported, "Spec desconocida")
    policy=supported[name]
    require(spec["intent"] == policy["intent"] and 0 <= number(spec["intensity"]) <= 1, "Intención inválida")
    limits = spec["constraints"]
    require(limits["returnToNeutral"] is True, "La spec debe regresar a neutral")
    require(number(limits["maxScale"]) <= policy["maxScale"] and number(limits["maxRotation"]) <= policy["maxRotation"], f"Spec amplía límites de {name}")
    require(number(limits["durationMin"]) >= policy["durationRange"][0] and number(limits["durationMax"]) <= policy["durationRange"][1], "Duración objetivo inválida")
    require(animation.tag == "LinearAnimation", "Solo LinearAnimation")
    attributes(animation, ("id", "name", "fps", "duration", "loopValue"))
    require(animation.get("id") == policy["id"] and animation.get("name") == name, "Identidad de animación inválida")
    fps, frames = number(animation.get("fps")), number(animation.get("duration"))
    require(fps == 60 and frames.is_integer(), "60 fps y duración entera requeridos")
    duration = frames / fps
    in_range(duration, [limits["durationMin"], limits["durationMax"]], "duration")
    require(duration == number(spec["duration"]), "Spec y duración RML difieren")
    require(animation.get("loopValue") == "oneShot", "Solo oneShot")
    base = {node.get("id"): node for node in character(c).iter() if node.get("id")}
    allowed = {"root": ("x", "y", "rotation", "scaleX", "scaleY"), "bodyTransform": ("scaleX", "scaleY"), "eyes": ("x", "y", "scaleX", "scaleY"), "blink": ("scaleY",), "bodyGeometry": ("width", "height", "cornerRadiusTL")}
    channels = {(c["ids"][obj], str(c["propertyKeys"][prop])): (obj, prop) for obj, props in allowed.items() for prop in props}
    required = {pair for pair, (obj, _) in channels.items() if obj != "bodyGeometry"}
    tracks = {}
    seen_objects = set()
    for obj in animation:
        require(obj.tag == "KeyedObject", "Objeto animado desconocido")
        attributes(obj, ("id", "objectId"))
        require(obj.get("objectId") not in seen_objects and len(obj) > 0, "Objeto vacío/duplicado")
        seen_objects.add(obj.get("objectId"))
        for prop in obj:
            require(prop.tag == "KeyedProperty", "Propiedad desconocida")
            attributes(prop, ("id", "propertyKey"))
            pair = (obj.get("objectId"), prop.get("propertyKey"))
            require(pair in channels and pair not in tracks, "Pista no permitida/duplicada")
            keys = list(prop)
            require(len(keys) >= 2, "Pista sin inicio/final")
            previous = -1
            for index, key in enumerate(keys):
                require(key.tag == "KeyFrameDouble", "Tipo de keyframe no admitido")
                attributes(key, ("id", "frame", "value", "interpolationType"))
                frame = number(key.get("frame")); number(key.get("value"))
                require(frame.is_integer() and previous < frame <= frames, "Frames inválidos o desordenados")
                previous = frame
                easing = key.get("interpolationType")
                require(easing in ("linear", "cubic"), "Easing no admitido")
                if easing == "cubic":
                    require(len(key) == 1 and key[0].tag == "CubicEaseInterpolator", "Curva inválida")
                    attributes(key[0], ("id", "x1", "y1", "x2", "y2"))
                    controls = [number(key[0].get(k)) for k in ("x1", "y1", "x2", "y2")]
                    require(all(0 <= value <= 1 for value in controls) and controls[0] <= controls[2] and controls[1] <= controls[3], "Curva debe ser monótona sin overshoot")
                    require(len(key[0]) == 0, "Contenido de curva no admitido")
                else:
                    require(len(key) == 0, "Curva adjunta a linear")
            require(number(keys[0].get("frame")) == 0 and number(keys[-1].get("frame")) == frames, "Pista no cubre toda animación")
            obj_name, property_name = channels[pair]
            neutral = number(base[pair[0]].get(property_name, 0 if property_name in ("x", "y", "rotation") else 1))
            require(number(keys[0].get("value")) == neutral == number(keys[-1].get("value")), "Inicio/final no neutral")
            hold=frames-c["sampling"]["neutralHoldFrames"]
            require(any(number(key.get("frame")) == hold for key in keys),"Falta inicio de hold neutral")
            require(all(number(key.get("value")) == neutral for key in keys if number(key.get("frame")) >= hold),"Hold final no neutral")
            tracks[(obj_name, property_name)] = keys
    require(required <= {(c["ids"][o], str(c["propertyKeys"][p])) for o,p in tracks}, "Faltan pistas requeridas")
    anatomy_limits, body, eyes = c["limits"], c["body"], c["eyes"]
    def value(obj, prop, frame):
        if (obj, prop) in tracks:
            return evaluate(tracks[(obj,prop)], frame, c["sampling"]["curveIterations"])
        return number(base[c["ids"][obj]].get(prop, 0 if prop in ("x","y","rotation") else 1))
    maxima = {"composedScale": 0, "rotationDegrees": 0, "eyeDisplacement": 0}
    subframes = c["sampling"]["subframes"]
    sample_times = {step / subframes for step in range(int(frames * subframes)+1)}
    sample_times.update(number(key.get("frame")) for keys in tracks.values() for key in keys)
    sample_times.update((frames+1, frames+60))
    for frame in sorted(sample_times):
        x,y,rotation = (value("root",p,frame) for p in ("x","y","rotation"))
        sx,sy = (value("root",p,frame)*value("bodyTransform",p,frame) for p in ("scaleX","scaleY"))
        for obj in ("root","bodyTransform"):
            for prop in ("scaleX","scaleY"):
                local_scale=value(obj,prop,frame)
                in_range(local_scale,anatomy_limits["scale"],f"escala {obj}.{prop}")
                require(local_scale <= limits["maxScale"] + 1e-9,"Escala local excede spec")
        w,h,r = (value("bodyGeometry",p,frame) for p in ("width","height","cornerRadiusTL"))
        for scale in (sx, sy):
            in_range(scale, anatomy_limits["scale"], "escala compuesta")
            require(scale <= limits["maxScale"] + 1e-9, "Escala compuesta excede spec")
        for actual, nominal in ((w,body["width"]),(h,body["height"]),(w*sx,body["width"]),(h*sy,body["height"])):
            in_range(actual/nominal, anatomy_limits["bodyDimensionRatio"], "dimensión corporal")
        radius_ratio = r/(min(w,h)/2)
        in_range(radius_ratio, anatomy_limits["roundnessRatio"], "redondez")
        degrees = math.degrees(rotation)
        in_range(degrees, anatomy_limits["rotationDegrees"], "rotación")
        require(abs(degrees) <= limits["maxRotation"] + 1e-9, "Rotación excede spec")
        in_range(x, anatomy_limits["x"], "x"); in_range(y, anatomy_limits["y"], "y")
        ex,ey,esx,esy = (value("eyes",p,frame) for p in ("x","y","scaleX","scaleY"))
        blink = value("blink","scaleY",frame)
        in_range(ex, anatomy_limits["eyeX"], "eyeX"); in_range(ey, anatomy_limits["eyeY"], "eyeY")
        for scale in (esx,esy): in_range(scale, anatomy_limits["eyeScale"], "eyeScale")
        require(abs(esx-esy) <= 1e-9,"eyeScale debe ser uniforme; blink controla cierre")
        in_range(1-blink, anatomy_limits["blink"], "blink")
        # Esquinas conservadoras de cada ojo dentro del rectángulo redondeado con margen.
        half_w,half_h = w/2-anatomy_limits["faceMargin"], h/2-anatomy_limits["faceMargin"]
        inner_r = max(0, min(r-anatomy_limits["faceMargin"], half_w, half_h))
        for sign in (-1,1):
            center = ex + sign*eyes["separation"]/2*esx
            for dx in (-eyes["width"]/2*esx, eyes["width"]/2*esx):
                for dy in (-eyes["height"]/2*esy*blink, eyes["height"]/2*esy*blink):
                    qx = max(abs(center+dx)-(half_w-inner_r),0)
                    qy = max(abs(ey+dy)-(half_h-inner_r),0)
                    require(qx*qx+qy*qy <= inner_r*inner_r+1e-9, "Ojo fuera de cara")
        # Caja completa del halo rotado: contiene también cuerpo y ojos.
        visible_width,visible_height=max(w,body["haloWidth"]),max(h,body["haloHeight"])
        half_x = abs(math.cos(rotation))*visible_width*sx/2 + abs(math.sin(rotation))*visible_height*sy/2
        half_y = abs(math.sin(rotation))*visible_width*sx/2 + abs(math.cos(rotation))*visible_height*sy/2
        margin = anatomy_limits["visibilityMargin"]
        require(margin <= x-half_x and x+half_x <= c["artboard"]["width"]-margin and margin <= y-half_y and y+half_y <= c["artboard"]["height"]-margin, "Personaje fuera de artboard")
        maxima["composedScale"] = max(maxima["composedScale"],sx,sy)
        maxima["rotationDegrees"] = max(maxima["rotationDegrees"],abs(degrees))
        maxima["eyeDisplacement"] = max(maxima["eyeDisplacement"],abs(ex),abs(ey-c["neutral"]["eyeY"]))
    report={"durationMs": duration*1000, "tracks":len(tracks), "samples":len(sample_times), "maxima":maxima, "neutralExact":True}
    if name == "curious_look":report["curiosity"]=validate_curiosity(tracks,c,limits,fps)
    return report


def validate_curiosity(tracks,c,limits,fps):
    require(limits["direction"] == "right" and limits["eyeScaleUnchanged"] is True and limits["blinkUnchanged"] is True,"Curiosidad debe ser derecha sin sorpresa")
    require(limits["bodyDelayMs"] == [80,120] and limits["verticalStretch"] == [1.05,1.1] and limits["holdMs"] == [100,250],"Restricciones de curiosidad alteradas")
    moving={("eyes","x"),("root","rotation"),("bodyTransform","scaleY")}
    for (obj,prop),keys in tracks.items():
        if (obj,prop) not in moving:
            require(all(number(key.get("value")) == number(keys[0].get("value")) for key in keys),"curious_look cambia una propiedad no prevista")
    def onset(keys):
        # El easing pertenece al inicio del segmento: la primera clave distinta
        # indica llegada, no inicio de movimiento.
        starts=[number(left.get("frame")) for left,right in zip(keys,keys[1:]) if number(left.get("value")) != number(right.get("value"))]
        require(bool(starts),"Pista de curiosidad sin movimiento")
        return starts[0]
    eye=tracks[("eyes","x")]; tilt=tracks[("root","rotation")]; stretch=tracks[("bodyTransform","scaleY")]
    eye_start,tilt_start,stretch_start=(onset(keys) for keys in (eye,tilt,stretch))
    require(eye_start == 0,"La mirada debe reaccionar desde inicio")
    delay=(tilt_start-eye_start)/fps*1000
    in_range(delay,limits["bodyDelayMs"],"bodyDelayMs")
    require(stretch_start == tilt_start,"Inclinación y stretch deben responder juntos")
    for keys,label,neutral in ((eye,"mirada",0),(tilt,"inclinación",0),(stretch,"stretch",1)):
        require(all(number(key.get("value")) >= neutral for key in keys),f"{label} tiene dirección incorrecta")
    peaks=[max(number(key.get("value")) for key in keys) for keys in (eye,tilt,stretch)]
    require(peaks[0] > 0 and peaks[1] > 0,"Mirada e inclinación deben apuntar derecha")
    in_range(peaks[2],limits["verticalStretch"],"verticalStretch")
    def plateau(keys,peak):
        ranges=[(number(left.get("frame")),number(right.get("frame"))) for left,right in zip(keys,keys[1:]) if number(left.get("value")) == peak == number(right.get("value"))]
        require(len(ranges)==1,"Se necesita un único hold perceptible de la pose")
        return ranges[0]
    intervals=[plateau(keys,peak) for keys,peak in zip((eye,tilt,stretch),peaks)]
    start=max(interval[0] for interval in intervals);end=min(interval[1] for interval in intervals)
    hold=(end-start)/fps*1000
    in_range(hold,limits["holdMs"],"holdMs")
    return {"eyeOnsetMs":eye_start/fps*1000,"bodyOnsetMs":tilt_start/fps*1000,"bodyDelayMs":delay,"verticalStretchPercent":(peaks[2]-1)*100,"holdMs":hold,"tiltDegrees":math.degrees(peaks[1]),"direction":"right","eyeScaleUnchanged":True,"blinkUnchanged":True}


def validate_scene(root, c, spec=None):
    animations = root.findall("./Artboard/LinearAnimation")
    require([animation.get("name") for animation in animations] == list(catalog()), "Deben existir exactamente las dos animaciones admitidas en orden")
    expected = assemble(c, character(c), ET.Element("Rive", {"version":"1", "kind":"fragment"}))
    actual = ET.fromstring(ET.tostring(root))
    for animation in actual.findall("./Artboard/LinearAnimation"):
        actual.find("Artboard").remove(animation)
    require(serialize(actual) == serialize(expected), "Anatomía o escena alterada")
    ids = [node.get("id") for node in root.iter() if node is not root]
    require(all(re.fullmatch(r"(?:0|[1-9]\d*):[1-9]\d*", identifier or "") for identifier in ids), "IDs inválidos")
    require(len(ids) == len(set(ids)), "IDs duplicados")
    specs={name:json.loads((LAB/"specs"/f"{name}.json").read_text(encoding="utf-8")) for name in catalog()}
    if spec is not None:specs[spec["name"]]=spec
    reports={animation.get("name"):validate_animation(animation,c,specs[animation.get("name")]) for animation in animations}
    return reports[spec["name"]] if spec is not None else reports


def verify_inspect(root, resolved):
    require(resolved.get("problems") == [], "Inspect detectó problemas")
    def flatten(nodes):
        result = {}
        for node in nodes:
            require(node.get("id") not in result, "ID duplicado en inspect")
            result[node.get("id")] = node
            descendants = flatten(node.get("children",[]))
            require(not result.keys() & descendants.keys(), "ID duplicado en inspect")
            result.update(descendants)
        return result
    objects = flatten(resolved["artboards"])
    require(set(objects) == {node.get("id") for node in root.iter() if node is not root}, "Objetos exportados difieren de fuente")
    for source in root.iter():
        if source is root: continue
        target = objects[source.get("id")]
        require(target["type"] == source.tag, "Tipo resuelto diferente")
        for key, raw in source.attrib.items():
            if key == "id": continue
            # Posiciones del diagrama del editor; no son transformaciones runtime.
            if source.tag in ("AnyState","ExitState","EntryState","AnimationState") and key in ("x","y"): continue
            actual = target.get("enums",{}).get(key,target.get(key))
            if raw in ("true","false"):
                require(actual is (raw == "true"), "Booleano resuelto diferente")
            else:
                try: expected = float(raw)
                except ValueError: require(raw == actual, f"Inspect difiere: {key}")
                else: require(math.isfinite(number(actual)) and math.isclose(expected,number(actual),rel_tol=1e-6,abs_tol=1e-6), f"Inspect difiere: {key}")


def run(inspect_path=None):
    build(check=True)
    c=contract(); chosen=selection();output=output_dir(chosen);output.mkdir(parents=True,exist_ok=True)
    root=ET.parse(LAB/"rive/main.rml").getroot()
    reports=validate_scene(root,c)
    if inspect_path:
        resolved=json.loads(Path(inspect_path).read_text(encoding="utf-8-sig"))
    else:
        result=subprocess.run([str(LAB/"output/tools/rive.exe"),"inspect",str(LAB/"rive"),"--json"],capture_output=True,text=True,encoding="utf-8")
        require(result.returncode == 0,"Rive inspect falló")
        resolved=json.loads(result.stdout)
        (output/"inspect.json").write_text(json.dumps(resolved,indent=2),encoding="utf-8")
    verify_inspect(root,resolved)
    report={"status":"PASS","selectedAnimation":chosen,"inspectMatchesSource":True,"animations":reports}
    (output/"validation.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False))


if __name__ == "__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("--inspect")
    try: run(parser.parse_args().inspect)
    except (ValueError,KeyError,TypeError,ET.ParseError,OSError,json.JSONDecodeError) as error:
        print(f"FAIL: {error}",file=sys.stderr); sys.exit(1)
