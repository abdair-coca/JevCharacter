"""Semantic action authoring, RML compilation and last-valid localhost preview.

Action discovery is filesystem driven. Rive owns interpolation; this compiler
only maps named poses onto the certified rig's existing property keys.
"""
import argparse
import copy
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import threading
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

import rig_phase2 as rig

LAB = rig.LAB
SOURCE = LAB / "visual/phase3"
OUTPUT = LAB / "output/visual-phase3"
IDENTIFIER = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


class DefinitionError(ValueError):
    def __init__(self, source, pointer, message):
        self.source, self.pointer = str(source), pointer or "/"
        self.message = message
        super().__init__(f"{self.source}:{self.pointer}: {message}")

    def diagnostic(self):
        return dict(file=self.source, pointer=self.pointer, message=self.message)


def fail(source, pointer, message):
    raise DefinitionError(source, pointer, message)


def pointer_key(key):
    return str(key).replace("~", "~0").replace("/", "~1")


def fields(value, allowed, required, source, pointer):
    if not isinstance(value, dict):
        fail(source, pointer, "Expected an object")
    for name in value:
        if name not in allowed:
            fail(source, f"{pointer}/{pointer_key(name)}", "Unknown field")
    for name in required:
        if name not in value:
            fail(source, f"{pointer}/{name}", "Required field missing")


def number(value, low, high, source, pointer):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        fail(source, pointer, f"Expected finite number in [{low}, {high}]")
    return value


def identifier(value, source, pointer):
    if not isinstance(value, str) or not IDENTIFIER.fullmatch(value) or "__" in value:
        fail(source, pointer, "Expected lowercase identifier, at most 64 characters; double underscore is reserved")


def read_definition(path):
    class ObjectPairs(list):
        pass

    def materialize(value, pointer=""):
        if isinstance(value, ObjectPairs):
            result = {}
            for key, item in value:
                next_pointer = pointer + "/" + pointer_key(key)
                if key in result:
                    fail(path.name, next_pointer, "Duplicate JSON field")
                result[key] = materialize(item, next_pointer)
            return result
        if isinstance(value, list):
            return [materialize(item, pointer + "/" + str(index)) for index, item in enumerate(value)]
        return value
    try:
        return materialize(json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=ObjectPairs))
    except json.JSONDecodeError as error:
        fail(path.name, "/", f"JSON syntax at line {error.lineno}, column {error.colno}: {error.msg}")


