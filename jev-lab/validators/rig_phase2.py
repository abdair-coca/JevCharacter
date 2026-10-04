"""Phase 2: deterministic RML rig, geometry verification and isolated preview.

The JSON contract owns geometry. All interpolation uses the same six numeric
properties that Rive animates, including polar handle angles and distances.
"""
import argparse
from collections import Counter
import copy
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import itertools
import json
import math
from pathlib import Path
import shutil
import subprocess
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

LAB = Path(__file__).resolve().parents[1]
SOURCE = LAB / "visual/phase2"
OUTPUT = LAB / "output/visual-phase2"
CLI = LAB / "output/tools/rive.exe"
PROPERTIES = {"x": 24, "y": 25, "inRotation": 84, "inDistance": 85,
              "outRotation": 86, "outDistance": 87}
NODE_PROPERTIES = {"x": 13, "y": 14, "rotation": 15, "scaleX": 16, "scaleY": 17, "opacity": 18}
GRADIENT_PROPERTIES = {"startX": 42, "startY": 33, "endX": 34, "endY": 35, "opacity": 46}
SHAPES = ("base", "star", "square", "triangle", "ghost", "flower", "cloud")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_contract():
    return json.loads((SOURCE / "body_contract.v2.json").read_text(encoding="utf-8"))


def radial(name, theta):
    c, s = math.cos(theta), math.sin(theta)
    if name == "base":
        return 61.0
    if name == "star":
        return 50 + 17 * math.cos(5 * (theta + math.pi / 2))
    if name == "square":
        return 59 / (c ** 8 + s ** 8) ** (1 / 8)
    if name == "triangle":
        normals = (math.pi / 2, 7 * math.pi / 6, 11 * math.pi / 6)
        return 39 / sum(max(0, math.cos(theta - n)) ** 18 for n in normals) ** (1 / 18)
    if name == "flower":
        return 55 + 10 * math.cos(6 * (theta + math.pi / 2))
    if name == "ghost":
        if s <= 0:
            return 59
        # Rounded cap, straight sides and three gently scalloped feet.
        side = 57 / max(abs(c), 1e-12)
        lo, hi = 0.0, min(side, 80 / max(s, 1e-12))
        for _ in range(35):
            r = (lo + hi) / 2
            if r * s < 52 + 6 * math.cos(math.pi * r * c / 19):
                lo = r
            else:
                hi = r
        return min(side, (lo + hi) / 2)
    if name == "cloud":
        roots = []
        for x, y, radius in ((-34, 2, 31), (-10, -15, 39), (23, -8, 36), (43, 6, 27), (0, 7, 40)):
            projection = x * c + y * s
            disc = radius ** 2 - x ** 2 - y ** 2 + projection ** 2
            if disc >= 0:
                roots.append(projection + math.sqrt(disc))
        return max(roots)
    raise ValueError(f"Unknown shape: {name}")


def make_vertices(name, count=60):
    step = math.tau / count
    radii = [radial(name, -math.pi / 2 + i * step) for i in range(count)]
    if name in ("ghost", "cloud"):
        radii = [(radii[(i - 1) % count] + 6 * radii[i] + radii[(i + 1) % count]) / 8 for i in range(count)]
    points = [(r * math.cos(-math.pi / 2 + i * step), r * math.sin(-math.pi / 2 + i * step)) for i, r in enumerate(radii)]
    vertices = []
    for i, (x, y) in enumerate(points):
        derivative = (radii[(i + 1) % count] - radii[(i - 1) % count]) / (2 * step)
        rotation = i * step - math.atan2(derivative, radii[i])
        distance = math.hypot(radii[i], derivative) * step / 3
        distance = min(distance, .43 * min(math.dist(points[i], points[(i - 1) % count]), math.dist(points[i], points[(i + 1) % count])))
        if name == "base":
            distance = 4 / 3 * math.tan(step / 4) * 61
        vertices.append(dict(x=x, y=y, inRotation=rotation + math.pi, inDistance=distance,
                             outRotation=rotation, outDistance=distance))
    return vertices


