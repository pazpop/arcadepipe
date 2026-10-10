"""Construit l'archive du jeu pour itch.io : dist/arcadepipe-itch.zip.

itch.io héberge les fichiers du jeu chez lui. L'archive contient donc les
fichiers du jeu, avec deux réglages : l'adresse complète de l'API du
classement (qui reste sur le site), et le numéro de version.

Usage, depuis la racine du dépôt :  python tools/build_itch.py
Voir docs/deploiement.md, section itch.io.
"""
import json
import pathlib
import re
import subprocess
import zipfile

API_BASE = "https://arcadepipe.pazpop.net"

ROOT = pathlib.Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
OUTPUT = ROOT / "dist" / "arcadepipe-itch.zip"

# Ce dont le jeu a besoin pour tourner. Le site sert en plus l'image d'aperçu
# des liens, robots.txt et le kit presse (frontend/Dockerfile).
FILES = ["index.html", "privacy.html", "favicon.svg"]
FOLDERS = ["css", "js", "lib", "music"]
EXCLUDED = (".test.js", "package.json", ".md")


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()


def version():
    return f"2.{git('rev-list', '--count', 'HEAD')}"


def main():
    # Seulement les fichiers suivis par Git : un brouillon ou un fichier du
    # système oublié dans un dossier du jeu ne part pas sur itch.io.
    tracked = git("ls-files", *[f"frontend/{folder}" for folder in FOLDERS]).splitlines()
    paths = [FRONTEND / name for name in FILES]
    paths += [ROOT / name for name in sorted(tracked) if not name.endswith(EXCLUDED)]

    OUTPUT.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in paths:
            name = path.relative_to(FRONTEND).as_posix()
            if name == "js/config.js":
                source = path.read_text(encoding="utf-8")
                source, replaced = re.subn(
                    r"^export const VERSION = .*$", f'export const VERSION = "{version()}";', source, flags=re.M
                )
                assert replaced == 1, "ligne VERSION introuvable dans js/config.js"
                archive.writestr(name, source)
            else:
                archive.write(path, name)
        # Pas de mesure d'audience sur itch.io ; le classement appelle le site.
        archive.writestr("site-config.json", json.dumps({"gaMeasurementId": "", "apiBase": API_BASE}) + "\n")

    size = OUTPUT.stat().st_size / 1_000_000
    print(f"{OUTPUT.relative_to(ROOT)} : {len(paths) + 1} fichiers, {size:.1f} Mo, version {version()}")


if __name__ == "__main__":
    main()
