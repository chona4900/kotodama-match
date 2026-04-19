import os
from PIL import Image

def main():
    filename = "恵比寿っち.jpg"
    if not os.path.exists(filename):
        print(f"File not found: {filename}")
        return
        
    img = Image.open(filename)
    print(f"Original size: {img.size}")
    
    # 3 patterns horizontally. We need to crop one. Usually the first one is at the left, or the center one.
    # Let's crop the first one (leftmost).
    width = img.width // 3
    height = img.height
    
    # Assuming the sprite is placed horizontally, we crop the middle frame because it might look best.
    # Or let's crop the left one. We can save all 3 and decide, but let's just create an icon from the first pattern.
    left = 0
    top = 0
    right = width
    bottom = height
    
    cropped = img.crop((left, top, right, bottom))
    
    # Also we want an icon to be square.
    # Let's see the size of one pattern.
    print(f"Cropped size: {cropped.size}")
    
    # Let's make it square 1024x1024 with some padding if necessary, or just scaling if it's already square.
    # We will pad it with white or extract its background color (top-left pixel).
    bg_color = cropped.getpixel((0, 0))
    
    # Create 1024x1024 background
    icon = Image.new("RGB", (1024, 1024), bg_color)
    
    # Resize cropped image to fit within 1024x1024 while preserving aspect ratio
    # Add a little padding to the sides so it's not sticking to the edge
    target_h = int(1024 * 0.8)
    scale = target_h / cropped.height
    target_w = int(cropped.width * scale)
    
    resized_cropped = cropped.resize((target_w, target_h), Image.LANCZOS)
    
    # Paste into center
    paste_x = (1024 - target_w) // 2
    paste_y = (1024 - target_h) // 2
    icon.paste(resized_cropped, (paste_x, paste_y))
    
    icon.save("icon.png")
    
    # Similarly, generate a splash screen (2732x2732)
    splash = Image.new("RGB", (2732, 2732), bg_color)
    target_h_splash = int(2732 * 0.4) # Splash image could be smaller relative to screen
    scale_splash = target_h_splash / cropped.height
    target_w_splash = int(cropped.width * scale_splash)
    
    resized_splash = cropped.resize((target_w_splash, target_h_splash), Image.LANCZOS)
    paste_x_s = (2732 - target_w_splash) // 2
    paste_y_s = (2732 - target_h_splash) // 2
    splash.paste(resized_splash, (paste_x_s, paste_y_s))
    
    splash.save("splash.png")
    print("Created icon.png and splash.png")

if __name__ == '__main__':
    main()
