"""Preparación aislada de la comparación visual. Nunca escribe fuentes históricas."""
import argparse
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import subprocess
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

LAB = Path(__file__).resolve().parents[1]
SOURCE = LAB / "visual/phase1"
OUTPUT = LAB / "output/visual-phase1"
ORIGINAL = LAB.parent / "public/rive/prove1.riv"
ORIGINAL_HASH = "98aa68170540d448deaed0db6fa57c11b062cebf9036dc1cfada4376254a8daf"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def preserve():
    """Copia versionable del punto de partida; renders originales sólo se hashean."""
    manifest_path = SOURCE / "reference-manifest.json"
    if manifest_path.exists():
        check_preservation()
        return
    paths = []
    for directory in ("rive", "specs", "web"):
        paths.extend(path for path in (LAB / directory).rglob("*") if path.is_file())
    paths.extend(LAB / name for name in ("README.md", "JEV_BODY_CONTRACT.md", "JEV_MOTION_RULES.md"))
    paths.extend(LAB / name for name in ("validators/build.py", "validators/validate.py", "validators/render.py", "validators/preview.py",
                 "tests/test_validator.py", "tests/test_curious_look.py", "tests/test_preview_server.py", "tests/test_controller.mjs", "tests/test_action.mjs"))
    renders = [path for path in (LAB / "output").rglob("*") if path.is_file()
               and not any(part in ("tools", "build", "cache", "visual-phase1") for part in path.relative_to(LAB / "output").parts)]
    files = {path.relative_to(LAB).as_posix(): digest(path) for path in sorted(paths + renders)}
    for path in paths:
        target = SOURCE / "reference-source" / path.relative_to(LAB)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    manifest_path.write_text(json.dumps({"schema": 1, "original": {"path": "public/rive/prove1.riv", "sha256": digest(ORIGINAL)}, "files": files}, indent=2) + "\n", encoding="utf-8")


def check_preservation():
    manifest = json.loads((SOURCE / "reference-manifest.json").read_text(encoding="utf-8"))
    changed = [name for name, expected in manifest["files"].items() if not (LAB / name).is_file() or digest(LAB / name) != expected]
    if digest(ORIGINAL) != ORIGINAL_HASH or digest(ORIGINAL) != manifest["original"]["sha256"]:
        changed.append("public/rive/prove1.riv")
    if changed:
        raise ValueError("Referencias alteradas: " + ", ".join(changed))
    return len(manifest["files"])


def element(tag, **attributes):
    return ET.Element(tag, {key: str(value) for key, value in attributes.items()})