def validate_definition(value, contract, source="action.json"):
    fields(value, {"schema", "id", "intent", "durationMs", "channels", "targetShape", "poses", "phases", "variants"},
           {"schema", "id", "intent", "durationMs", "channels", "poses", "phases"}, source, "")
    if type(value["schema"]) is not int or value["schema"] != 1:
        fail(source, "/schema", "Expected schema 1")
    identifier(value["id"], source, "/id")
    if not isinstance(value["intent"], str) or not value["intent"].strip():
        fail(source, "/intent", "Describe the action intent")
    duration = number(value["durationMs"], 100, 10000, source, "/durationMs")
    end = round(duration * .06)
    if abs(duration * .06 - end) > 1e-6:
        fail(source, "/durationMs", "Duration must end on a 60fps frame")
    channels = value["channels"]
    if not isinstance(channels, list) or not channels:
        fail(source, "/channels", "Expected a nonempty channel list")
    seen = set()
    for index, channel in enumerate(channels):
        if not isinstance(channel, str) or channel not in {*contract["ranges"], "morph"}:
            fail(source, f"/channels/{index}", "Unknown semantic channel")
        if channel in seen:
            fail(source, f"/channels/{index}", "Duplicate channel")
        seen.add(channel)
    if "morph" in channels:
        if not isinstance(value.get("targetShape"), str) or value.get("targetShape") not in contract["shapes"] or value.get("targetShape") == "base":
            fail(source, "/targetShape", "Morph requires one non-base certified target shape")
    elif "targetShape" in value:
        fail(source, "/targetShape", "Target shape requires morph ownership")
    poses = value["poses"]
    if not isinstance(poses, dict) or not poses:
        fail(source, "/poses", "Expected named poses")

    def validate_pose(pose, pointer, complete):
        fields(pose, set(channels), channels if complete else [], source, pointer)
        for key, amount in pose.items():
            low, high = (0, 1) if key == "morph" else contract["ranges"][key]
            number(amount, low, high, source, pointer + "/" + key)

    for name, pose in poses.items():
        identifier(name, source, "/poses/" + name)
        validate_pose(pose, "/poses/" + name, True)
    phases = value["phases"]
    if not isinstance(phases, list) or len(phases) < 3:
        fail(source, "/phases", "Expected at least entry, neutral return and final hold")
    previous, names = -1, set()
    frames = []
    for index, phase in enumerate(phases):
        pointer = f"/phases/{index}"
        fields(phase, {"name", "timeMs", "pose", "curve"}, {"name", "timeMs", "pose", "curve"}, source, pointer)
        identifier(phase["name"], source, pointer + "/name")
        if phase["name"] in names:
            fail(source, pointer + "/name", "Duplicate phase name")
        names.add(phase["name"])
        if not isinstance(phase["pose"], str) or phase["pose"] not in poses:
            fail(source, pointer + "/pose", "Unknown pose")
        milliseconds = number(phase["timeMs"], 0, duration, source, pointer + "/timeMs")
        frame = round(milliseconds * .06)
        if frame <= previous:
            fail(source, pointer + "/timeMs", "Times must increase after 60fps quantization")
        previous = frame
        frames.append(frame)
        curve = phase["curve"]
        if not isinstance(curve, list) or len(curve) != 4:
            fail(source, pointer + "/curve", "Expected [x1, y1, x2, y2]")
        for position, control in enumerate(curve):
            number(control, 0, 1, source, pointer + f"/curve/{position}")
        if curve[0] > curve[2] or curve[1] > curve[3]:
            fail(source, pointer + "/curve", "Cubic controls must be monotone")
    if frames[0] != 0 or phases[0]["timeMs"] != 0 or frames[-1] != end or phases[-1]["timeMs"] != duration:
        fail(source, "/phases", "Timeline must begin at 0 and end at durationMs")
    if end - frames[-2] < 2:
        fail(source, "/phases", "Final neutral hold needs at least two frames")
    variants = value.get("variants", {})
    if not isinstance(variants, dict):
        fail(source, "/variants", "Expected named variant pose overrides")
    for name, overrides in variants.items():
        identifier(name, source, "/variants/" + name)
        if name == "default":
            fail(source, "/variants/default", "default is reserved")
        fields(overrides, set(poses), [], source, "/variants/" + name)
        for pose, changes in overrides.items():
            validate_pose(changes, f"/variants/{name}/{pose}", False)
    # Every entry and exit is full neutral for every owned channel. Other
    # channels remain neutral through the baseline sampler or ambient inputs.
    for variant, overrides in [("default", {}), *variants.items()]:
        expanded = {name: {**pose, **overrides.get(name, {})} for name, pose in poses.items()}
        for index in (0, len(phases) - 2, len(phases) - 1):
            if any(expanded[phases[index]["pose"]][channel] != contract["neutral"][channel] for channel in channels):
                fail(source, f"/phases/{index}/pose", f"{variant}: entry and final two poses must be complete neutral")
    return value


def discover(source=SOURCE, contract=None):
    contract = contract or rig.load_contract()
    actions, ids = [], set()
    for path in sorted((Path(source) / "actions").glob("*.json")):
        action = validate_definition(read_definition(path), contract, path.name)
        if action["id"] in ids:
            fail(path.name, "/id", "Duplicate action identifier")
        ids.add(action["id"])
        actions.append((path, action))
    if not actions:
        fail("actions", "/", "No action definitions found")
    return actions


