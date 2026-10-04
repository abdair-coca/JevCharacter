"""Preview local de fase 3: sirve solo jev-lab; sin instalar dependencias."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import subprocess
from urllib.parse import unquote, urlsplit
from build import LAB, build


def contained_path(url, root=LAB):
    path=unquote(urlsplit(url).path)
    if path == "/": path="/web/index.html"
    candidate=(root / path.lstrip("/\\")).resolve()
    if not candidate.is_relative_to(root.resolve()):
        raise ValueError("Ruta fuera del laboratorio")
    return candidate


class LabHandler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,".mjs":"text/javascript",".wasm":"application/wasm"}

    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(LAB),**kwargs)

    def translate_path(self,path):
        return str(contained_path(path))

    def send_head(self):
        try:contained_path(self.path)
        except (ValueError,OSError):
            self.send_error(403,"Ruta fuera del laboratorio");return None
        return super().send_head()

    def list_directory(self,path):
        self.send_error(403,"Listado de directorios deshabilitado")
        return None

    def end_headers(self):
        self.send_header("Cache-Control","no-store")
        super().end_headers()


def prepare():
    build(check=True)
    executable=LAB/"output/tools/rive.exe"
    if not executable.exists():raise ValueError("Falta Rive CLI portable; consultar README")
    subprocess.run([str(executable),str(LAB/"rive"),"--once","--format=json"],check=True)
    package=LAB.parent/"node_modules/@rive-app/canvas"
    if not (package/"package.json").exists():raise ValueError("Falta @rive-app/canvas instalado; no se instalaron dependencias")
    metadata=json.loads((package/"package.json").read_text(encoding="utf-8"))
    if metadata["version"] != "2.42.2":raise ValueError("Este preview requiere el runtime instalado @rive-app/canvas 2.42.2")
    destination=LAB/"output/tools/browser";destination.mkdir(parents=True,exist_ok=True)
    for name in ("rive.js","rive.wasm"):
        shutil.copyfile(package/name,destination/name)


def serve(port):
    if not 1 <= port <= 65535:raise ValueError("Puerto inválido")
    prepare()
    server=ThreadingHTTPServer(("127.0.0.1",port),LabHandler)
    print(f"Fase 3 lista: http://127.0.0.1:{port}/",flush=True)
    print("Neutral al abrir; seguimiento, click/teclado en JEV y Curiosidad. Ctrl+C detiene el servidor.",flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()


if __name__ == "__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--port",type=int,default=4180)
    try:serve(parser.parse_args().port)
    except (ValueError,OSError,subprocess.CalledProcessError) as error:parser.exit(1,f"Preview no disponible: {error}\n")
