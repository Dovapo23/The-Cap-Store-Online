"""
Optimiza las imágenes de productos (images/<coleccion>/*.jpg|jpeg|png) para web:
redimensiona a un ancho máximo y recomprime.

Es seguro correrlo las veces que quieras: guarda un manifiesto de hashes
(images/.optimize_manifest.json) y solo vuelve a procesar una imagen si su
contenido cambió desde la última vez — así no se recomprime (y degrada)
una foto que ya quedó optimizada.

Uso: cada vez que agregues, reemplaces o quites fotos del catálogo dentro de
images/<coleccion>/, corre:

    py optimize_images.py

Recorre automáticamente todas las subcarpetas de images/ (agropecuario,
luxury, colombia, o cualquier colección nueva que agregues) — no hay que
tocar este script al crecer o reducir el catálogo. No toca archivos sueltos
en la raíz de images/ (como el ícono de la app de Meta).

Al final, sincroniza una copia completa de images/ dentro de
chatbot/images/ — el bot de WhatsApp corre en Railway desde el repo git de
chatbot/ (separado del resto del proyecto), así que necesita su propia
copia de las fotos para poder mandarlas por WhatsApp. Después de correr
este script, falta hacer commit + push dentro de chatbot/ para que el
cambio llegue a producción.
"""

import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image

BASE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = BASE_DIR / "images"
MANIFEST_PATH = IMAGES_DIR / ".optimize_manifest.json"
CHATBOT_IMAGES_DIR = BASE_DIR / "chatbot" / "images"

MAX_WIDTH = 1200
JPEG_QUALITY = 82
EXTENSIONES = {".jpg", ".jpeg", ".png"}


def hash_archivo(path):
    return hashlib.md5(path.read_bytes()).hexdigest()


def cargar_manifiesto():
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {}


def guardar_manifiesto(manifiesto):
    MANIFEST_PATH.write_text(
        json.dumps(manifiesto, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def optimizar(path):
    img = Image.open(path)

    if img.width > MAX_WIDTH:
        alto_nuevo = int(img.height * (MAX_WIDTH / img.width))
        img = img.resize((MAX_WIDTH, alto_nuevo), Image.LANCZOS)

    ext = path.suffix.lower()
    if ext in (".jpg", ".jpeg"):
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(path, quality=JPEG_QUALITY, optimize=True)
    else:  # .png
        img.save(path, optimize=True)


def main():
    if not IMAGES_DIR.exists():
        print(f"No existe la carpeta {IMAGES_DIR}")
        return

    manifiesto = cargar_manifiesto()
    procesadas = 0
    sin_cambios = 0
    peso_antes = 0
    peso_despues = 0

    carpetas = sorted(p for p in IMAGES_DIR.iterdir() if p.is_dir())

    for carpeta in carpetas:
        for img_path in sorted(carpeta.iterdir()):
            if img_path.suffix.lower() not in EXTENSIONES:
                continue

            clave = str(img_path.relative_to(IMAGES_DIR))
            size_antes = img_path.stat().st_size
            hash_actual = hash_archivo(img_path)

            if manifiesto.get(clave) == hash_actual:
                sin_cambios += 1
                continue

            optimizar(img_path)

            size_despues = img_path.stat().st_size
            manifiesto[clave] = hash_archivo(img_path)

            peso_antes += size_antes
            peso_despues += size_despues
            procesadas += 1
            print(f"  {clave}: {size_antes / 1024:.0f} KB -> {size_despues / 1024:.0f} KB")

    guardar_manifiesto(manifiesto)

    print(f"\nProcesadas: {procesadas} | Ya optimizadas (sin cambios): {sin_cambios}")
    if procesadas:
        ahorro = peso_antes - peso_despues
        print(
            f"Peso de las procesadas: {peso_antes / 1024:.0f} KB -> "
            f"{peso_despues / 1024:.0f} KB (ahorro {ahorro / 1024:.0f} KB)"
        )

    sincronizar_chatbot()
    print(f"\nSincronizado en {CHATBOT_IMAGES_DIR}")
    print("Falta: dentro de chatbot/, hacer 'git add images && git commit ... && git push'")


def sincronizar_chatbot():
    if CHATBOT_IMAGES_DIR.exists():
        shutil.rmtree(CHATBOT_IMAGES_DIR)
    shutil.copytree(
        IMAGES_DIR,
        CHATBOT_IMAGES_DIR,
        ignore=shutil.ignore_patterns(".optimize_manifest.json"),
    )


if __name__ == "__main__":
    main()