def generate(source=SOURCE):
    contract = rig.load_contract()
    definitions = discover(source, contract)
    builder, board, shapes, channels = rig.build_scene(contract)
    neutral_clip = next(clip for clip in board.findall("LinearAnimation") if clip.get("name") == "neutral")
    catalog = dict(schema=1, fps=60, artboard=contract["artboard"]["name"],
                   contractSha256=rig.digest(rig.SOURCE / "body_contract.v2.json"),
                   parameterBounds=dict(intensity=[0, 1], speed=[.1, 4]), actions={})
    for path, action in definitions:
        ownership = set()
        for channel in action["channels"]:
            keys = shapes[action["targetShape"]] if channel == "morph" else channels[channel]
            for object_id, props in keys.items():
                for key in props:
                    if (object_id, key) in ownership:
                        fail(path.name, "/channels", "Channels overlap in rig property space")
                    ownership.add((object_id, key))
        record = dict(id=action["id"], intent=action["intent"], durationMs=action["durationMs"],
                      channels=action["channels"], source=path.name, sourceSha256=rig.digest(path),
                      targetShape=action.get("targetShape"), phases=action["phases"], variants={})
        catalog["actions"][action["id"]] = record
        for variant, overrides in [("default", {}), *action.get("variants", {}).items()]:
            name = f'action_{action["id"]}__{variant}'
            clip = builder.add(board, "LinearAnimation", name=name, fps=60,
                               duration=round(action["durationMs"] * .06), loopValue="oneShot")
            poses = {key: {**value, **overrides.get(key, {})} for key, value in action["poses"].items()}
            samples = []
            for phase in action["phases"]:
                state = {**contract["neutral"], **poses[phase["pose"]]}
                if "morph" in action["channels"]:
                    state["shapeTo"] = action["targetShape"]
                samples.append(rig.pose_properties(state, contract, builder, shapes, channels))
            for object_id in sorted({obj for obj, _ in ownership}):
                obj = builder.add(clip, "KeyedObject", objectId=object_id)
                for key in sorted(prop for target, prop in ownership if target == object_id):
                    prop = builder.add(obj, "KeyedProperty", propertyKey=key)
                    for phase, sample in zip(action["phases"], samples):
                        frame = builder.add(prop, "KeyFrameDouble", frame=round(phase["timeMs"] * .06),
                                            value=sample[object_id][key], interpolationType="cubic")
                        builder.add(frame, "CubicEaseInterpolator", **dict(zip(("x1", "y1", "x2", "y2"), phase["curve"])))
            machine_name = f'Action_{action["id"]}__{variant}'
            machine = builder.add(board, "StateMachine", name=machine_name)
            layer = builder.add(machine, "StateMachineLayer", name="Action")
            builder.add(layer, "AnyState", x=0, y=-100)
            builder.add(layer, "ExitState", x=600, y=0)
            entry = builder.add(layer, "EntryState", x=0, y=0)
            playing = builder.add(layer, "AnimationState", animationId=clip.get("id"), reset=True, x=200, y=0)
            neutral = builder.add(layer, "AnimationState", animationId=neutral_clip.get("id"), reset=True, x=400, y=0)
            builder.add(entry, "StateTransition", stateToId=playing.get("id"), duration=0)
            builder.add(playing, "StateTransition", stateToId=neutral.get("id"), duration=0,
                        enableExitTime=True, exitTimeIsPercetange=True, exitTime=100)
            record["variants"][variant] = dict(clip=name, machine=machine_name)
    ET.indent(builder.root, space="  ")
    return builder.root, catalog


def yaml_text(output):
    return f"name: jev_actions_v3\nmain: JevRigV2\noutput:\n  dir: {Path(output).as_posix()}\n"


