# Embedded CAD Engine Integration — Decision Record

## Product decision
The company system will host its own embedded CAD workspace. Users stay inside the existing Arabic application; no external viewer or second application is required.

## Candidate geometry kernel
Open CASCADE Technology (OCCT) through OpenCascade.js/WebAssembly is the leading candidate because OCCT provides boundary-representation solid modeling, geometry operations, visualization and CAD data exchange. OpenCascade.js documents browser/WebAssembly execution and a GLB visualization/export path.

References:
- https://ocjs.org/docs/about
- https://ocjs.org/docs/getting-started/hello-world
- https://github.com/Open-Cascade-SAS/OCCT

## Licensing gate
OCCT is LGPL-2.1 with the Open CASCADE exception, not public-domain software. Before shipping its WebAssembly binary, include the required license notices and source/replaceability materials, and review the distribution method against LGPL section 6. Do not describe the whole company application as license-free merely because the kernel has no per-seat fee.

## Architecture
1. Keep the current business application, authentication, Supabase data and navigation.
2. Add a lazy-loaded CAD engine module so the large WASM payload is fetched only when the user opens the CAD workspace.
3. Keep a renderer/viewer separate from the geometry kernel. The kernel owns exact B-Rep solids; the renderer displays triangulated results.
4. Define a versioned, parametric furniture model schema in millimetres. Each part must carry stable ID, role, material specification, dimensions, placement, orientation, manufacturing features and dependencies.
5. Generate 3D solids, orthographic views, dimensions, section views and BOM/cut-list from the same parametric model data.
6. Do not infer manufacturing dimensions from the existing Three.js concept meshes. Existing models remain visual references until rebuilt as parametric parts.
7. Gate manufacturing exports behind validation for joints, holes, clearances, material thickness, grain direction, upholstery allowances, fasteners and assembly constraints.

## Proof-of-concept acceptance tests
- WASM loads inside the Vite/Vercel build and is served from the application's own origin.
- Create a box and a boolean-cut test solid in OCCT; validate its bounds and volume through kernel APIs.
- Export a GLB from OCCT and display it in the embedded viewport with orbit, pan, zoom and fit-to-model.
- Verify a 2,200 × 900 × 850 mm parametric test assembly updates the kernel geometry and all readouts when dimensions change.
- Test a real browser session on desktop and mobile; record WASM download size, load time and memory use.
- No production alias is changed until all acceptance tests pass.

## Explicit non-goals for the first integration
- Do not call a generic box-based sofa model manufacturing-ready.
- Do not enable final cut-list, DXF or shop-order approval until the parametric furniture schema and manufacturing rules are validated.
- Do not remove the existing 2D tools or current 3D workspace until the new engine is proven and migration is planned.
