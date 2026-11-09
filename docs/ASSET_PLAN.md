# Faction asset plan

The next content pass should use assets with a license that can be redistributed
inside the static site. Prefer CC0 assets and keep a source/license note beside
every imported file.

## Approved starting sources

- [Poly Haven license](https://polyhaven.com/license) — models, textures and
  HDRIs are CC0. Use it for higher-resolution stone, snow, ice, metal and
  environment materials.
- [OpenGameArt fantasy weapons and apparel SFX](https://lpc.opengameart.org/content/fantasy-weapons-and-apparel-sfx-library)
  — CC0; useful for leather, sheath, boots and weapon movement layers.
- [OpenGameArt medieval weapon textures](https://opengameart.org/content/medieval-sound-effects-weapon-textures)
  — CC0; includes axe, spear, bow, sabre and crossbow sounds.
- [OpenGameArt sword attacks and clashes](https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes)
  — CC0; useful for melee attack and block variants.
- [OpenGameArt 3D Character Pack](https://opengameart.org/content/3d-character-pack)
  — CC0 rigged/animated humanoid pack; candidate source for replacing the
  fallback Ashen/Frostborn bodies after inspecting the archive's GLB/Blender
  structure and animation names.

Inspection note: the downloaded 2023 archive currently exposes nested FBX
archives rather than ready-to-load GLB files. It is therefore not shipped yet;
conversion and animation validation are required before it can replace the
existing loader-compatible roster.
- [OpenGameArt swishes pack](https://opengameart.org/content/swishes-sound-pack)
  — CC0; useful for spell, staff and projectile whooshes.

## Faction pass

| Faction | Attack identity | Asset direction |
| --- | --- | --- |
| Frostborn Clans | Ice burst, frost ring, crystalline claim chime | Snow/ice PBR from Poly Haven + axe and heavy impact SFX |
| Ashen Dead | Bone fracture, soul-fire collapse, low choir hit | CC0 stone/ash materials + layered impacts and swishes |
| Sun Empire | Jade/obsidian shatter, solar beam, glass ring | High-resolution obsidian/jade PBR + staff and blade layers |
| Grande Armée | Powder flash, recoil, smoke and metal report | Existing gun system + CC0 reload/metal texture layers |

## Integration rules

1. Download only from the linked source pages and record the exact asset URL.
2. Copy the license note into `web/public/assets/licenses/` beside imported files.
3. Optimize GLB files with Draco and textures with WebP before shipping.
4. Keep faction effects presentation-only; `chess.js` remains the rules authority.
5. Test Low/Medium/High/Ultra presets after every new asset batch.