class AuthoringStore:
    """Publish immutable catalog/RIV pairs only after a successful CLI build."""
    def __init__(self, source=SOURCE, output=OUTPUT):
        self.source, self.output = Path(source), Path(output)
        self.lock = threading.Lock()
        self.generation, self.revision, self.error = None, 0, None
        self.snapshots = {}
        self.fingerprint = None

    def sources_hash(self):
        values = [(path.name, path.read_bytes()) for path in sorted((self.source / "actions").glob("*.json"))]
        return hashlib.sha256(b"".join(name.encode() + data for name, data in values)).hexdigest()

    def refresh(self, force=False):
        sources_read = False
        try:
            fingerprint = self.sources_hash()
            sources_read = True
            if not force and fingerprint == self.fingerprint:
                return False
            self.fingerprint = fingerprint
            root, catalog = generate(self.source)
            scene = ET.tostring(root, encoding="unicode") + "\n"
            generation = hashlib.sha256((scene + json.dumps(catalog, sort_keys=True)).encode()).hexdigest()[:20]
            stage = self.output / "build" / generation
            project = stage / "project"
            project.mkdir(parents=True, exist_ok=True)
            rig.write_xml(root, project / "scene.rml")
            (project / "rive.yaml").write_text(yaml_text(stage), encoding="utf-8")
            logs = {}
            for mode in ("verify", "once"):
                result = subprocess.run([str(rig.CLI), str(project), "--" + mode, "--format=json"],
                                        capture_output=True, text=True, encoding="utf-8")
                if result.returncode:
                    fail("scene.rml", "/", f"CLI {mode}: {result.stderr or result.stdout}")
                logs[mode] = json.loads(result.stdout)
            result = subprocess.run([str(rig.CLI), "inspect", str(project), "--summary"], capture_output=True, text=True, encoding="utf-8", check=True)
            inspection = json.loads(result.stdout)
            if inspection.get("problems"):
                fail("scene.rml", "/", f"CLI inspect: {inspection['problems']}")
            catalog["generation"] = generation
            riv_bytes = (stage / "jev_actions_v3.riv").read_bytes()
            catalog_bytes = (json.dumps(catalog, indent=2, ensure_ascii=False) + "\n").encode()
            if self.sources_hash() != fingerprint:
                fail("actions", "/", "Sources changed during compilation; next watch pass will retry")
            # These reviewable source outputs change together only after the
            # complete immutable build is available. Server never serves them.
            self.source.mkdir(parents=True, exist_ok=True)
            (self.source / "scene.rml").write_text(scene, encoding="utf-8")
            (self.source / "catalog.json").write_bytes(catalog_bytes)
            (self.source / "rive.yaml").write_text(yaml_text("../../output/visual-phase3/build/manual"), encoding="utf-8")
            summary = dict(status="PASS", cli="1.3.0", runtime="2.42.2", generation=generation,
                           actions=list(catalog["actions"]), variants=sum(len(a["variants"]) for a in catalog["actions"].values()),
                           verify=logs["verify"], once=logs["once"], inspection=inspection, problems=inspection["problems"])
            (self.output / "compile-validation.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
            with self.lock:
                self.snapshots[generation] = (catalog_bytes, riv_bytes)
                self.generation, self.error = generation, None
                self.revision += 1
            print(f"Built {generation}: {len(catalog['actions'])} discovered actions", flush=True)
            return True
        except (ValueError, OSError, subprocess.SubprocessError) as error:
            if not sources_read:
                self.fingerprint = None
            diagnostic = error.diagnostic() if isinstance(error, DefinitionError) else dict(file="actions", pointer="/", message=str(error))
            with self.lock:
                self.error = diagnostic
                self.revision += 1
            print(f"Last valid retained: {diagnostic}", flush=True)
            return False

    def status(self):
        with self.lock:
            return dict(revision=self.revision, generation=self.generation, error=self.error)


def route(path, store):
    path = unquote(urlsplit(path).path)
    if path == "/status.json":
        return "application/json", json.dumps(store.status()).encode()
    match = re.fullmatch(r"/generation/([a-f0-9]{20})/(catalog.json|actions.riv)", path)
    if match:
        with store.lock:
            snapshot = store.snapshots.get(match[1])
        if snapshot is None:
            raise FileNotFoundError("Generation absent")
        return ("application/json", snapshot[0]) if match[2] == "catalog.json" else ("application/octet-stream", snapshot[1])
    paths = {"/": (SOURCE / "web/index.html", "text/html"), "/style.css": (SOURCE / "web/style.css", "text/css"),
             "/app.mjs": (SOURCE / "web/app.mjs", "text/javascript"), "/controller.mjs": (SOURCE / "web/controller.mjs", "text/javascript"),
             "/phase2/web/rig.mjs": (rig.SOURCE / "web/rig.mjs", "text/javascript"), "/contract.json": (rig.SOURCE / "body_contract.v2.json", "application/json"),
             "/rive.js": (OUTPUT / "browser/rive.js", "text/javascript"), "/rive.wasm": (OUTPUT / "browser/rive.wasm", "application/wasm")}
    if path not in paths:
        raise PermissionError("Route not authorized")
    file, mime = paths[path]
    return mime, file.read_bytes()


def serve(store, port):
    package = LAB.parent / "node_modules/@rive-app/webgl2"
    if json.loads((package / "package.json").read_text(encoding="utf-8"))["version"] != "2.42.2":
        raise ValueError("Runtime must remain 2.42.2")
    browser = OUTPUT / "browser"
    browser.mkdir(parents=True, exist_ok=True)
    for name in ("rive.js", "rive.wasm"):
        shutil.copyfile(package / name, browser / name)
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            try:
                mime, data = route(self.path, store)
            except PermissionError:
                self.send_error(403, "Route not authorized")
                return
            except FileNotFoundError:
                self.send_error(404, "Resource absent")
                return
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_):
            pass
    done = threading.Event()
    def watch():
        while not done.wait(.5):
            store.refresh()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    worker = threading.Thread(target=watch, daemon=True)
    worker.start()
    print(f"Autoría fase 3: http://127.0.0.1:{port}/", flush=True)
    try:
        server.serve_forever()
    finally:
        done.set()
        server.server_close()
        worker.join(timeout=5)