def initialize_contract():
    """Bootstrap once; subsequent builds read, never silently replace authority."""
    path = SOURCE / "body_contract.v2.json"
    if path.exists():
        return
    original = LAB / "visual/phase1/proposal/visual.json"
    visual = json.loads(original.read_text(encoding="utf-8"))
    ranges = {"gazeX": [-8, 8], "gazeY": [-6, 6], "leftOpen": [.15, 1.35], "rightOpen": [.15, 1.35],
              "leftTilt": [-.5, .5], "rightTilt": [-.5, .5], "blink": [0, 1],
              "bodyX": [-10, 10], "bodyY": [-10, 10], "bodyRotation": [-.2, .2],
              "bodyScaleX": [.82, 1.12], "bodyScaleY": [.82, 1.12], "light": [.75, 1]}
    neutral = {key: 0 for key in ranges}
    neutral.update(leftOpen=1, rightOpen=1, blink=1, bodyScaleX=1, bodyScaleY=1, light=1)
    neutral.update(shapeFrom="base", shapeTo="base", morph=0)
    c = dict(schema=2, phase=2, source=dict(revision=4, path="visual/phase1/proposal/visual.json", sha256=digest(original),
                                          sceneSha256=digest(original.parent / "scene.rml")),
             artboard=dict(name="JevRigV2", width=360, height=340), body=visual["body"], eyes=visual["eyes"],
             lighting=visual["lighting"], topology=dict(count=60, vertexType="CubicDetachedVertex", closed=True,
                clockwise=True, start="top", order="clockwise", interpolation="linear in Rive x/y and polar handle properties; angles unwrapped relative to each base tangent"),
             shapes={name: make_vertices(name) for name in SHAPES}, ranges=ranges, neutral=neutral,
             poses={"alegría": dict(bodyY=-7, bodyScaleX=1.06, bodyScaleY=.94, leftOpen=.65, rightOpen=.65, leftTilt=-.25, rightTilt=.25),
                    "curiosidad": dict(gazeX=6, gazeY=-3, leftOpen=1.2, rightOpen=.75, leftTilt=-.15, rightTilt=.3, bodyRotation=.12),
                    "pensamiento": dict(gazeX=-5, gazeY=-5, leftOpen=.45, rightOpen=.7, leftTilt=.3, rightTilt=.1, bodyRotation=-.08),
                    "habla": dict(bodyScaleX=.96, bodyScaleY=1.06, leftOpen=1.15, rightOpen=.85, leftTilt=-.1, rightTilt=.1, gazeY=-1)},
             composition="BodyRoot > BodyDeform > Gaze > per-eye placement > Tilt > Open > Blink > Ellipse. Blink multiplies openness; poses are static rig proofs.",
             eyeMarginMinimum=4.0, neutralCircleTolerance=0.03)
    SOURCE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(c, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_state(state, c):
    if set(state) != set(c["neutral"]):
        raise ValueError("State must contain exactly the neutral fields")
    for key, (low, high) in c["ranges"].items():
        value = state[key]
        if not finite_number(value) or not low <= value <= high:
            raise ValueError(f"{key} outside finite range [{low}, {high}]")
    if any(state[key] not in SHAPES for key in ("shapeFrom", "shapeTo")):
        raise ValueError("Unknown shape")
    if not finite_number(state["morph"]) or not 0 <= state["morph"] <= 1:
        raise ValueError("Morph outside finite range [0, 1]")
    return state


def blend_vertices(a, b, amount):
    return [{key: v[key] * (1 - amount) + w[key] * amount for key in PROPERTIES} for v, w in zip(a, b)]


def contour(vertices, subdivisions=8):
    result = []
    for index, p in enumerate(vertices):
        q = vertices[(index + 1) % len(vertices)]
        c1 = (p["x"] + math.cos(p["outRotation"]) * p["outDistance"], p["y"] + math.sin(p["outRotation"]) * p["outDistance"])
        c2 = (q["x"] + math.cos(q["inRotation"]) * q["inDistance"], q["y"] + math.sin(q["inRotation"]) * q["inDistance"])
        for part in range(subdivisions):
            t = part / subdivisions
            result.append(tuple((1 - t) ** 3 * p[key] + 3 * (1 - t) ** 2 * t * c1[axis] + 3 * (1 - t) * t ** 2 * c2[axis] + t ** 3 * q[key] for axis, key in enumerate(("x", "y"))))
    return result


def area(points):
    return sum(x * points[(i + 1) % len(points)][1] - y * points[(i + 1) % len(points)][0] for i, (x, y) in enumerate(points)) / 2


def segment_distance(point, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / max(1e-16, dx * dx + dy * dy)))
    return math.dist(point, (a[0] + t * dx, a[1] + t * dy))


