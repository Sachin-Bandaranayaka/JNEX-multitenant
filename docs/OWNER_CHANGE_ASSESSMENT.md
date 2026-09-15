# Owner changes — delivery record

Updated: 2026-09-15

The owner's written requirements guided this implementation. The user waived the Genzo comparison and confirmed Royal Express is retired. Changes are in this workspace; no hosted deployment or git commit has been performed.

## Delivered functionality

| Area | Implemented behavior |
| --- | --- |
| Order details | Consistent business order numbers; both phones, address, product/quantity, saved pricing, discount, delivery fee, prepaid/COD, total, courier/tracking, lifecycle dates, returns, staff, and notes. Recorded events form a chronological timeline, also available in Search Orders. Future milestones are explicitly unrecorded. |
| Order editing | Pending and confirmed orders can be edited before booking/shipment, including customer, product, quantity, pricing, notes, and admin staff assignment. Pricing is validated; inventory reservations adjust transactionally. Concurrent changes and insufficient stock return conflicts. |
| Shipping | Ship, Shipped List, Shipped Summary, and Delivery sections, with shared filters and historical shipment inclusion. New Royal bookings/defaults/tracking sync are disabled; historical Royal shipments remain readable. |
| Invoice layouts | Full, half, quarter, and compact A4 layouts (1/2/4/8 per sheet). Saved sale amounts appear in invoices. Content is measured before a batch is created; records that exceed the layout require a larger format. Printed status still requires confirmation. |
| Stock | Table-based Stock List includes product management, CSV import, editing, deactivation, and movement history. The separate Products entry redirects to Stock List. Adjustment requests, approval summary, and waste pages are available. |
| Stock approval | Adjustment and waste requests do not change stock until a superadmin approves. Approval, movement, and audit entry are transactional; duplicate reviews and insufficient stock are rejected. Rejection leaves stock unchanged. |
| Billing | Simpler prepaid/postpaid overview and primary actions, with detailed activity expandable and filterable. Prepaid tenant admins see available/reserved credits in the dashboard header; postpaid admins see Billing. Loading and unavailable states are explicit. |
| Staff notifications | Permission-scoped pending leads, due reminders, and low-stock counts alongside notification history; staff see their assigned workload. |
| Audit | Admin audit page with actor/action/date filters and pagination. Order edits, status changes, CSV import, and stock request/review actions record actors and relevant changes. |
| Lead import | Unicode-safe UTF-8 and BOM-marked UTF-16 decoding preserves Sinhala. Invalid encodings are rejected. Admins select active tenant staff for round-robin assignment, with server-side validation. |
| Filters | Orders, search, leads, reminders, shipping sections, stock/history requests, returns, staff, billing, audit, and reports have applicable search/status/product/staff/courier/date/amount controls. Report/export queries share authorized filter definitions. |

## Database rollout

Applied to the configured database on 2026-09-15:

- `202609150001_stock_change_requests`: stock request table, indexes, and relationships.
- `202609150002_order_pricing`: nullable unit price, delivery fee, prepaid amount, and COD snapshot columns.

`prisma migrate status` reports the database is up to date. Direct read verification confirmed all four pricing columns and the stock request table are accessible. These are additive migrations; existing order history was not backfilled with guessed financial values. No real orders, stock, courier bookings, payments, or messages were created during QA.

## Verification

- Targeted regression suite: **186 passed**. The two opt-in database cases skipped in that run were then run separately against an isolated PostgreSQL database: **2 passed**.
- Database integration checks cover stock reservation changes, pricing/COD, overselling rollback, booked-order rejection, simultaneous stock reviews, and insufficient-stock rollback.
- Final TypeScript check, `git diff --check`, and the complete Next.js production build passed. The build ran in an isolated copy so the working app remained available.
- Authenticated original-app walkthrough verified order details/timeline, business-number search, saved totals, retained Royal history, audit filters, notifications, shipping sections, and import staff selection.
- Isolated browser checks submitted a synthetic Sinhala CSV and verified its rendered text; submitted a waste request as tenant admin and approved it as superadmin, with stock changing only on approval.
- Final print-media visual inspection verified readable sender/customer columns, Sinhala glyphs, barcodes, and monetary amounts. All 15 representative English/Sinhala cells fit their 1/2/4/8 layouts. A deliberately oversized Sinhala record was blocked before any print-batch POST; larger layouts are required when content does not fit.
- Actual PrintClient PDFs, using synthetic orders and mocked batch responses: 1 full / 2 half / 4 quarter / 8 compact invoices each produce exactly one A4 page; 9 compact produce exactly two. Preview controls and the hidden size checker do not print. No batch database writes were made.
- Local app restarted at `http://localhost:3000`; sign-in and health endpoints returned HTTP 200. Database connectivity/schema were checked separately because the health endpoint does not query the database.

## Scope and data limits

- The existing single-product-per-order model is retained. Product and quantity can be changed; this release does not introduce a multi-product shopping basket/order-item model.
- Invoice “bill types” are interpreted as the four A4 layouts. Thermal labels and additional accounting document types were not specified or added.
- Total is calculated as quantity × saved unit price − discount + customer delivery fee; COD is total − prepaid amount. Existing historical orders without snapshots explicitly lack those values. Historical catalog prices are not invented.
- Sinhala support covers valid Unicode CSV files. Previously corrupted text and legacy non-Unicode font encodings cannot be recovered automatically without the original file/encoding.
- Timelines show actual recorded lifecycle events. They do not invent packing timestamps or courier events that were never received.
- Stock request/history views disclose a latest-500-record limit. Filters on bounded client lists apply to the loaded records; server-backed shipping/report/export filters apply in their queries.
- Automated and browser checks are not a physical-printer test or a real courier/payment transaction. No hosted production deployment was requested.
- UI source review passed earlier rounds; later independent evaluation was limited by evaluator availability. The final invoice pass was checked directly in the browser.