def render_evidence(store):
    """Capture actual generated machines, including interruption and neutral."""
    from PIL import Image, ImageChops, ImageDraw
    root, catalog = generate(store.source)
    frames = store.output / "renders"
    frames.mkdir(parents=True, exist_ok=True)
    board = root.find("Artboard")
    logs, captures, neutral_checks = [], {}, []

    def project(label, machine_name=None, interrupted=False):
        tree = copy.deepcopy(root)
        artboard = tree.find("Artboard")
        selected = machine_name or "RigNeutral"
        selected_machine = next(m for m in artboard.findall("StateMachine") if m.get("name") == selected)
        needed_clips = {state.get("animationId") for state in selected_machine.iter("AnimationState")}
        if interrupted:
            needed_clips.add(next(clip.get("id") for clip in artboard.findall("LinearAnimation") if clip.get("name") == catalog["actions"]["curious_look"]["variants"]["default"]["clip"]))
        # A focused proof copies the exact generated clips and machine while
        # excluding unrelated sampler clips. This keeps CLI captures practical.
        for element in list(artboard):
            if element.tag == "StateMachine" and element is not selected_machine:
                artboard.remove(element)
            elif element.tag == "LinearAnimation" and element.get("id") not in needed_clips:
                artboard.remove(element)
        if machine_name:
            machine = next(m for m in artboard.findall("StateMachine") if m.get("name") == machine_name)
            artboard.set("defaultStateMachineId", machine.get("id"))
            if interrupted:
                layer = machine.find("StateMachineLayer")
                playing = layer.findall("AnimationState")[0]
                transition = playing.find("StateTransition")
                # At 200ms switch directly from a flower action into curiosity.
                # Both clips have real cubic curves and the successor begins
                # neutral on its owned channels. Full neutral follows it.
                next_clip = next(clip for clip in artboard.findall("LinearAnimation") if clip.get("name") == catalog["actions"]["curious_look"]["variants"]["default"]["clip"])
                new_state = ET.SubElement(layer, "AnimationState", id="0:999998", animationId=next_clip.get("id"), reset="true", x="300", y="100")
                original_destination = transition.get("stateToId")
                transition.set("stateToId", new_state.get("id"))
                transition.set("exitTimeIsPercetange", "false")
                transition.set("exitTime", "200")
                ET.SubElement(new_state, "StateTransition", id="0:999999", stateToId=original_destination,
                              enableExitTime="true", exitTimeIsPercetange="true", exitTime="100", duration="0")
        directory = store.output / "harness" / label
        rig.write_xml(tree, directory / "scene.rml")
        (directory / "rive.yaml").write_text("name: proof\nmain: JevRigV2\n", encoding="utf-8")
        return directory

    def capture(directory, label, frame):
        path = frames / (label + ".png")
        result = subprocess.run([str(rig.CLI), str(directory), f"--screenshot={path}", f"--advance={frame}", "--fit=contain"],
                                capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        image = Image.open(path).convert("RGBA")
        background = Image.new("RGBA", image.size, image.getpixel((0, 0)))
        if image.size != (360, 340) or ImageChops.difference(image.convert("RGB"), background.convert("RGB")).getbbox() is None:
            raise ValueError("Invalid or invisible render")
        captures[label] = image
        logs.append(dict(label=label, frame=frame, exit=result.returncode, source="Rive CLI actual state machine"))
        return image

    baseline = capture(project("neutral"), "neutral-initial", 1)
    for action in catalog["actions"].values():
        for variant, clips in action["variants"].items():
            label = action["id"] + "-" + variant
            directory = project(label, clips["machine"])
            peak = max(action["phases"], key=lambda phase: phase["timeMs"] if phase["timeMs"] < action["durationMs"] * .6 else 0)
            capture(directory, label + "-active", round(peak["timeMs"] * .06) + 1)
            capture(directory, label + "-return", round(action["durationMs"] * .048))
            final = capture(directory, label + "-neutral", round(action["durationMs"] * .06) + 5)
            if final.tobytes() != baseline.tobytes():
                raise ValueError(f"Final neutral differs: {label}")
            neutral_checks.append(label)
            print(f"Rendered {label}; neutral RGBA exact", flush=True)
    interrupted = project("interruption", catalog["actions"]["attention_pulse"]["variants"]["full"]["machine"], True)
    capture(interrupted, "interruption-before", 10)
    capture(interrupted, "interruption-after", 25)
    final = capture(interrupted, "interruption-neutral", 70)
    if final.tobytes() != baseline.tobytes():
        raise ValueError("Interruption final neutral differs")
    neutral_checks.append("interruption")
    labels = [name for name in captures if name.endswith("-active")] + ["interruption-before", "interruption-after", "interruption-neutral", "neutral-initial"]
    sheet = Image.new("RGB", (360 * 4, 370 * math.ceil(len(labels) / 4)), "#15131e")
    draw = ImageDraw.Draw(sheet)
    for index, label in enumerate(labels):
        x, y = index % 4 * 360, index // 4 * 370
        sheet.paste(captures[label], (x, y), captures[label])
        draw.text((x + 12, y + 345), label, fill="#eee4f8")
    sheet.save(store.output / "contact-sheet.png")
    report = dict(status="PASS", source="Rive CLI 1.3.0 generated action machines", frames=len(logs),
                  neutralRgbaEquality=True, neutralComparisons=len(neutral_checks), cases=neutral_checks,
                  interruptionScope="CLI immediate machine transition at 200ms; public controller tested separately")
    (store.output / "render-validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (store.output / "render-log.json").write_text(json.dumps(logs, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--port", type=int, default=4183)
    args = parser.parse_args()
    if args.check:
        root, catalog = generate()
        scene = ET.tostring(root, encoding="unicode") + "\n"
        existing = json.loads((SOURCE / "catalog.json").read_text(encoding="utf-8"))
        existing.pop("generation", None)
        if existing != catalog or scene != (SOURCE / "scene.rml").read_text(encoding="utf-8"):
            raise ValueError("Generated scene/catalog differ from definitions")
        print(json.dumps(dict(status="PASS", actions=len(catalog["actions"]))))
        return
    store = AuthoringStore()
    if not store.refresh(force=True):
        raise ValueError(store.status()["error"])
    if args.render:
        render_evidence(store)
        return
    if args.prepare:
        return
    if not 1 <= args.port <= 65535:
        raise ValueError("Invalid port")
    serve(store, args.port)


if __name__ == "__main__":
    main()