def certify_contour(vertices, eye_radius=0):
    if len(vertices) != 60 or any(set(v) != set(PROPERTIES) or any(not finite_number(x) for x in v.values()) for v in vertices):
        raise ValueError("Invalid vertex topology or non-finite property")
    if any(v["inDistance"] < 0 or v["outDistance"] < 0 for v in vertices):
        raise ValueError("Negative handle distance")
    points = contour(vertices)
    signed_area = area(points)
    if signed_area < 2500:
        raise ValueError("Contour collapsed or wrong winding")
    # Polar monotonicity makes this contour a single-valued radial graph.
    # Verify between samples too: cross(P(t), P'(t)) is a polynomial whose
    # Bernstein coefficients must all be positive for every cubic segment.
    # Positive coefficients certify the entire continuous curve, not just pixels.
    min_cross = float("inf")
    for i, p in enumerate(vertices):
        q = vertices[(i + 1) % len(vertices)]
        controls = [(p["x"], p["y"]), (p["x"] + math.cos(p["outRotation"]) * p["outDistance"], p["y"] + math.sin(p["outRotation"]) * p["outDistance"]),
                    (q["x"] + math.cos(q["inRotation"]) * q["inDistance"], q["y"] + math.sin(q["inRotation"]) * q["inDistance"]), (q["x"], q["y"])]
        derivatives = [(3 * (controls[j + 1][0] - controls[j][0]), 3 * (controls[j + 1][1] - controls[j][1])) for j in range(3)]
        coefficients = []
        # degree 3 times degree 2 = degree 5; leading term cancels, but
        # degree-5 Bernstein representation gives the same sufficient proof.
        for k in range(6):
            coefficient = sum(math.comb(3, j) * math.comb(2, k - j) / math.comb(5, k) * (controls[j][0] * derivatives[k - j][1] - controls[j][1] * derivatives[k - j][0])
                              for j in range(4) if 0 <= k - j < 3)
            coefficients.append(coefficient)
        min_cross = min(min_cross, *coefficients)
    if min_cross <= 0:
        raise ValueError("Continuous contour is not strictly radial; intersection possible")
    # Distance to each cubic's control-point hull lower-bounds its radius.
    # Positive polar progress and one full turn prove winding/no crossing.
    angles = [math.atan2(y, x) for x, y in points]
    travel = sum((angles[(i + 1) % len(angles)] - a) % math.tau for i, a in enumerate(angles))
    if abs(travel - math.tau) > 1e-7:
        raise ValueError("Contour winds more than once")
    # Each segment's controls form an angular wedge not containing origin.
    # Checking all six control-polygon edges is conservative for their hull.
    hull_distance = []
    for i, p in enumerate(vertices):
        q = vertices[(i + 1) % len(vertices)]
        controls = [(p['x'], p['y']), (p['x'] + math.cos(p['outRotation']) * p['outDistance'], p['y'] + math.sin(p['outRotation']) * p['outDistance']),
                    (q['x'] + math.cos(q['inRotation']) * q['inDistance'], q['y'] + math.sin(q['inRotation']) * q['inDistance']), (q['x'], q['y'])]
        middle_angle = math.atan2(p['y'] + q['y'], p['x'] + q['x'])
        if any(x * math.cos(middle_angle) + y * math.sin(middle_angle) <= 0 for x, y in controls):
            raise ValueError('Control hull may contain origin; eye margin cannot be certified')
        hull_distance.extend(segment_distance((0, 0), a, b) for a, b in itertools.combinations(controls, 2))
    minimum_radius = min(hull_distance)
    margin = minimum_radius - eye_radius
    if margin < 4:
        raise ValueError(f"Eye safety margin too small: {margin}")
    return dict(area=signed_area, minimumRadius=minimum_radius, eyeMargin=margin, minimumPolarCoefficient=min_cross)


