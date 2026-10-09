"""Cherche le code fantôme du frontend : ce qui reste après une suppression.

- une fonction ou une constante exportée que plus aucun autre fichier n'utilise ;
- un texte traduit que plus rien n'affiche, ou affiché sans exister ;
- un id de index.html que ni le JS, ni le CSS, ni les tests n'utilisent ;
- un sélecteur de style.css qui ne correspond plus à rien.

Usage, depuis la racine du dépôt :  python tools/check_unused.py
Sort en erreur s'il trouve quelque chose (lancé par la CI, job lint).
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
JS_DIR = ROOT / "frontend" / "js"

js = {p: p.read_text(encoding="utf-8") for p in JS_DIR.rglob("*.js")}
tests = {p: p.read_text(encoding="utf-8") for p in (ROOT / "e2e" / "tests").glob("*.js")}
html = (ROOT / "frontend" / "index.html").read_text(encoding="utf-8")
css = (ROOT / "frontend" / "css" / "style.css").read_text(encoding="utf-8")
everything = "\n".join([*js.values(), *tests.values()])
problems = []

# Exports : chaque nom exporté doit apparaître dans un autre fichier (jeu ou tests).
for path, source in js.items():
    if path.name.endswith(".test.js"):
        continue
    for name in re.findall(r"^export (?:async )?(?:function|const|let|class) (\w+)", source, re.M):
        used_elsewhere = any(re.search(rf"\b{name}\b", other) for p, other in {**js, **tests}.items() if p != path)
        if not used_elsewhere:
            problems.append(f"{path.relative_to(ROOT)} : export « {name} » utilisé nulle part ailleurs")

# Textes : les clés de fr.js (la référence) et celles que le code demande.
keys = set(re.findall(r'^\s*"([\w.]+)":', js[JS_DIR / "i18n" / "fr.js"], re.M))
code = "\n".join(source for path, source in js.items() if path.parent.name != "i18n") + html
# Clés construites à l'exécution, comme t(`powerup.${type}`) : tout ce qui commence par ce préfixe est utilisé.
dynamic_prefixes = set(re.findall(r"t\(`([\w.]+)\$\{", code))
for key in sorted(keys):
    if f'"{key}"' not in code and not any(key.startswith(prefix) for prefix in dynamic_prefixes):
        problems.append(f"frontend/js/i18n/fr.js : texte « {key} » affiché nulle part")
asked = set(re.findall(r'\bt\(\s*"([\w.]+)"', code)) | set(re.findall(r'data-i18n(?:-title|-aria)?="([\w.]+)"', html))
for key in sorted(asked - keys):
    if not any(path.name.endswith(".test.js") and f'"{key}"' in source for path, source in js.items()):
        problems.append(f"texte « {key} » demandé par le code mais absent de fr.js")

# Ids de la page : utilisés par le JS, les tests ou le CSS.
for element_id in re.findall(r'id="([\w-]+)"', html):
    if element_id not in everything and f"#{element_id}" not in css:
        problems.append(f"frontend/index.html : id « {element_id} » utilisé nulle part")

# Sélecteurs du CSS, commentaires et images intégrées (url(...)) mis à part.
rules = re.sub(r"/\*.*?\*/|url\([^)]*\)", "", css, flags=re.S)
for selector in sorted(set(re.findall(r"[#.]([a-zA-Z][\w-]+)", rules))):
    if selector not in html and selector not in everything:
        problems.append(f"frontend/css/style.css : sélecteur « {selector} » qui ne correspond à rien")

for problem in problems:
    print(problem)
sys.exit(1 if problems else 0)
