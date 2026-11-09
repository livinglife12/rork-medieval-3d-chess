# Ashen rig validation

The imported pawn uses `ashen-rig.glb` with PARADO_ZUMB, Andando and
Correndo2 selected by name. Three.js loads 52 bones and two skinned material
primitives, and all three clips change bone rotations.

Measured world-space dimensions (metres, before chess-piece scaling):

| Pose | X | Y | Z |
| --- | --- | --- | --- |
| Export bind | 1.9085 | 1.9340 | 0.3089 |
| Zombie idle, 0.3 s | 0.8436 | 1.7705 | 0.5916 |
| Walk, 0.3 s | 0.5034 | 1.7325 | 1.0107 |
| Run, 0.3 s | 0.5065 | 1.8085 | 1.2932 |

## Verified in the game

- Ashen pawns render on the opening rank and remain upright and centred after
  moving from e2 to e4.
- Medium quality held approximately 26–30 FPS during the manual browser check.
- The browser console reported no application errors; the only message was a
  Direct3D shader precision warning from Three.js.
- `attachWeapons` finds the converted rig's right-hand bone and parents the
  undead spear to it; the resulting world transform contains finite values.
- A live two-player sequence (`e4 d5 exd5`) exercised the full 3D capture path.
  The imported pawn reached d5 upright and centred, the victim entered the
  captured tray, and the ledger recorded `exd5`.
- The capture sequence produced no browser console warnings or errors. Frame
  rate was about 24 FPS during the close-up and returned toward 30 FPS afterward.

## Root-coordinate handling

The first bone is mixamorigHips. Its local bind position is approximately
(0.1887, -0.8564, -106.0291), while the idle's first root position is
(-0.1795, -1.2878, -93.7753). These local coordinates differ from the
world-space Y-up convention used by the chess renderer. `PieceView` now removes
horizontal root travel in world coordinates while preserving animated height.
The imported pawn has been visually checked after a board move and a capture.
The spear attaches successfully, though its silhouette remains subtle at the
authored gameplay camera distance.