def validate_contract(c, transition_steps=40):
    original = LAB / c["source"]["path"]
    if c["schema"] != 2 or c["source"]["revision"] != 4 or digest(original) != c["source"]["sha256"] or digest(original.parent / "scene.rml") != c["source"]["sceneSha256"]:
        raise ValueError("Approved neutral provenance changed")
    visual = json.loads(original.read_text(encoding="utf-8"))
    if any(c[key] != visual[key] for key in ("body", "eyes", "lighting")) or c["artboard"] != dict(name="JevRigV2", width=360, height=340):
        raise ValueError("Approved neutral anatomy/lighting changed")
    if tuple(c["shapes"]) != SHAPES or c["topology"]["count"] != 60:
        raise ValueError("Seven shapes require identical 60-vertex topology")
    expected_channels = {'gazeX', 'gazeY', 'leftOpen', 'rightOpen', 'leftTilt', 'rightTilt', 'blink', 'bodyX', 'bodyY', 'bodyRotation', 'bodyScaleX', 'bodyScaleY', 'light'}
    if set(c['ranges']) != expected_channels or set(c['neutral']) != expected_channels | {'shapeFrom', 'shapeTo', 'morph'}:
        raise ValueError('Contract channel schema changed')
    for name, bounds in c['ranges'].items():
        if not isinstance(bounds, list) or len(bounds) != 2 or any(not finite_number(x) for x in bounds) or bounds[0] >= bounds[1]:
            raise ValueError(f'Invalid contract range: {name}')
    if c['ranges']['blink'] != [0, 1] or not 0 <= c['ranges']['light'][0] < c['ranges']['light'][1] <= 1 or min(c['ranges']['bodyScaleX'] + c['ranges']['bodyScaleY']) <= 0:
        raise ValueError('Invalid blink, light or deformation range')
    validate_state(c["neutral"], c)
    for overrides in c["poses"].values():
        validate_state({**c["neutral"], **overrides}, c)
    # A circumscribed envelope contains all independent gaze/open/tilt/blink
    # combinations. Shared body transforms preserve this containment.
    eye_radius = math.hypot(c["eyes"]["separation"] / 2 + max(abs(v) for v in c["ranges"]["gazeX"]), max(abs(v) for v in c["ranges"]["gazeY"])) + math.hypot(c["eyes"]["width"] / 2, c["eyes"]["height"] / 2 * max(c["ranges"]["leftOpen"][1], c["ranges"]["rightOpen"][1]))
    checks = []
    for a, b in itertools.combinations(SHAPES, 2):
        for step in range(transition_steps + 1):
            result = certify_contour(blend_vertices(c["shapes"][a], c["shapes"][b], step / transition_steps), eye_radius)
            checks.append(result)
    base_error = max(abs(math.hypot(x, y) - 61) for x, y in contour(c["shapes"]["base"], 16))
    if base_error > c["neutralCircleTolerance"]:
        raise ValueError("Base no longer matches approved circle")
    # Circular halos remain 242px. Rotation preserves their circumscribed
    # radius; largest permitted body scale and translation fit the artboard.
    halo_radius = max(layer.get('width', 122) / 2 + math.hypot(layer.get('x', 0), layer.get('y', 0)) for layer in c['lighting'])
    body_radius = max(math.hypot(v['x'], v['y']) + max(v['inDistance'], v['outDistance']) + .8 for shape in c['shapes'].values() for v in shape)
    extent = max(body_radius, halo_radius) * max(c['ranges']['bodyScaleX'][1], c['ranges']['bodyScaleY'][1]) + max(abs(v) for key in ('bodyX', 'bodyY') for v in c['ranges'][key])
    if extent >= min(c['artboard']['width'], c['artboard']['height']) / 2:
        raise ValueError('Compound halo transforms exceed artboard')
    return dict(status="PASS", pairs=21, samples=len(checks), transitionSteps=transition_steps, minimumArea=min(r["area"] for r in checks),
                eyeEnvelopeRadius=eye_radius, minimumEyeMargin=min(r["eyeMargin"] for r in checks),
                minimumPolarCoefficient=min(r["minimumPolarCoefficient"] for r in checks), baseRadiusError=base_error, artboardExtent=extent,
                continuousSegmentProof="positive Bernstein coefficients for cross(P, P'); one full polar turn", interpolationScope=f"{transition_steps + 1} samples per pair; continuous cubic segment proof at each sample")


class SceneBuilder:
    def __init__(self):
        self.serial = 0
        self.neutral = {}
        self.root = ET.Element("Rive", version="1", kind="fragment")

    def add(self, parent, tag, **attrs):
        self.serial += 1
        child = ET.SubElement(parent, tag, {"id": f"0:{self.serial}", **{key: str(value).lower() if isinstance(value, bool) else str(value) for key, value in attrs.items()}})
        return child

    def node(self, parent, name, **attrs):
        values = dict(x=0, y=0, rotation=0, scaleX=1, scaleY=1, opacity=1)
        values.update(attrs)
        node = self.add(parent, "Node", name=name, **values)
        self.remember(node, values, NODE_PROPERTIES)
        return node

    def remember(self, element, values, keys):
        self.neutral[element.get("id")] = {keys[key]: value for key, value in values.items()}

    def timeline(self, board, name, keys, duration=60):
        clip = self.add(board, "LinearAnimation", name=name, fps=60, duration=duration, loopValue="oneShot")
        for object_id, properties in keys.items():
            obj = self.add(clip, "KeyedObject", objectId=object_id)
            for key, frames in properties.items():
                prop = self.add(obj, "KeyedProperty", propertyKey=key)
                for frame, value in frames:
                    self.add(prop, "KeyFrameDouble", frame=frame, value=value, interpolationType="linear")
        return clip


