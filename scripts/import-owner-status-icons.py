"""Import two approved PNGs unchanged; runtime128px art extends the existing registry."""
from pathlib import Path
from PIL import Image
from hashlib import sha256
import argparse,json
parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);args=parser.parse_args()
root=Path(__file__).resolve().parents[1];source=Path(args.source)
masterroot=root/'assets/brand/owner-status/master';runtimeroot=root/'public/brand/icons/owner-status'
masterroot.mkdir(parents=True,exist_ok=True);runtimeroot.mkdir(parents=True,exist_ok=True)
icons=[]
for key,filename in [('top-buddy','top buddy.png'),('favourites','favourites.png')]:
    data=(source/filename).read_bytes();master=masterroot/filename;runtime=runtimeroot/(key+'.png')
    if master.exists() and master.read_bytes()!=data:raise ValueError('Existing supplied master differs; do not overwrite approved artwork.')
    master.write_bytes(data)
    with Image.open(master) as image:
        if image.mode!='RGBA':raise ValueError('Approved artwork must preserve its alpha channel.')
        art=image.copy();art.thumbnail((128,128),Image.Resampling.LANCZOS)
        canvas=Image.new('RGBA',(128,128),(0,0,0,0));canvas.alpha_composite(art,((128-art.width)//2,(128-art.height)//2));canvas.save(runtime,optimize=True)
        dimensions=[image.width,image.height]
    icons.append(dict(key=key,master=master.relative_to(root).as_posix(),masterSha256=sha256(data).hexdigest(),masterDimensions=dimensions,src='/brand/icons/owner-status/'+key+'.png',runtimeSha256=sha256(runtime.read_bytes()).hexdigest(),runtimeDimensions=[128,128],runtimeBytes=runtime.stat().st_size))
(root/'lib/brand/owner-status-icons.manifest.json').write_text(json.dumps(dict(version=1,icons=icons),indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(imported=len(icons),runtimeBytes=sum(x['runtimeBytes'] for x in icons),masterDimensions=[x['masterDimensions'] for x in icons])))
