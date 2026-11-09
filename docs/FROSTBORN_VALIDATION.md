# Frostborn roster validation

The Frostborn Clans use six distinct CC0 Quaternius characters converted from
embedded glTF to GLB with skinning and all animations preserved.

| Rank | Shipped model | Source model | Attack clip |
| --- | --- | --- | --- |
| Jarl | frostborn-jarl.glb | Knight_Golden_Male.gltf | SwordSlash |
| Shieldmaiden | frostborn-shieldmaiden.glb | Knight_Golden_Female.gltf | SwordSlash |
| Seer | frostborn-seer.glb | Wizard.gltf | Shoot_OneHanded |
| Berserker | frostborn-berserker.glb | Viking_Male.gltf | SwordSlash |
| Huscarl | frostborn-huscarl.glb | Knight_Male.gltf | SwordSlash |
| Raider | frostborn-raider.glb | Viking_Female.gltf | SwordSlash |

Each GLB contains one skin and the required `Idle`, `Walk`, `Run`, attack, and
`Death` clips. The weapon matcher recognises the source rig's `FistR`/`FistL`
bones; the Raider's spear is verified as parented to `FistR`.

## Browser verification

- All six rank silhouettes rendered with their original material separation
  plus the restrained Frostborn tint.
- A local match sequence (`e4 d5 exd5`) exercised walking, the embedded sword
  attack, capture cleanup, square claim, and recovery.
- The Raider ended upright and centred on d5, and the ledger recorded `exd5`.
- The 3D view held approximately 31–34 FPS; tactical view held approximately
  60–62 FPS on the test machine at the auto-selected quality level.
- No application errors occurred. The console emitted one Direct3D shader
  precision warning from Three.js.

License and source details ship in
`web/public/assets/models/frostborn-roster-LICENSE.txt`.