def build_scene(c):
    s = SceneBuilder()
    board = s.add(s.root, "Artboard", **c["artboard"], originX=0, originY=0)
    style = s.add(board, "LayoutComponentStyle", name="FixedArtboard")
    board.set("styleId", style.get("id"))
    root = s.node(board, "BodyRoot", x=180, y=170)
    deform = s.node(root, "BodyDeform")
    gaze = s.node(deform, "Gaze")
    controls = dict(bodyX=(root, "x", 180), bodyY=(root, "y", 170), bodyRotation=(root, "rotation", 0),
                    bodyScaleX=(deform, "scaleX", 0), bodyScaleY=(deform, "scaleY", 0), gazeX=(gaze, "x", 0), gazeY=(gaze, "y", 0))
    blink = []
    for side, x in (("left", -9), ("right", 9)):
        placement = s.node(gaze, side + "Placement", x=x)
        tilt = s.node(placement, side + "Tilt")
        opening = s.node(tilt, side + "Open")
        eyelid = s.node(opening, side + "Blink")
        shape = s.add(eyelid, "Shape", name=side + "Eye")
        s.add(shape, "Ellipse", width=9, height=11, originX=.5, originY=.5)
        s.add(s.add(shape, "Fill"), "SolidColor", colorValue=c["eyes"]["color"])
        controls[side + "Tilt"] = (tilt, "rotation", 0)
        controls[side + "Open"] = (opening, "scaleY", 0)
        blink.append(eyelid)
    contour_layers = []
    gradient_layers = []
    # An extra contour stroke restores perimetral light on non-circular shapes.
    # Its zero neutral opacity retains the revision-04 appearance.
    rim = s.add(deform, "Shape", name="MorphPerimeter", opacity=0, blendModeValue="screen")
    s.remember(rim, {"opacity": 0}, NODE_PROPERTIES)
    path = s.add(rim, "PointsPath", isClosed=True, isClockwise=True)
    vertices = [s.add(path, "CubicDetachedVertex", name=f"perimeter_{i:02d}", **v) for i, v in enumerate(c["shapes"]["base"])]
    for vertex, values in zip(vertices, c["shapes"]["base"]):
        s.remember(vertex, values, PROPERTIES)
    contour_layers.append(vertices)
    stroke = s.add(rim, "Stroke", thickness=1.6, join="round", cap="round")
    s.remember(stroke, {"thickness": 1.6}, {"thickness": 47})
    s.add(stroke, "SolidColor", colorValue="994900DB")
    for layer in c["lighting"]:
        attrs = {"x": layer.get("x", 0), "y": layer.get("y", 0), "opacity": 1, "scaleX": 1, "scaleY": 1}
        if "blendModeValue" in layer:
            attrs["blendModeValue"] = layer["blendModeValue"]
        shape = s.add(deform, "Shape", name=layer["name"], **attrs)
        s.remember(shape, {key: value for key, value in attrs.items() if key != "blendModeValue"}, NODE_PROPERTIES)
        if "width" not in layer:
            path = s.add(shape, "PointsPath", isClosed=True, isClockwise=True)
            vertices = [s.add(path, "CubicDetachedVertex", name=f'{layer["name"]}_{i:02d}', **v) for i, v in enumerate(c["shapes"]["base"])]
            for vertex, values in zip(vertices, c["shapes"]["base"]):
                s.remember(vertex, values, PROPERTIES)
            contour_layers.append(vertices)
        else:
            # Soft circular halos avoid multiplying the silhouette's sharp
            # concavities into its glow; their bounds stay fixed under morphs.
            s.add(shape, "Ellipse", width=layer["width"], height=layer["height"], originX=.5, originY=.5)
        gradient = s.add(s.add(shape, "Fill"), layer["kind"], **layer["coordinates"], opacity=1)
        s.remember(gradient, {**layer["coordinates"], "opacity": 1}, GRADIENT_PROPERTIES)
        for position, color in layer["stops"]:
            s.add(gradient, "GradientStop", position=position, colorValue=color)
        gradient_layers.append((gradient, layer))
    # A neutral machine gives CLI screenshots a defined starting state.
    machine = s.add(board, "StateMachine", name="RigNeutral")
    board.set("defaultStateMachineId", machine.get("id"))
    layer = s.add(machine, "StateMachineLayer", name="Neutral")
    s.add(layer, "AnyState", x=0, y=-100)
    s.add(layer, "ExitState", x=400, y=100)
    entry = s.add(layer, "EntryState", x=0, y=0)
    state = s.add(layer, "AnimationState", x=200, y=0)
    s.add(entry, "StateTransition", stateToId=state.get("id"))
    neutral = s.timeline(board, "neutral", {obj: {key: [(0, value), (60, value)] for key, value in props.items()} for obj, props in s.neutral.items()})
    state.set("animationId", neutral.get("id"))
    shape_keys = {}
    for name, points in c["shapes"].items():
        keys = {}
        for vertices in contour_layers:
            for vertex, values in zip(vertices, points):
                keys[vertex.get("id")] = {PROPERTIES[key]: [(0, value), (60, value)] for key, value in values.items()}
        keys[rim.get("id")] = {18: [(0, 0 if name == "base" else 1), (60, 0 if name == "base" else 1)]}
        # Match gradient coordinates to shape extents. Neutral is exact.
        sx = max(abs(v["x"]) for v in points) / 61
        sy = max(abs(v["y"]) for v in points) / 61
        for gradient, source in gradient_layers:
            if "width" in source:
                continue
            values = {GRADIENT_PROPERTIES[key]: [(0, value * (sx if key.endswith("X") else sy)), (60, value * (sx if key.endswith("X") else sy))] for key, value in source["coordinates"].items()}
            keys[gradient.get("id")] = values
        s.timeline(board, "shape_" + name, keys)
        shape_keys[name] = keys
    channel_keys = {}
    for name, (target, prop, offset) in controls.items():
        low, high = c["ranges"][name]
        keys = {target.get("id"): {NODE_PROPERTIES[prop]: [(0, low + offset), (60, high + offset)]}}
        s.timeline(board, "channel_" + name, keys)
        channel_keys[name] = keys
    keys = {node.get("id"): {17: [(0, 0), (60, 1)]} for node in blink}
    s.timeline(board, "channel_blink", keys)
    channel_keys["blink"] = keys
    keys = {gradient.get("id"): {46: [(0, c['ranges']['light'][0]), (60, c['ranges']['light'][1])]} for gradient, _ in gradient_layers}
    s.timeline(board, "channel_light", keys)
    channel_keys["light"] = keys
    return s, board, shape_keys, channel_keys


