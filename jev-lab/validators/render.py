"""Capturas de Rive CLI real y comparación de píxeles (Pillow solo para QA/GIF)."""
import json
import argparse
from pathlib import Path
import subprocess
import shutil
from build import LAB, build, contract, catalog, selection, output_dir


def render(animation=None):
    from PIL import Image, ImageChops, ImageDraw
    chosen=animation or selection()
    if chosen != selection():build(animation=chosen)
    build(check=True)
    duration_ms=round(json.loads((LAB/"specs"/f"{chosen}.json").read_text(encoding="utf-8"))["duration"]*1000)
    output=output_dir(chosen);output.mkdir(parents=True,exist_ok=True)
    frames=output/"frames"; frames.mkdir(exist_ok=True)
    captures=[]; logs=[]
    times=list(range(0,duration_ms+1,50))+[1000]
    for ms in times:
        path=frames/f"{ms:04d}.png"
        result=subprocess.run([str(LAB/"output/tools/rive.exe"),str(LAB/"rive"),f"--screenshot={path}",f"--advance={ms}ms"],capture_output=True,text=True,encoding="utf-8")
        logs.append(f"TIME {ms}ms EXIT {result.returncode}\n{result.stdout}{result.stderr}")
        if result.returncode != 0 or not path.exists():raise ValueError(f"Screenshot falló: {ms}ms")
        captures.append(Image.open(path).convert("RGB"))
        print(f"Rendered {ms}ms",flush=True)
    (output/"render.log").write_text("\n".join(logs),encoding="utf-8")
    neutral=captures[0]
    size=(contract()["artboard"]["width"],contract()["artboard"]["height"])
    visibility=[]
    for ms,im in zip(times,captures):
        if im.size != size:raise ValueError("Dimensiones inesperadas")
        background=im.getpixel((0,0))
        pixels=list(im.get_flattened_data()) if hasattr(im,"get_flattened_data") else list(im.getdata())
        body_pixels=sum(max(abs(channel-base) for channel,base in zip(pixel,background))>20 for pixel in pixels)
        eye_pixels=sum(min(pixel)>220 for pixel in pixels)
        if body_pixels<1000 or eye_pixels<10:raise ValueError(f"Personaje u ojos invisibles: {ms}ms")
        visibility.append({"ms":ms,"bodyPixels":body_pixels,"eyePixels":eye_pixels})
    for index in (-2,-1):
        original=Image.open(frames/f"{times[index]:04d}.png").convert("RGBA")
        initial=Image.open(frames/"0000.png").convert("RGBA")
        if original.tobytes() != initial.tobytes():raise ValueError("Final/post-final difiere de neutral en píxeles RGBA")
    pose_ms=350 if chosen == "happy_bounce" else 400
    pose_name="apex" if chosen == "happy_bounce" else "hold"
    if ImageChops.difference(neutral,captures[times.index(pose_ms)]).getbbox() is None:raise ValueError("Animación sin movimiento")
    for ms,name in ((0,"neutral"),(pose_ms,pose_name),(duration_ms,"final"),(1000,"post-final")):
        shutil.copyfile(frames/f"{ms:04d}.png",output/f"{name}.png")
    selected=([(0,"neutral"),(50,"ojos"),(150,"anticipacion"),(250,"despegue"),(350,"apice"),(550,"aterrizaje"),(650,"settle"),(750,"neutral exacto")] if chosen == "happy_bounce" else [(0,"neutral"),(100,"solo mirada"),(150,"cuerpo responde"),(300,"inclinacion +7%"),(400,"observa"),(500,"hold"),(650,"regreso suave"),(800,"neutral exacto")])
    sheet=Image.new("RGB",(size[0]*4,(size[1]+30)*2),"#15131e");draw=ImageDraw.Draw(sheet)
    for index,(ms,label) in enumerate(selected):
        x,y=(index%4)*size[0],(index//4)*(size[1]+30)
        sheet.paste(captures[times.index(ms)],(x,y))
        draw.text((x+16,y+size[1]+6),f"{ms} ms - {label}",fill="#d2c6e7")
    sheet.save(output/"contact-sheet.png")
    # Paleta compartida: evita cambios de color por cuantización entre frames.
    palette=sheet.quantize(colors=128)
    gif=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in captures[:-1]]
    gif[0].save(output/f"{chosen}.gif",save_all=True,append_images=gif[1:],duration=[50]*(len(gif)-1)+[500],loop=0,disposal=2)
    report={"status":"PASS","animation":chosen,"durationMs":duration_ms,"source":"Rive CLI 1.3.0 screenshots","frames":len(times),"pixelFormat":"RGBA","finalPixelEquality":True,"postFinalPixelEquality":True,"visibility":visibility}
    (output/"render-validation.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(f"PASS: {len(times)} renders de {chosen}; final y post-final idénticos a neutral; GIF y contact sheet guardados")


if __name__ == "__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--animation",choices=tuple(catalog()))
    render(parser.parse_args().animation)
