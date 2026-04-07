from PIL import Image, ImageDraw, ImageFont
import os

output_dir = r"d:\hackathon_project\demo_data"
os.makedirs(output_dir, exist_ok=True)

try:
    font_large = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 40)
    font_normal = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 30)
    font_small = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 20)
except:
    font_large = ImageFont.load_default()
    font_normal = ImageFont.load_default()
    font_small = ImageFont.load_default()

def create_mock_doc(filename, title, lines, bg_color=(255, 255, 255), width=800, height=500):
    img = Image.new('RGB', (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)
    
    # Draw simple border
    draw.rectangle([10, 10, width-10, height-10], outline=(200, 200, 200), width=4)
    
    # Title
    draw.text((30, 30), title, font=font_large, fill=(0, 0, 0))
    draw.line([(30, 80), (width-30, 80)], fill=(0,0,0), width=2)
    
    y = 110
    for line in lines:
        draw.text((30, y), line, font=font_normal, fill=(50, 50, 50))
        y += 50
        
    # Fake stamp/signature zone
    draw.rectangle([width-250, height-150, width-50, height-50], outline=(0, 100, 0), width=3)
    draw.text((width-220, height-105), "VERIFIED MOCK", font=font_small, fill=(0, 100, 0))
    
    path = os.path.join(output_dir, filename)
    img.save(path)
    print(f"Generated: {path}")

# 1. Aadhaar
create_mock_doc(
    "1_mock_aadhaar.png",
    "GOVERNMENT OF INDIA - AADHAAR",
    [
        "Name: Moumita Sen",
        "DOB: 14/05/2005",
        "Gender: Female",
        "",
        "Aadhaar Number:",
        "1234  5678  9012"
    ],
    bg_color=(245, 250, 255)
)

# 2. Utility Bill
create_mock_doc(
    "2_mock_utility_bill.png",
    "STATE ELECTRICITY BOARD - BILL",
    [
        "Bill Period: March 2026",
        "Consumer Name: Moumita Sen",
        "Address: 123 Tech Park, Bangalore",
        "",
        "Amount Due: 1,250 INR",
        "Payment Status: PAID",
        "History: 12 Months Consistent Payments"
    ],
    bg_color=(255, 253, 240)
)

# 3. PAN Card
create_mock_doc(
    "3_mock_pan.png",
    "INCOME TAX DEPARTMENT - PAN CARD",
    [
        "Name: Moumita Sen",
        "Father Name: ABC Sen",
        "DOB: 14/05/2005",
        "",
        "Permanent Account Number:",
        "ABCDE1234F"
    ],
    bg_color=(245, 245, 250)
)

# 4. Admission Letter
create_mock_doc(
    "4_mock_admission_letter.png",
    "UNIVERSITY ADMISSION LETTER",
    [
        "University Name: SPARC Institute of Tech",
        "Date: 10 August 2026",
        "Student: Moumita Sen",
        "Course: B.Tech Computer Science",
        "",
        "Annual Course Fee: 250,000 INR",
        "Status: ADMITTED - ENROLLMENT CONFIRMED"
    ],
    bg_color=(255, 255, 255),
    height=600
)

print("All demo data created successfully in d:\\hackathon_project\\demo_data")
