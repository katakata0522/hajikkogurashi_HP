import os, glob, re
from PIL import Image

dir = 'assets/images/'
images = glob.glob(dir + '*.jpg') + glob.glob(dir + '*.png')
for img in images:
    out = os.path.splitext(img)[0] + '.webp'
    Image.open(img).save(out, 'webp')
    print('Converted', img)

files = glob.glob('*.html') + glob.glob('assets/css/*.css') + glob.glob('assets/js/*.js')
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        c = file.read()
    c = re.sub(r'(assets/images/[a-zA-Z0-9_-]+)\.(jpg|png)', r'\1.webp', c)
    with open(f, 'w', encoding='utf-8') as file:
        file.write(c)
print('Updated files')