def write_xml(root, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(root, space="  ")
    path.write_text(ET.tostring(root, encoding="unicode") + "\n", encoding="utf-8")


def compile_rig():
    initialize_contract()
    c = load_contract()
    report = validate_contract(c)
    s, _, _, _ = build_scene(c)
    write_xml(s.root, SOURCE / "scene.rml")
    (SOURCE / "rive.yaml").write_text("name: jev_rig_v2\nmain: JevRigV2\noutput:\n  dir: ../../output/visual-phase2/build\n", encoding="utf-8")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for mode in ("verify", "once"):
        result = subprocess.run([str(CLI), str(SOURCE), "--" + mode, "--format=json"], capture_output=True, text=True, encoding="utf-8", check=True)
        (OUTPUT / f"{mode}.json").write_text(result.stdout, encoding="utf-8")
    result = subprocess.run([str(CLI), "inspect", str(SOURCE), "--json"], capture_output=True, text=True, encoding="utf-8", check=True)
    (OUTPUT / "inspect.json").write_text(result.stdout, encoding="utf-8")
    inspection = json.loads(result.stdout)
    if inspection.get("problems"):
        raise ValueError(f'Rig inspection problems: {inspection["problems"]}')
    objects = []

    def visit(element):
        objects.append(element)
        for child in element.get('children', []):
            visit(child)

    for artboard in inspection['artboards']:
        visit(artboard)
    summary = dict(status='PASS', cli='1.3.0', defaultArtboard=inspection['defaultArtboard'],
                   artboards=[dict(name=a['name'], width=a['width'], height=a['height']) for a in inspection['artboards']],
                   objects=len(objects), counts=dict(Counter(obj['type'] for obj in objects)),
                   clips=[obj['name'] for obj in objects if obj['type'] == 'LinearAnimation'], problems=inspection['problems'])
    (OUTPUT / 'inspect-summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    package = LAB.parent / "node_modules/@rive-app/webgl2"
    if json.loads((package / "package.json").read_text(encoding="utf-8"))["version"] != "2.42.2":
        raise ValueError("Runtime must remain 2.42.2")
    browser = OUTPUT / "browser"
    browser.mkdir(exist_ok=True)
    for name in ("rive.js", "rive.wasm"):
        shutil.copyfile(package / name, browser / name)
    report.update(cli="1.3.0", runtime="2.42.2", contractSha256=digest(SOURCE / "body_contract.v2.json"), sceneSha256=digest(SOURCE / "scene.rml"))
    (OUTPUT / "geometry-validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report), flush=True)
    return report


def pose_properties(state, c, s, shape_keys, channel_keys):
    """Exact property-space result of neutral, A, B(mix), disjoint channels."""
    validate_state(state, c)
    properties = copy.deepcopy(s.neutral)
    for object_id, keys in shape_keys[state['shapeFrom']].items():
        properties[object_id].update({key: frames[0][1] for key, frames in keys.items()})
    for object_id, keys in shape_keys[state['shapeTo']].items():
        for key, frames in keys.items():
            old = properties[object_id][key]
            properties[object_id][key] = old * (1 - state['morph']) + frames[0][1] * state['morph']
    for channel, keys in channel_keys.items():
        low, high = c['ranges'][channel]
        t = (state[channel] - low) / (high - low)
        for object_id, values in keys.items():
            properties[object_id].update({key: frames[0][1] * (1 - t) + frames[-1][1] * t for key, frames in values.items()})
    return properties


def proof_project(name, poses, c):
    s, board, shapes, channels = build_scene(c)
    for element in list(board):
        if element.tag in ('StateMachine', 'LinearAnimation'):
            board.remove(element)
    samples = [(frame, pose_properties(state, c, s, shapes, channels)) for frame, state in poses]
    keys = {obj: {key: [(frame, values[obj][key]) for frame, values in samples] for key in props} for obj, props in s.neutral.items()}
    machine = s.add(board, 'StateMachine', name='RenderProof')
    board.set('defaultStateMachineId', machine.get('id'))
    layer = s.add(machine, 'StateMachineLayer', name='Proof')
    s.add(layer, 'AnyState', x=0, y=-100)
    s.add(layer, 'ExitState', x=400, y=100)
    entry = s.add(layer, 'EntryState', x=0, y=0)
    state = s.add(layer, 'AnimationState', x=200, y=0)
    s.add(entry, 'StateTransition', stateToId=state.get('id'))
    clip = s.timeline(board, 'proof', keys, duration=poses[-1][0])
    state.set('animationId', clip.get('id'))
    directory = OUTPUT / 'harness' / name
    write_xml(s.root, directory / 'scene.rml')
    (directory / 'rive.yaml').write_text('name: proof\nmain: JevRigV2\n', encoding='utf-8')
    return directory


def render_evidence():
    """Actual CLI state-machine interpolation, never a Pillow drawing substitute."""
    from PIL import Image, ImageChops, ImageDraw
    c = load_contract()
    frames = OUTPUT / 'renders'
    frames.mkdir(parents=True, exist_ok=True)
    captures, logs, neutral_checks = {}, [], []

    def capture(project, label, frame):
        path = frames / (label + '.png')
        result = subprocess.run([str(CLI), str(project), f'--screenshot={path}', f'--advance={frame}', '--fit=contain'], capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
        logs.append(dict(label=label, project=str(project.relative_to(LAB)), frame=frame, exit=result.returncode, stdout=result.stdout, stderr=result.stderr))
        image = Image.open(path).convert('RGBA')
        background = Image.new('RGBA', image.size, image.getpixel((0, 0)))
        if image.size != (360, 340) or ImageChops.difference(image.convert('RGB'), background.convert('RGB')).getbbox() is None:
            raise ValueError(f'Invisible or invalid render: {label}')
        captures[label] = image
        return image

    baseline = capture(SOURCE, 'neutral-initial', 0)
    for a, b in itertools.combinations(SHAPES, 2):
        state_a = {**c['neutral'], 'shapeFrom': a, 'shapeTo': a}
        state_b = {**c['neutral'], 'shapeFrom': b, 'shapeTo': b}
        name = f'{a}-{b}'
        project = proof_project(name, [(0, c['neutral']), (15, state_a), (55, state_b), (70, c['neutral']), (80, c['neutral'])], c)
        for amount, frame in ((25, 25), (50, 35), (75, 45)):
            capture(project, f'{name}-{amount}', frame)
        if a == 'base':
            capture(project, f'shape-{b}', 55)
        final = capture(project, f'{name}-neutral', 80)
        if baseline.tobytes() != final.tobytes():
            raise ValueError(f'Neutral RGBA differs after {name}')
        neutral_checks.append(name)
        print(f'Rendered {name}; neutral RGBA exact', flush=True)
    for name, overrides in c['poses'].items():
        state = {**c['neutral'], **overrides}
        project = proof_project('pose-' + name, [(0, c['neutral']), (15, state), (30, c['neutral']), (40, c['neutral'])], c)
        capture(project, 'pose-' + name, 15)
        final = capture(project, 'pose-' + name + '-neutral', 40)
        if baseline.tobytes() != final.tobytes():
            raise ValueError(f'Neutral differs after pose {name}')
    extremes = {
        'open': dict(shapeFrom='star', shapeTo='cloud', morph=.5, gazeX=8, gazeY=-6, leftOpen=1.35, rightOpen=.15, leftTilt=-.5, rightTilt=.5, blink=1, bodyX=10, bodyY=-10, bodyRotation=.2, bodyScaleX=1.12, bodyScaleY=.82, light=1),
        'blink': dict(shapeFrom='triangle', shapeTo='flower', morph=.5, gazeX=-8, gazeY=6, leftOpen=.15, rightOpen=1.35, leftTilt=.5, rightTilt=-.5, blink=.35, bodyX=-10, bodyY=10, bodyRotation=-.2, bodyScaleX=.82, bodyScaleY=1.12, light=.75),
        'closed': dict(leftOpen=1.35, rightOpen=.15, blink=0),
    }
    for name, overrides in extremes.items():
        state = {**c['neutral'], **overrides}
        project = proof_project('extreme-' + name, [(0, c['neutral']), (15, state), (30, c['neutral']), (40, c['neutral'])], c)
        capture(project, 'extreme-' + name, 15)
        final = capture(project, 'extreme-' + name + '-neutral', 40)
        if baseline.tobytes() != final.tobytes():
            raise ValueError(f'Neutral differs after extreme {name}')
        neutral_checks.append('extreme-' + name)
    captures['shape-base'] = baseline
    selected = ['shape-' + name for name in SHAPES] + ['pose-' + name for name in c['poses']] + ['extreme-open', 'extreme-blink', 'extreme-closed', 'neutral-initial']
    sheet = Image.new('RGB', (360 * 5, 370 * 3), '#15131e')
    draw = ImageDraw.Draw(sheet)
    for index, label in enumerate(selected):
        x, y = (index % 5) * 360, (index // 5) * 370
        sheet.paste(captures[label], (x, y), captures[label])
        draw.text((x + 16, y + 340), label.replace('í', 'i'), fill='#eee4f8')
    sheet.save(OUTPUT / 'contact-sheet.png')
    transition_sheet = Image.new('RGB', (360 * 3, 370 * 21), '#15131e')
    draw = ImageDraw.Draw(transition_sheet)
    for row, (a, b) in enumerate(itertools.combinations(SHAPES, 2)):
        for column, amount in enumerate((25, 50, 75)):
            label = f'{a}-{b}-{amount}'
            x, y = column * 360, row * 370
            transition_sheet.paste(captures[label], (x, y), captures[label])
            draw.text((x + 16, y + 340), label, fill='#eee4f8')
    transition_sheet.save(OUTPUT / 'transitions.png')
    (OUTPUT / 'render-log.json').write_text(json.dumps(logs, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    report = dict(status='PASS', source='Rive CLI 1.3.0, actual RenderProof state machine', frames=len(logs), pairs=21,
                  intermediateFractions=[.25, .5, .75], neutralRgbaEquality=True, neutralComparisons=21 + 4 + 3,
                  circleTolerance='Bezier radius error <0.03px; initial/final RGBA equality is exact within phase2',
                  scope='Proof fixtures under output only; no production playback/sequence API')
    (OUTPUT / 'render-validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report), flush=True)


def resolve_route(url):
    routes = {"/": SOURCE / "web/index.html", "/style.css": SOURCE / "web/style.css", "/app.mjs": SOURCE / "web/app.mjs", "/rig.mjs": SOURCE / "web/rig.mjs",
              "/contract.json": SOURCE / "body_contract.v2.json", "/rig.riv": OUTPUT / "build/jev_rig_v2.riv", "/rive.js": OUTPUT / "browser/rive.js", "/rive.wasm": OUTPUT / "browser/rive.wasm"}
    path = unquote(urlsplit(url).path)
    if path not in routes:
        raise ValueError("Route not authorized")
    return routes[path]


class RigHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".wasm": "application/wasm"}

    def translate_path(self, path):
        return str(resolve_route(path))

    def send_head(self):
        try:
            resolve_route(self.path)
        except ValueError:
            self.send_error(403, "Route not authorized")
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(403, "Directory listing disabled")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--port", type=int, default=4182)
    args = parser.parse_args()
    if args.check:
        c = load_contract()
        report = validate_contract(c)
        s, _, _, _ = build_scene(c)
        ET.indent(s.root, space="  ")
        if (SOURCE / "scene.rml").read_text(encoding="utf-8") != ET.tostring(s.root, encoding="unicode") + "\n":
            raise ValueError("Generated RML differs from contract")
        print(json.dumps(report))
        return
    compile_rig()
    if args.render:
        render_evidence()
        return
    if args.prepare:
        return
    if not 1 <= args.port <= 65535:
        raise ValueError("Invalid port")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), RigHandler)
    print(f"Rig fase 2: http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
