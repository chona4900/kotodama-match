from PIL import Image
import os

files = ['八大龍王っち.jpg', '天之御中主神っち.jpg']
for f in files:
    try:
        img = Image.open(f)
        print(f"{f}: {img.size}")
    except Exception as e:
        print(f"{f}: ERROR {e}")
