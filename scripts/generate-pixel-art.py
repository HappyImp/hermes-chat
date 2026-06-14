#!/usr/bin/env python3
"""Generate pixel art sprites for the office scene.

Creates high-quality 32x32 pixel characters and office furniture.
Each sprite is rendered at 1:1 pixel scale for crisp pixel-art look.

Output: public/assets/office/*.png
"""

from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'office')
os.makedirs(OUT, exist_ok=True)

# ── Color palette ──────────────────────────────────────────────
T = None  # transparent
# Skin tones
SKIN = '#FFD4A3'; SKIN_S = '#E8B87A'; SKIN_H = '#D4A06A'
# Hair
HAIR = '#4A3728'; HAIR_H = '#6B5040'; HAIR_L = '#8B6B55'
# Shirt
SHIRT = '#4488CC'; SHIRT_S = '#336699'; SHIRT_H = '#5599DD'
# Pants
PANTS = '#334466'; PANTS_S = '#223355'; PANTS_H = '#445577'
# Shoes
SHOE = '#333333'; SHOE_H = '#444444'
# Desk
DESK = '#A88232'; DESK_S = '#8B6914'; DESK_D = '#6B4F0E'; DESK_T = '#C4A04A'
# Monitor
MON = '#2A2A2A'; MON_S = '#222222'; MON_R = '#333333'
SCREEN = '#33FF66'; SCREEN_D = '#228844'; SCREEN_B = '#44FF88'
# Chair
CHAIR = '#666666'; CHAIR_S = '#444444'; CHAIR_H = '#888888'; CHAIR_D = '#333333'
# Plant
LEAF = '#33AA44'; LEAF_D = '#228833'; LEAF_H = '#55CC66'; POT = '#BB6633'; POT_D = '#994422'
# Coffee
COFFEE = '#8B4513'; COFFEE_H = '#D2691E'
# Environment
WALL = '#8899AA'; WALL_D = '#667788'; WALL_H = '#99AABB'; WALL_L = '#AABBCC'
FLOOR = '#D4C4A8'; FLOOR_D = '#C4B498'; FLOOR_L = '#E4D4B8'
SKY = '#87CEEB'; SKY_H = '#AADDFF'
# Misc
WHITE = '#FFFFFF'; BLACK = '#000000'; OUTLINE = '#333333'


def create_image(w: int, h: int) -> Image.Image:
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def px(draw: ImageDraw.ImageDraw, x: int, y: int, c: str) -> None:
    """Draw a single pixel."""
    if c and c != T:
        draw.point((x, y), fill=c)


def rect(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, c: str) -> None:
    """Draw a filled rectangle."""
    if c and c != T:
        draw.rectangle([x, y, x + w - 1, y + h - 1], fill=c)


# ── Character sprite (32x32) ──────────────────────────────────

