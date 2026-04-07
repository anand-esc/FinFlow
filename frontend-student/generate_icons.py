from PIL import Image
import shutil
import sys

src = r"C:\Users\surya\.gemini\antigravity\brain\2c7dd769-9c49-471c-8f3e-f0ec40a34a43\sparc_logo_512_1775596006928.png"
dst_192 = r"d:\hackathon_project\frontend-student\public\pwa-192x192.png"
dst_512 = r"d:\hackathon_project\frontend-student\public\pwa-512x512.png"

try:
    with Image.open(src) as img:
        img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
        img_512.save(dst_512, "PNG")
        
        img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
        img_192.save(dst_192, "PNG")

    print("Icons generated successfully!")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
