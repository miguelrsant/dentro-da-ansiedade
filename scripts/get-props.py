# Downloads Poly Haven (CC0) models as 1k glTF into assets-src/props/<id>/ (not committed).
# Usage: python3 scripts/get-props.py id1 id2 ...  then  node scripts/pack-props.mjs public/props id1 id2 ...
import json, os, sys, urllib.request
opener = urllib.request.build_opener(); opener.addheaders = [('User-Agent', 'dentro-da-ansiedade-storyboard/1.0')]; urllib.request.install_opener(opener)
from concurrent.futures import ThreadPoolExecutor
OUT = 'assets-src/props'
def fetch(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path)
def get(id_, res='1k'):
    info = json.load(urllib.request.urlopen(f'https://api.polyhaven.com/files/{id_}'))
    g = info['gltf'].get(res) or info['gltf'][sorted(info['gltf'])[0]]
    g = g['gltf']
    fetch(g['url'], f'{OUT}/{id_}/{id_}.gltf')
    for rel, f in g.get('include', {}).items():
        fetch(f['url'], f'{OUT}/{id_}/{rel}')
    return id_
ids = sys.argv[1:]
with ThreadPoolExecutor(8) as ex:
    for r in ex.map(get, ids): print('ok', r)