def draw_character_base(draw: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    """Draw the head + body base at offset."""
    # Hair (top)
    rect(draw, ox+11, oy+0, 10, 3, HAIR)
    rect(draw, ox+10, oy+1, 12, 4, HAIR)
    # Face
    rect(draw, ox+11, oy+5, 10, 8, SKIN)
    rect(draw, ox+10, oy+6, 12, 6, SKIN)
    # Hair sides
    rect(draw, ox+10, oy+5, 2, 4, HAIR)
    rect(draw, ox+20, oy+5, 2, 4, HAIR)
    # Eyes
    rect(draw, ox+13, oy+8, 2, 2, WHITE)
    rect(draw, ox+14, oy+9, 1, 1, BLACK)
    rect(draw, ox+17, oy+8, 2, 2, WHITE)
    rect(draw, ox+18, oy+9, 1, 1, BLACK)
    # Mouth
    rect(draw, ox+15, oy+11, 2, 1, SKIN_H)
    # Neck
    rect(draw, ox+14, oy+13, 4, 1, SKIN_S)


def draw_shirt(draw: ImageDraw.ImageDraw, ox: int, oy: int, arm_angle: int = 0) -> None:
    """Draw shirt torso. arm_angle: 0=down, 1=forward, 2=typing."""
    # Torso
    rect(draw, ox+11, oy+14, 10, 8, SHIRT)
    rect(draw, ox+10, oy+15, 12, 6, SHIRT)
    # Collar highlight
    rect(draw, ox+14, oy+14, 4, 1, SHIRT_H)
    # Shirt shadow
    rect(draw, ox+11, oy+20, 10, 2, SHIRT_S)

    if arm_angle == 0:
        # Arms down
        rect(draw, ox+8, oy+15, 3, 7, SHIRT)
        rect(draw, ox+21, oy+15, 3, 7, SHIRT)
        # Hands
        rect(draw, ox+8, oy+22, 3, 2, SKIN)
        rect(draw, ox+21, oy+22, 3, 2, SKIN)
    elif arm_angle == 1:
        # Arms forward (sitting idle)
        rect(draw, ox+8, oy+15, 3, 6, SHIRT)
        rect(draw, ox+21, oy+15, 3, 6, SHIRT)
        rect(draw, ox+7, oy+21, 3, 2, SKIN)
        rect(draw, ox+22, oy+21, 3, 2, SKIN)
    else:
        # Arms typing (forward + down more)
        rect(draw, ox+9, oy+15, 3, 5, SHIRT)
        rect(draw, ox+20, oy+15, 3, 5, SHIRT)
        rect(draw, ox+8, oy+20, 4, 2, SKIN)
        rect(draw, ox+20, oy+20, 4, 2, SKIN)


def draw_pants(draw: ImageDraw.ImageDraw, ox: int, oy: int, sitting: bool = False) -> None:
    """Draw pants/legs."""
    if sitting:
        # Legs bent forward
        rect(draw, ox+11, oy+22, 10, 4, PANTS)
        rect(draw, ox+10, oy+23, 12, 3, PANTS)
        rect(draw, ox+11, oy+26, 4, 4, PANTS)
        rect(draw, ox+17, oy+26, 4, 4, PANTS)
        # Pants highlight
        rect(draw, ox+14, oy+22, 4, 1, PANTS_H)
        # Shoes
        rect(draw, ox+10, oy+30, 5, 2, SHOE)
        rect(draw, ox+17, oy+30, 5, 2, SHOE)
    else:
        # Standing legs
        rect(draw, ox+11, oy+22, 10, 6, PANTS)
        rect(draw, ox+14, oy+22, 4, 1, PANTS_H)
        rect(draw, ox+11, oy+28, 4, 2, PANTS)
        rect(draw, ox+17, oy+28, 4, 2, PANTS)
        # Shoes
        rect(draw, ox+10, oy+30, 5, 2, SHOE)
        rect(draw, ox+17, oy+30, 5, 2, SHOE)


def gen_character_sitting() -> Image.Image:
    """Sitting idle character (32x32)."""
    img = create_image(32, 32)
    d = ImageDraw.Draw(img)
    draw_character_base(d, 0, 0)
    draw_shirt(d, 0, 0, arm_angle=1)
    draw_pants(d, 0, 0, sitting=True)
    return img


def gen_character_typing1() -> Image.Image:
    """Typing frame 1 - hands right (32x32)."""
    img = create_image(32, 32)
    d = ImageDraw.Draw(img)
    draw_character_base(d, 0, 0)
    draw_shirt(d, 0, 0, arm_angle=2)
    draw_pants(d, 0, 0, sitting=True)
    return img


def gen_character_typing2() -> Image.Image:
    """Typing frame 2 - hands left (shifted) (32x32)."""
    img = create_image(32, 32)
    d = ImageDraw.Draw(img)
    draw_character_base(d, 0, 0)
    draw_shirt(d, 0, 0, arm_angle=2)
    draw_pants(d, 0, 0, sitting=True)
    # Slight hand shift effect via darker shade on one side
    rect(d, 7, 20, 2, 2, SKIN_S)  # left hand shifted
    rect(d, 23, 20, 2, 2, SKIN)   # right hand normal
    return img


def gen_character_standing() -> Image.Image:
    """Standing character (32x32)."""
    img = create_image(32, 32)
    d = ImageDraw.Draw(img)
    draw_character_base(d, 0, 0)
    draw_shirt(d, 0, 0, arm_angle=0)
    draw_pants(d, 0, 0, sitting=False)
    return img


# ── Furniture sprites ─────────────────────────────────────────

def gen_desk() -> Image.Image:
    """Office desk with monitor (48x32)."""
    img = create_image(48, 32)
    d = ImageDraw.Draw(img)
    # Desktop surface
    rect(d, 0, 10, 48, 4, DESK_T)
    rect(d, 0, 14, 48, 2, DESK)
    rect(d, 0, 16, 48, 2, DESK_S)
    # Desk edge highlight
    rect(d, 0, 10, 48, 1, DESK_D)
    # Legs
    rect(d, 2, 18, 3, 12, DESK_D)
    rect(d, 43, 18, 3, 12, DESK_D)
    # Cross bar
    rect(d, 5, 26, 38, 2, DESK_D)
    # Monitor on desk
    rect(d, 15, 1, 18, 8, MON)
    rect(d, 16, 2, 16, 6, SCREEN)
    # Screen content (text lines)
    rect(d, 17, 3, 8, 1, SCREEN_D)
    rect(d, 17, 5, 12, 1, SCREEN_D)
    rect(d, 17, 6, 6, 1, SCREEN_D)
    # Monitor stand
    rect(d, 22, 9, 4, 1, MON_R)
    rect(d, 20, 9, 8, 1, MON_S)
    # Keyboard
    rect(d, 16, 12, 12, 3, MON_R)
    rect(d, 17, 13, 10, 1, '#555555')
    return img


def gen_chair() -> Image.Image:
    """Office chair (20x24)."""
    img = create_image(20, 24)
    d = ImageDraw.Draw(img)
    # Backrest
    rect(d, 4, 0, 12, 8, CHAIR)
    rect(d, 5, 1, 10, 6, CHAIR_H)
    rect(d, 6, 2, 8, 4, CHAIR)
    # Seat
    rect(d, 3, 8, 14, 4, CHAIR)
    rect(d, 4, 9, 12, 2, CHAIR_H)
    # Armrests
    rect(d, 1, 5, 3, 5, CHAIR_S)
    rect(d, 16, 5, 3, 5, CHAIR_S)
    # Pole
    rect(d, 9, 12, 2, 6, CHAIR_D)
    # Base
    rect(d, 4, 18, 12, 2, CHAIR_D)
    rect(d, 3, 20, 3, 2, CHAIR_D)
    rect(d, 14, 20, 3, 2, CHAIR_D)
    # Wheels
    rect(d, 2, 22, 3, 2, '#222222')
    rect(d, 15, 22, 3, 2, '#222222')
    return img


def gen_plant() -> Image.Image:
    """Potted plant (16x24)."""
    img = create_image(16, 24)
    d = ImageDraw.Draw(img)
    # Pot
    rect(d, 4, 16, 8, 6, POT)
    rect(d, 3, 16, 10, 2, POT)
    rect(d, 5, 22, 6, 2, POT_D)
    # Soil
    rect(d, 4, 16, 8, 1, '#6B4226')
    # Stem
    rect(d, 7, 8, 2, 8, LEAF_D)
    # Leaves
    rect(d, 3, 4, 4, 5, LEAF)
    rect(d, 9, 3, 4, 5, LEAF)
    rect(d, 5, 0, 6, 4, LEAF)
    # Leaf highlights
    rect(d, 4, 2, 2, 2, LEAF_H)
    rect(d, 10, 1, 2, 2, LEAF_H)
    rect(d, 6, 0, 2, 2, LEAF_H)
    # Leaf shadows
    rect(d, 3, 7, 3, 2, LEAF_D)
    rect(d, 10, 6, 3, 2, LEAF_D)
    return img


def gen_coffee() -> Image.Image:
    """Coffee cup (12x12)."""
    img = create_image(12, 12)
    d = ImageDraw.Draw(img)
    # Cup body
    rect(d, 2, 3, 8, 7, WHITE)
    rect(d, 3, 10, 6, 1, WHITE)
    # Coffee inside
    rect(d, 3, 4, 6, 5, COFFEE)
    rect(d, 3, 4, 6, 1, COFFEE_H)
    # Handle
    rect(d, 10, 5, 2, 1, WHITE)
    rect(d, 11, 5, 1, 4, WHITE)
    rect(d, 10, 8, 2, 1, WHITE)
    # Steam
    rect(d, 4, 0, 1, 2, '#DDDDDD')
    rect(d, 7, 1, 1, 2, '#DDDDDD')
    return img


def gen_monitor_standalone() -> Image.Image:
    """Standalone monitor sprite (20x18)."""
    img = create_image(20, 18)
    d = ImageDraw.Draw(img)
    rect(d, 0, 0, 20, 13, MON)
    rect(d, 1, 1, 18, 11, SCREEN)
    rect(d, 2, 2, 10, 1, SCREEN_D)
    rect(d, 2, 4, 14, 1, SCREEN_D)
    rect(d, 2, 6, 8, 1, SCREEN_D)
    rect(d, 2, 8, 12, 1, SCREEN_D)
    rect(d, 8, 13, 4, 1, MON_R)
    rect(d, 6, 14, 8, 1, MON_S)
    rect(d, 4, 15, 12, 2, MON_R)
    return img


# ── Environment tiles ─────────────────────────────────────────

def gen_wall_tile() -> Image.Image:
    """Wall tile 32x16."""
    img = create_image(32, 16)
    d = ImageDraw.Draw(img)
    rect(d, 0, 0, 32, 16, WALL)
    rect(d, 0, 0, 32, 2, WALL_H)
    rect(d, 0, 14, 32, 2, WALL_D)
    # Brick pattern
    for row in range(4):
        y = row * 4
        offset = 0 if row % 2 == 0 else 8
        for col in range(3):
            x = offset + col * 16
            rect(d, x, y, 16, 4, WALL)
            rect(d, x, y, 15, 3, WALL_L if row % 2 == 0 else WALL)
            rect(d, x + 15, y, 1, 4, WALL_D)
            rect(d, x, y + 3, 16, 1, WALL_D)
    return img


def gen_floor_tile() -> Image.Image:
    """Floor tile 16x16 with checkerboard."""
    img = create_image(16, 16)
    d = ImageDraw.Draw(img)
    rect(d, 0, 0, 16, 16, FLOOR)
    rect(d, 0, 0, 8, 8, FLOOR_L)
    rect(d, 8, 8, 8, 8, FLOOR_L)
    rect(d, 0, 0, 16, 1, FLOOR_D)
    rect(d, 0, 0, 1, 16, FLOOR_D)
    rect(d, 8, 0, 1, 16, FLOOR_D)
    rect(d, 0, 8, 16, 1, FLOOR_D)
    return img


def gen_window() -> Image.Image:
    """Window sprite 32x20."""
    img = create_image(32, 20)
    d = ImageDraw.Draw(img)
    rect(d, 0, 0, 32, 20, WALL_D)
    rect(d, 1, 1, 30, 18, SKY)
    rect(d, 1, 1, 30, 4, SKY_H)
    # Cross frame
    rect(d, 15, 1, 2, 18, WALL_D)
    rect(d, 1, 9, 30, 2, WALL_D)
    # Outer frame highlight
    rect(d, 0, 0, 32, 1, WALL_L)
    rect(d, 0, 0, 1, 20, WALL_L)
    return img


# ── Status indicators ─────────────────────────────────────────

def gen_status_dot(color: str) -> Image.Image:
    """Small status dot 8x8."""
    img = create_image(8, 8)
    d = ImageDraw.Draw(img)
    rect(d, 2, 0, 4, 1, color)
    rect(d, 1, 1, 6, 1, color)
    rect(d, 0, 2, 8, 4, color)
    rect(d, 1, 6, 6, 1, color)
    rect(d, 2, 7, 4, 1, color)
    # Highlight
    rect(d, 2, 1, 2, 2, '#FFFFFF')
    return img


# ── Generate all ──────────────────────────────────────────────

def save(img: Image.Image, name: str) -> None:
    path = os.path.join(OUT, name)
    img.save(path)
    print(f"  {name}: {img.size[0]}x{img.size[1]}")


def main():
    print("Generating pixel art assets...")
    print()

    # Characters
    print("[Characters]")
    save(gen_character_sitting(), 'char-sitting.png')
    save(gen_character_typing1(), 'char-typing1.png')
    save(gen_character_typing2(), 'char-typing2.png')
    save(gen_character_standing(), 'char-standing.png')

    # Furniture
    print("\n[Furniture]")
    save(gen_desk(), 'desk.png')
    save(gen_chair(), 'chair.png')
    save(gen_plant(), 'plant.png')
    save(gen_coffee(), 'coffee.png')
    save(gen_monitor_standalone(), 'monitor.png')

    # Environment
    print("\n[Environment]")
    save(gen_wall_tile(), 'wall-tile.png')
    save(gen_floor_tile(), 'floor-tile.png')
    save(gen_window(), 'window.png')

    # Status dots
    print("\n[Status]")
    save(gen_status_dot('#33FF66'), 'status-working.png')
    save(gen_status_dot('#FFD700'), 'status-standby.png')
    save(gen_status_dot('#888888'), 'status-off.png')

    # Create a spritesheet with all character frames (32x32 x 4 frames = 128x32)
    print("\n[Spritesheet]")
    sheet = Image.new('RGBA', (128, 32))
    for i, gen in enumerate([gen_character_sitting, gen_character_typing1,
                             gen_character_typing2, gen_character_standing]):
        frame = gen()
        sheet.paste(frame, (i * 32, 0))
    save(sheet, 'characters.png')

    print(f"\nDone! Assets saved to {OUT}")


if __name__ == '__main__':
    main()
