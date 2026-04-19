import sys
try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Installing PIL and numpy...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "numpy"])
    from PIL import Image
    import numpy as np

img_path = r"c:\Users\washi\Dropbox\作業用\kotodama-match\白蛇っち.jpg"
img = Image.open(img_path).convert('L')
w, h = img.size
print(f"Original size: {w}x{h}")

frame_w = w // 3
frames = []

for i in range(3):
    left = i * frame_w
    right = left + frame_w
    crop = img.crop((left, 0, right, h))
    
    # Generate bbox
    inv_crop = Image.eval(crop, lambda x: 255 - x)
    bbox = inv_crop.getbbox()
    if bbox:
        char_crop = crop.crop(bbox)
        c_w, c_h = char_crop.size
        # Add slight padding so it doesn't touch the borders
        sq_size = int(max(c_w, c_h) * 1.2)
        sq_img = Image.new('L', (sq_size, sq_size), 255)
        offset = ((sq_size - c_w) // 2, (sq_size - c_h) // 2)
        sq_img.paste(char_crop, offset)
        
        # Resize down
        res = sq_img.resize((24, 24), Image.Resampling.LANCZOS)
    else:
        res = Image.new('L', (24, 24), 255)
    
    # Enhance contrast and threshold better
    frames.append(res)

arrays = []
for f_idx, frame in enumerate(frames):
    pixels = list(frame.getdata())
    line_strs = []
    
    threshold = 200 # Since drawing has shading, err on capturing lines
    
    for y in range(24):
        line = ""
        for x in range(24):
            val = pixels[y * 24 + x]
            if val < threshold:
                line += "█"
            else:
                line += " "
        line_strs.append(f'"{line}"')
    
    array_str = "[\n    " + ",\n    ".join(line_strs) + "\n]"
    arrays.append(array_str)

print("\n// --- ANIMATION FRAMES (COPY TO index.html) ---")
print("childA: [\n" + ",\n\n".join(arrays) + "\n],")

