"""Import unchanged vanilla item sprites and render block inventory icons from vanilla faces."""
from pathlib import Path
from PIL import Image
import urllib.request, hashlib, json, io
root = Path(__file__).resolve().parent.parent
out = root / 'public/art/game-items'
out.mkdir(parents=True, exist_ok=True)
base = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21.4/'
manifest = {'version': 'Minecraft Java 1.21.4', 'rights': 'Minecraft artwork belongs to Mojang/Microsoft. Not covered by the project code license.', 'assets': {}}
items = {'herb': 'wheat', 'ore': 'raw_iron', 'medicine': 'potion', 'garden': 'wheat_seeds', 'kunai': 'iron_sword', 'armor': 'iron_chestplate', 'recover': 'iron_pickaxe', 'dash': 'leather_boots', 'eye': 'ender_eye', 'chakra': 'blaze_powder', 'recall': 'compass_00', 'lantern': 'lantern', 'campfire': 'campfire'}
for name, vanilla in items.items():
    url = base + 'items/' + vanilla + '.png'
    with urllib.request.urlopen(url, timeout=30) as response: data = response.read()
    im = Image.open(io.BytesIO(data)); assert im.width == 16 and im.height % 16 == 0
    path = out / (name + '.png'); path.write_bytes(data)
    manifest['assets'][name] = {'source': url, 'sha256': hashlib.sha256(data).hexdigest(), 'kind': 'Unchanged item sprite; game labels may adapt its gameplay role.'}
for name, vanilla in {'wood': 'oak_planks', 'stone': 'cobblestone', 'trail': 'dirt_path_top', 'brick': 'bricks'}.items():
    url = base + 'blocks/' + vanilla + '.png'
    with urllib.request.urlopen(url, timeout=30) as response: data = response.read()
    tex = Image.open(io.BytesIO(data)).convert('RGBA').crop((0, 0, 16, 16))
    image = Image.new('RGBA', (64, 64))
    def face(p, a, b):
        ax, ay = a; bx, by = b; px, py = p; det = ax*by-ay*bx
        coeff = (by/det, -bx/det, (bx*py-by*px)/det, -ay/det, ax/det, (ay*px-ax*py)/det)
        image.alpha_composite(tex.transform((64, 64), Image.Transform.AFFINE, coeff, Image.Resampling.NEAREST))
    face((4,16),(28/16,-14/16),(28/16,14/16)); face((4,16),(28/16,14/16),(0,30/16)); face((32,30),(28/16,-14/16),(0,30/16))
    path = out / (name + '.png'); image.save(path)
    manifest['assets'][name] = {'source': url, 'sourceSha256': hashlib.sha256(data).hexdigest(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'kind': 'Original isometric inventory render from vanilla block faces.'}
# Non-cube items retain their actual vanilla cuboid silhouettes, not plank stand-ins.
model_url = base + 'blocks_models.json'
with urllib.request.urlopen(model_url, timeout=30) as response: model_bytes = response.read()
all_models = json.loads(model_bytes)
def resolve_model(name):
    current = all_models[name]; parent = current.get('parent', '').split('/')[-1]
    inherited = resolve_model(parent) if parent in all_models else {'textures': {}, 'elements': []}
    return {'textures': {**inherited['textures'], **current.get('textures', {})}, 'elements': current.get('elements', inherited['elements'])}
def project(x, y, z): return (32 + (x-z)*1.75, 32 + (x+z)*.875 - y*1.875)
downloaded = {}
for name, model_name in {'fence': 'oak_fence_inventory', 'bridge': 'oak_trapdoor_bottom'}.items():
    model = resolve_model(model_name); image = Image.new('RGBA', (64, 64)); source_hashes = {}
    for element in sorted(model['elements'], key=lambda e: sum(e['from'][::2]) + sum(e['to'][::2])):
        x0,y0,z0 = element['from']; x1,y1,z1 = element['to']
        for direction in ['up', 'south', 'east']:
            face_data = element['faces'].get(direction)
            if not face_data: continue
            texture = face_data['texture']
            while texture.startswith('#'): texture = model['textures'][texture[1:]]
            url = base + 'blocks/' + texture.split('/')[-1] + '.png'
            if url not in downloaded:
                with urllib.request.urlopen(url, timeout=30) as response: downloaded[url] = response.read()
            data = downloaded[url]
            source_hashes[url] = hashlib.sha256(data).hexdigest()
            u0,v0,u1,v1 = face_data.get('uv', [0,0,16,16])
            tex = Image.open(io.BytesIO(data)).convert('RGBA').crop((min(u0,u1),min(v0,v1),max(u0,u1),max(v0,v1)))
            if u0 > u1: tex = tex.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if v0 > v1: tex = tex.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            if direction == 'up': p = project(x0,y1,z0); a = ((x1-x0)*1.75,(x1-x0)*.875); b = (-(z1-z0)*1.75,(z1-z0)*.875)
            elif direction == 'south': p = project(x0,y1,z1); a = ((x1-x0)*1.75,(x1-x0)*.875); b = (0,(y1-y0)*1.875)
            else: p = project(x1,y1,z1); a = ((z1-z0)*1.75,-(z1-z0)*.875); b = (0,(y1-y0)*1.875)
            ax,ay = a[0]/tex.width,a[1]/tex.width; bx,by = b[0]/tex.height,b[1]/tex.height; px,py = p; det = ax*by-ay*bx
            coeff = (by/det,-bx/det,(bx*py-by*px)/det,-ay/det,ax/det,(ay*px-ax*py)/det)
            image.alpha_composite(tex.transform((64,64), Image.Transform.AFFINE, coeff, Image.Resampling.NEAREST))
    path = out / (name + '.png'); image.save(path)
    manifest['assets'][name] = {'model': model_name, 'modelsSource': model_url, 'modelsSha256': hashlib.sha256(model_bytes).hexdigest(), 'textureSources': source_hashes, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'kind': 'Isometric render of the vanilla inventory model. Bridges use oak trapdoor artwork.'}
(out / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Imported {len(manifest["assets"])} verified game item images.')
