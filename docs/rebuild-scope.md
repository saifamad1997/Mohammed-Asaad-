# Mohammed Asaad — Unified Engineering & Manufacturing Workspace

## Product direction
One installable, responsive application for desktop and mobile. One URL, one sign-in, one shared project and data model. Modern Arabic RTL interface with professional CAD-style tools and command access.

## Main workflow
Customers → Projects → Survey & Measurements → CAD / 3D Design Office → Materials & Inventory → Manufacturing Orders → Production Tracking → Delivery → Reports & Accounts.

## Required workspaces
- Dashboard and company settings
- Customers and customer communication
- Projects, quotes, revisions, approvals and attachments
- Room surveys and measured site conditions
- CAD 2D: drawing canvas, layers, snaps, grids, dimensions, annotations, blocks, orthographic views, sections and export
- 3D modeling: parametric parts, assemblies, materials, component tree, explode/reassemble with stable transforms, measurement tools, camera/orbit and live dimension updates
- Furniture design: sofas, chairs, beds, wardrobes, kitchens, cabinets, doors, drawers and custom items
- Interior / architectural layouts
- Mechanical and metal fabrication design
- Materials, stock, suppliers, purchasing and stock movements
- Manufacturing orders separated by carpentry, metalwork and upholstery
- Production stages, quality checks, delivery and installation
- Costing, quotations, invoices, expenses, payroll and reports
- File management, version history, PDF/technical sheets and audit trail

## Engineering accuracy rules
- Store dimensions in millimetres as the canonical unit; display mm/cm.
- Every assembly component has its own stable ID, dimensions, transform, material and revision.
- Exploding an assembly must preserve component dimensions and original transforms; reassembly restores exact transforms.
- Dimension edits must update dependent geometry and calculated BOM/costs. Do not silently overwrite approved revisions.
- Distinguish reference/approximate model dimensions from verified manufacturing dimensions.
- Never present an unverified model as a certified manufacturing drawing.
- DWG/DXF import/export must be implemented and tested with explicit compatibility notes; do not claim full AutoCAD compatibility before validation.

## Existing Supabase project to preserve
Project ref: megcxclesylqggooayis (mohammad-asad-autocad, eu-central-1).
Existing tables: customers, projects, room_surveys, materials, work_orders, project_files.
RLS is enabled on all six. Current tables are empty and use owner_id linked to auth.users. Keep these security boundaries; do not make tables public. Extend schema through reviewed migrations rather than dropping/recreating the database.

## Reusable legacy material recovered from prior Vercel deployments
- archive/legacy/library-3d.html — prior 3D model library viewer and catalogue source.
- archive/legacy/library-polyhaven.html — prior Poly Haven model library page.
- archive/legacy/showroom-2026.html — prior furniture reference showroom.
These are preserved as source/reference material, not treated as a complete CAD editor. Check each asset's license and attribution requirements before redistributing or embedding it.

## Existing starter code
The feature/3d-engineering-office branch contains the Vite + Three.js application shell, Supabase browser client, sign-in gate, responsive styling and an early 3D prototype. Reuse selectively; replace prototype-only behavior as real modules are implemented.

## Release safety
Do not delete old Vercel projects, deployments, domains, source snapshots or Supabase resources until the new unified app is built, verified on phone and desktop, data access is tested, and the production domain is safely switched. Then clean up only confirmed redundant resources.
