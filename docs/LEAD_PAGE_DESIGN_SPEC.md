# Lead List page: design spec

Captured on 2026-11-24 from the computed styles and stylesheet rules of the live
reference page (Lead List). Every value below was read from the browser, not
estimated from screenshots. The reference is built on the INSPINIA admin
template (Bootstrap 3) with a custom lead-table stylesheet layered on top.

Do not copy the reference's CSS files or logo. Rebuild this look in our own
Tailwind components.

## Font

- **Open Sans**, weights 400 / 600 / 700 (load with `next/font/google`)
- Fallback: `"Helvetica Neue", Helvetica, Arial, sans-serif`
- Base: 13px, line-height 19.5px (1.5)

## Icons

Font Awesome 6 Free (solid, regular, brands). Lucide is close but not identical.
For an exact match, use `@fortawesome/fontawesome-free` 6.5.x or
`@fortawesome/react-fontawesome`.

| Where | Icon |
|---|---|
| Sidebar: Dashboard | `fa-tachometer` (FA6: `gauge-high`) |
| Products Purchase | `fa-cart-plus` |
| Stock | `fa-cubes` |
| Shipping | `fa-location-arrow` |
| Leads | `fa-users` |
| Orders | `fa-shopping-cart` |
| Return | `fa-reply` |
| Company | `fa-building` |
| Staff | `fa-user` |
| Premio / Delivery Company | `fa-truck` |
| Settings | `fa-cog` |
| Ticket | `fa-ticket` |
| Account | `fa-vault` |
| Download App | `fa-download` |
| Sidebar expand arrow | `fa.arrow` (chevron-left, rotates down when open) |
| Top bar | `fa-bars`, `fa-truck`, `fa-user`, `fa-bell`, `fa-sign-out`, `fa-tasks` |
| Lead List title toggle | `fas fa-qrcode fa-lg` |
| Row pin (col #) | `far fa-bookmark` |
| WhatsApp | `fab fa-whatsapp` |
| Call | `fa fa-phone` |
| Add order | `fa fa-cart-plus` |
| Return | `fa fa-reply` |
| Reject | `fa fa-ban` |
| Set reminder | inline SVG clock, 24×24 viewBox, `stroke: currentColor`, stroke-width 2.2, no fill (circle + hands path) |
| Note | `far fa-file` |

## Design tokens (copied as-is from the reference's CSS variables)

```css
--ll-accent:      #4b6373;
--ll-accent-dk:   #3e5260;
--ll-accent-soft: rgba(75, 99, 115, .10);
--ll-border:      #e3e7ec;
--ll-line:        #eef0f3;
--ll-text:        #3b4654;
--ll-muted:       #8a94a3;
--ll-radius:      10px;
--ll-shadow:      0 1px 2px rgba(16,24,40,.04), 0 2px 6px rgba(16,24,40,.05);
--ll-icon-bg:     rgba(255, 255, 255, .80);
```

### Lead status colors (row tint / row hover / 3px left stripe)

| Status | Row class | Tint | Hover | Stripe + legend dot |
|---|---|---|---|---|
| Pending | `act` | `rgba(134,142,150,.18)` | `rgba(134,142,150,.28)` | `#adb5bd` |
| Ok | `ok` | `rgba(47,179,68,.24)` | `rgba(47,179,68,.34)` | `#2fb344` |
| No Answer | `noans` | `rgba(250,204,21,.36)` | `rgba(250,204,21,.48)` | `#e6b800` |
| No Answer (2nd) | `noans2` | `rgba(251,146,60,.34)` | `rgba(251,146,60,.46)` | `#f97316` |
| Rejected | `reject` | `rgba(224,49,49,.22)` | `rgba(224,49,49,.32)` | `#e03131` |
| Deleted | `del` | `rgba(232,89,12,.12)` | `rgba(232,89,12,.20)` | `#f4a574` |
| Checked row | `:has(.chbox:checked)` | n/a | n/a | `--ll-accent` |

The whole row gets the tint. The first cell gets
`box-shadow: inset 3px 0 0 <stripe>`. A row with no status hovers to
`rgba(15,23,42,.03)`.

## Layout shell

### Sidebar
- Width: INSPINIA default (220px). Background `#e6e8eb` (the body color shows through)
- Header block: padding `20px 25px 13px`, bg `#e6e8eb`; logo image 130×29
- User name: 14px / 600, `#64676f`, capitalize
- Role ("ADMIN"): 10px / 500, `#8095a8`, uppercase, letter-spacing 0.7px
- Top-level item link: padding `14px 20px 14px 25px` (height 47.5px), 13px / 600, `#4b5973`; icon same color
- Hover: link bg `#c0c2c4`, text `#18273d`. `transition: all`
- Active (open) item `li.active`: bg `#d4d5d6`, `border-left: 4px solid #fa9a02` (orange), link text `#18273d`
- Submenu: bg `#d4d5d6`; links padding `10px 10px 10px 52px` (height 39.5px), 13px / 600, `#4b5973`; active sub-link `#18273d`

### Top bar
- Height 59.5px (about 60), bg `#48525e`
- Hamburger: `btn` with padding `4px 12px`, radius 3px, color `#ebeced`, transparent bg
- Search input: transparent, white text, 14px, placeholder `#c9c9c9`, placeholder text "Search Phone No / Name"
- Teal pill button ("Farda New"): bg `#23c6c8`, white, 12px, padding `3.2px 6.4px`, radius 3px, truck icon
- Right links (Profile, Log out): 13px / 600, `#ebeced`, padding `20px 10px`

### Page body
- `#page-wrapper`: bg `#ffffff`, padding `0 15px`; rows `py-2` (8px)

## Filter card (`.ibox`)
- Card: radius 10px, `box-shadow: var(--ll-shadow)`, no border
- Title bar: bg `#fff`, padding `15px 30px 8px 15px`, radius `10px 10px 0 0`, `border-bottom: 1px solid #eef0f3`
- Title "Lead List": h5, 15px / 700, `#2f3a46`, padding-right 8px
- QR toggle button: bg `#e6f0ff`, `1px solid #007bff`, color `#007bff`, radius 8px, padding `5px 9px`, height 31.5px
- Content: bg `#fff`, padding `14px 20px 6px`, radius `0 0 10px 10px`
- Labels (STATUS / USER / START DATE / END DATE): 11px / 700, `#8a94a3`, uppercase, letter-spacing 0.44px, padding `0 15px`
- Select / date inputs: height 36px, padding `6px 10px`, radius 8px, `1px solid #e3e7ec`, text `#3b4654` 13px, bg white
- Focus: `border-color: var(--ll-accent); box-shadow: 0 0 0 3px var(--ll-accent-soft)`
- Search button: bg `#4b6373`, white, 13px / 600, height 36px, padding `0 20px`, radius 8px, `box-shadow: 0 2px 6px rgba(75,99,115,.25)`

## Table card

### Legend bar (in the table card's title bar)
- Text: 12px / 600, `#8a94a3`
- Dots: 9×9, radius 50%, margin `0 2px 0 10px` (first one: `0 2px 0 0`)
- Dot colors: Pending `#adb5bd`, Ok `#2fb344`, No Answer `#e6b800`, Rejected `#e03131`, Deleted `#f4a574`

### Toolbar
- "Search:" label: 12px, `#8a94a3`
- Search input: 230×34, padding `4px 10px 4px 32px` (magnifier SVG as a background image on the left), radius 8px, `1px solid #e3e7ec`, 13px `#3b4654`
- Copy / CSV / Excel / PDF / Print buttons: bg white, `1px solid #e3e7ec`, color `#5c6774`, 12px / 600, padding `5px 12px`, radius 8px, height 30px
  - Hover: color / border `--ll-accent`, bg `--ll-accent-soft`
- "Showing 1 to N of N entries": 12px, `#8a94a3`
- "Select 25" pill: bg `#4b6373`, border `#4b6373`, white, 12px / 600, padding `5px 14px`, radius 20px, height 30px
- "Action ▾" pill: bg white, `1px solid #e3e7ec`, color `#1c3869`, 12px / 600, padding `0 14px`, radius 20px, height 30px
  - Hover / open: color / border `--ll-accent`, bg `--ll-accent-soft`

### Table
- `border-collapse: separate`
- Columns: `# | Lead No | Lead Date | Customer Name | Address | Contact No | Contact No 2 | Other | Product Code | Staff | Add Order | Action | Note`
- Header cell: bg `rgba(15,23,42,.035)`, 11px / 700, `#6b7785`, uppercase, letter-spacing 0.55px, padding `11px 10px`, `border-bottom: 1px solid #e3e7ec`
  - Sort icon: `::after`, opacity 0.2, color `#6b7785`; header hover color `--ll-accent`
- Body cell: padding `9px 10px`, 12.5px / 500, `#3b4654`, `border-bottom: 1px solid rgba(15,23,42,.07)`, `border-right: 1px solid rgba(15,23,42,.05)`
- Per column:
  - **#**: bookmark icon, 15px, `#b6bdc6`, padding 4px, radius 6px. Hover: `#1c84c6` on `rgba(28,132,198,.09)`
  - **Lead No**: 12.5px / 600, `#210c87`, `border-bottom: 1px dashed rgba(33,12,135,.35)`, no underline. Hover: `#4f2bd8`, solid-color border
  - **Lead Date**: 12px / 500, `#8a94a3`
  - **Customer Name**: 12.5px / 600, `#263241`
  - **Address / Other / Product Code / Staff**: 12.5px / 500, `#3b4654`
  - **Contact No / No 2**: 12.5px / 700, `#263241`, followed by two 24×24 round buttons:
    - WhatsApp: bg `rgba(37,211,102,.13)`, icon `#008000` 12px. Hover: bg `rgba(37,211,102,.25)`, `scale(1.1)`
    - Call: bg `rgba(0,123,255,.10)`, icon `#007bff` 12px. Hover: bg `rgba(0,123,255,.20)`, `scale(1.1)`
  - **Add Order**: four 28px square buttons: bg `rgba(255,255,255,.8)`, `1px solid rgba(15,23,42,.06)`, radius 8px, icon `#5c6774` 13px
    - Hover: bg `#fff`, `box-shadow: 0 2px 8px rgba(16,24,40,.14)`, `translateY(-1px)`; icon color by action: cart `#2fb344`, reply `#d97706`, ban `#e03131`, clock `#1c84c6`
  - **Action**: 16px checkbox, `accent-color: #4b6373`
  - **Note**: `far fa-file`, 15px, `#b6bdc6`, padding 4px, radius 6px. Hover: `--ll-accent` on `--ll-accent-soft`

## Still unconfirmed

- Exact sidebar width (assumed INSPINIA's 220px; not measured)
- Sort-arrow glyph (DataTables default image; not extracted)
- Dropdown menu contents and styling for "Action" (menu not opened)
- Collapsed-sidebar (mini navbar) state