def write_xml(root, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(root, space="  ")
    path.write_text(ET.tostring(root, encoding="unicode") + "\n", encoding="utf-8")


def build_proposal():
    visual = json.loads((SOURCE / "proposal/visual.json").read_text(encoding="utf-8"))
    a, b, eyes = (visual[key] for key in ("artboard", "body", "eyes"))
    serial = 0

    def add(parent, tag, **attributes):
        nonlocal serial
        serial += 1
        child = element(tag, id=f"0:{serial}", **attributes)
        parent.append(child)
        return child

    root = element("Rive", version=1, kind="fragment")
    board = add(root, "Artboard", name=a["name"], width=a["width"], height=a["height"], originX=0, originY=0)
    body = add(board, "Node", name="NeutralBody", x=b["centerX"], y=b["centerY"])
    for name, sign in (("LeftEye", -1), ("RightEye", 1)):
        shape = add(body, "Shape", name=name, x=sign * eyes["separation"] / 2, y=eyes["offsetY"])
        add(shape, "Ellipse", width=eyes["width"], height=eyes["height"], originX=0.5, originY=0.5)
        add(add(shape, "Fill"), "SolidColor", colorValue=eyes["color"])

    # Las capas se apilan delante hacia atrás. Ojos y luces están contenidos
    # en la esfera; las dos últimas capas son contraluces suaves detrás.
    for layer in visual["lighting"]:
        paint = {"blendModeValue": layer["blendModeValue"]} if "blendModeValue" in layer else {}
        shape = add(body, "Shape", name=layer["name"], x=layer.get("x", 0), y=layer.get("y", 0), **paint)
        add(shape, b["geometry"], width=layer.get("width", b["width"]), height=layer.get("height", b["height"]), originX=0.5, originY=0.5)
        gradient = add(add(shape, "Fill"), layer["kind"], **layer["coordinates"])
        for position, color in layer["stops"]:
            add(gradient, "GradientStop", position=position, colorValue=color)
    write_xml(root, SOURCE / "proposal/scene.rml")


def build_reference():
    root = ET.parse(SOURCE / "reference-source/rive/main.rml").getroot()
    board = root.find("Artboard")
    board.attrib.pop("defaultStateMachineId", None)
    # Se separa sólo el fondo del artboard en esta copia para compartir fondos.
    for child in list(board):
        if child.tag == "Fill":
            board.remove(child)
    write_xml(root, SOURCE / "current-reference/scene.rml")


def routes():
    return {
        "/": SOURCE / "web/index.html", "/style.css": SOURCE / "web/style.css",
        "/app.mjs": SOURCE / "web/app.mjs", "/geometry.mjs": SOURCE / "web/geometry.mjs",
        "/matte.mjs": SOURCE / "web/matte.mjs",
        "/comparison.json": SOURCE / "comparison.json",
        "/rive.js": OUTPUT / "browser/rive.js", "/rive.wasm": OUTPUT / "browser/rive.wasm",
        "/original.riv": ORIGINAL,
        "/current.riv": OUTPUT / "build/current_reference.riv",
        "/proposal.riv": OUTPUT / "build/jev_neutral_proposal.riv",
    }


def resolve_route(url):
    path = unquote(urlsplit(url).path)
    # Allowlist exacta; no se concatena una ruta del usuario con el repositorio.
    if path not in routes():
        raise ValueError("Ruta no autorizada")
    return routes()[path]


class ComparisonHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".wasm": "application/wasm"}

    def translate_path(self, path):
        return str(resolve_route(path))

    def send_head(self):
        try:
            resolve_route(self.path)
        except (ValueError, OSError):
            self.send_error(403, "Ruta no autorizada")
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(403, "Listado deshabilitado")
        return None

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


def prepare():
    if digest(ORIGINAL) != ORIGINAL_HASH:
        raise ValueError("El original no coincide con la referencia autorizada")
    preserve()
    build_proposal()
    build_reference()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    executable = LAB / "output/tools/rive.exe"
    reports = {}
    for name in ("current-reference", "proposal"):
        project = SOURCE / name
        for mode in ("verify", "once"):
            result = subprocess.run([str(executable), str(project), "--" + mode, "--format=json"], capture_output=True, text=True, check=True)
            (OUTPUT / f"{name}-{mode}.json").write_text(result.stdout, encoding="utf-8")
            reports[f"{name}-{mode}"] = "passed"
    package = LAB.parent / "node_modules/@rive-app/webgl2"
    if json.loads((package / "package.json").read_text(encoding="utf-8"))["version"] != "2.42.2":
        raise ValueError("Runtime instalado debe ser 2.42.2")
    browser = OUTPUT / "browser"
    browser.mkdir(exist_ok=True)
    for name in ("rive.js", "rive.wasm"):
        shutil.copyfile(package / name, browser / name)
    reports["runtime"] = {"package": "@rive-app/webgl2", "version": "2.42.2", "riveJsSha256": digest(browser / "rive.js"), "wasmSha256": digest(browser / "rive.wasm")}
    reports["preservedFiles"] = check_preservation()
    reports["originalSha256"] = digest(ORIGINAL)
    (OUTPUT / "build-report.json").write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(reports), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--check-preservation", action="store_true")
    parser.add_argument("--port", type=int, default=4181)
    args = parser.parse_args()
    if args.check_preservation:
        print(f"Referencias intactas: {check_preservation()}")
        return
    prepare()
    if args.prepare:
        return
    if not 1 <= args.port <= 65535:
        raise ValueError("Puerto inválido")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), ComparisonHandler)
    print(f"Comparador visual: http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Comparador no disponible: {error}")
