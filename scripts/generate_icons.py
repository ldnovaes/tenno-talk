"""Gera os ícones estáticos a partir de favicon.png (requer Python + Pillow).

Executar na raiz: python3 scripts/generate_icons.py
O original fica intacto; nenhuma dependência é adicionada ao frontend.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BACKGROUND = (11, 18, 28, 255)


def save_png(image: Image.Image, path: Path) -> None:
    # Paleta adaptativa preserva transparência e reduz o peso dos gradientes.
    image.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(
        path, optimize=True, compress_level=9
    )


def main() -> None:
    source = Image.open(ROOT / "favicon.png").convert("RGBA")
    # Ignora pixels quase invisíveis fora do desenho ao medir as margens.
    bounds = source.getchannel("A").point(lambda alpha: 255 if alpha > 8 else 0).getbbox()
    if bounds is None:
        raise ValueError("favicon.png não contém imagem visível")
    artwork = source.crop(bounds)
    side = max(artwork.size)
    padding = round(side * 0.04)
    square = Image.new("RGBA", (side + 2 * padding,) * 2)
    square.alpha_composite(
        artwork, ((square.width - artwork.width) // 2, (square.height - artwork.height) // 2)
    )

    def resized(size: int) -> Image.Image:
        return square.resize((size, size), Image.Resampling.LANCZOS)

    save_png(resized(32), PUBLIC / "favicon.png")
    frames = [
        resized(size).quantize(colors=256, method=Image.Quantize.FASTOCTREE)
        for size in (48, 32, 16)
    ]
    frames[0].save(
        PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=frames[1:]
    )
    for size in (192, 512):
        save_png(resized(size), PUBLIC / "icons" / f"icon-{size}.png")

    apple = Image.new("RGBA", (180, 180), BACKGROUND)
    apple.alpha_composite(resized(180))
    save_png(apple.convert("RGB"), PUBLIC / "icons" / "apple-touch-icon.png")

    # O quadrado central de 56% cabe inteiramente no círculo seguro de 80%.
    maskable = Image.new("RGBA", (512, 512), BACKGROUND)
    mark = resized(286)
    maskable.alpha_composite(mark, ((512 - mark.width) // 2, (512 - mark.height) // 2))
    save_png(maskable.convert("RGB"), PUBLIC / "icons" / "maskable-512.png")


if __name__ == "__main__":
    main()
