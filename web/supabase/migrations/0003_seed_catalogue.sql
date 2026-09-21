-- ============================================================================
-- Seed data — ported verbatim from Data/DbSeeder.cs (BuildCategories / BuildProducts)
-- ============================================================================

insert into public.categories (name, description, image_url, display_order, is_active) values
  ('Dining', 'Dining tables, chairs and benches - solid, well-made timber for the whole family.', '/img/cat-dining.svg', 1, true),
  ('Bedroom', 'Beds, side tables and dressing units, all in a solid wood finish.', '/img/cat-bedroom.svg', 2, true),
  ('Storage', 'Wardrobes, bookshelves and cabinets - what every home needs.', '/img/cat-storage.svg', 3, true),
  ('Living Room', 'Sofa sets, coffee tables, TV units and swings.', '/img/cat-living.svg', 4, true),
  ('Doors & Panels', 'Main doors, room doors and carved panels.', '/img/cat-doors.svg', 5, true),
  ('Custom Work', 'Furniture made to your own measurements and design.', '/img/cat-custom.svg', 6, true);

-- Products reference categories by name via a lateral lookup so this file has no hard-coded ids.
with cat as (select id, name from public.categories)
insert into public.products
  (name, category_id, wood_type, price, old_price, dimensions, stock_quantity, is_featured, is_custom_order, image_url, description)
select v.name, cat.id, v.wood_type, v.price, v.old_price, v.dimensions, v.stock_quantity, v.is_featured, v.is_custom_order, v.image_url, v.description
from (values
  -- ---- Dining ----
  ('6-Seater Dining Table', 'Dining', 'Sheesham', 32500, 38000, '72" x 36" x 30"', 4, true, false, '/uploads/products/dining-table-6-seater.svg',
    'A 6-seater dining table in solid Sheesham (Indian Rosewood), made entirely by hand and finished to show the natural grain. The timber is seasoned and termite treated, so it will not crack or warp; expect 25 years and more of daily use. The top is 25mm planking and the joints are cut mortise-and-tenon, not screwed or glued.'),
  ('4-Seater Dining Table', 'Dining', 'Teak', 24800, 28500, '48" x 30" x 30"', 6, false, false, '/uploads/products/dining-table-4-seater.svg',
    'A compact 4-seater teak dining table, sized for a smaller family or a flat. It takes less room without giving up any strength, and the golden teak finish keeps its warmth for years.'),
  ('Dining Chair — Classic', 'Dining', 'Sheesham', 4200, 4900, '18" x 18" x 38"', 24, true, false, '/uploads/products/dining-chair-classic.svg',
    'A classic dining chair with a comfortable back rest. The seat sits at the standard 18 inches, so it pairs with any dining table. Buying a set of six? Send an inquiry for a better price.'),
  ('Dining Chair — Spindle Back', 'Dining', 'Mango Wood', 3400, null, '17" x 17" x 36"', 18, false, false, '/uploads/products/dining-chair-spindle.svg',
    'A spindle-back chair in mango wood: light to move, but properly built. Traditional lines at a friendly price, and easy to live with day to day.'),

  -- ---- Bedroom ----
  ('King Size Bed', 'Bedroom', 'Sheesham', 46500, 54000, '78" x 72" x 40"', 3, true, false, '/uploads/products/bed-king-size.svg',
    'A king size bed in solid Sheesham with a carved headboard. Storage can be added underneath, either hydraulic lift or box style - mention it in your inquiry. The mattress is not included.'),
  ('Queen Size Bed', 'Bedroom', 'Teak', 38900, 44000, '78" x 60" x 40"', 4, false, false, '/uploads/products/bed-queen-size.svg',
    'A queen size teak bed with a clean, simple headboard. It suits a master bedroom or a guest room equally well. Choose your polish: natural, walnut or mahogany.'),
  ('Dressing Table with Mirror', 'Bedroom', 'Sheesham', 18700, 21500, '36" x 18" x 66"', 5, false, false, '/uploads/products/dressing-table.svg',
    'A dressing table with an oval mirror and two smooth-running drawers. The mirror has a bevelled edge and good quality silvering, so it will not cloud over with time.'),
  ('Dressing Mirror Unit', 'Bedroom', 'Teak', 15200, null, '32" x 16" x 62"', 4, false, false, '/uploads/products/dressing-mirror-unit.svg',
    'A compact dressing unit for a smaller bedroom, built on a teak frame with storage drawers. It can also be wall mounted if floor space is tight.'),

  -- ---- Storage ----
  ('2-Door Wardrobe', 'Storage', 'Teak', 42000, 48000, '48" x 22" x 78"', 3, true, false, '/uploads/products/wardrobe-2-door.svg',
    'A two-door teak wardrobe with a hanging rail, three shelves and a lockable drawer inside, finished with brass handles. We assemble it at your home.'),
  ('3-Door Wardrobe', 'Storage', 'Walnut Finish', 58500, 66000, '72" x 22" x 78"', 2, false, false, '/uploads/products/wardrobe-3-door.svg',
    'A three-door wardrobe for a larger family, with a full-length mirror on the centre door and a deep walnut finish. Inside there are two hanging sections and five shelves.'),
  ('5-Tier Bookshelf', 'Storage', 'Mango Wood', 12400, 14500, '32" x 12" x 72"', 8, false, false, '/uploads/products/bookshelf-5-tier.svg',
    'An open five-shelf bookcase for a study or living room. Each shelf carries up to 25kg, and an anti-tip wall bracket is included.'),
  ('Open Bookshelf — Compact', 'Storage', 'Pine', 7900, null, '24" x 11" x 54"', 10, false, false, '/uploads/products/bookshelf-open.svg',
    'A light pine bookshelf that fits a hostel room or sits neatly beside a small desk. Honest quality at a modest price.'),

  -- ---- Living Room ----
  ('3-Seater Sofa', 'Living Room', 'Sheesham', 44000, 51000, '78" x 32" x 34"', 3, true, false, '/uploads/products/sofa-3-seater.svg',
    'A three-seater sofa on a Sheesham frame with high-density foam cushions. Pick your fabric from twelve shades. The covers come off and can be washed.'),
  ('2-Seater Sofa', 'Living Room', 'Teak', 32000, 36500, '54" x 32" x 34"', 4, false, false, '/uploads/products/sofa-2-seater.svg',
    'A two-seater on a teak frame, sized for a smaller living room or balcony seating. Ask about the combined price if you take it with the three-seater.'),
  ('Oval Coffee Table', 'Living Room', 'Walnut Finish', 11800, 13500, '42" x 24" x 18"', 7, false, false, '/uploads/products/coffee-table-oval.svg',
    'An oval coffee table with rounded edges, which makes it safer around children, and a magazine shelf underneath. The walnut finish sits well with most sofas.'),
  ('Classic Coffee Table', 'Living Room', 'Sheesham', 9600, null, '36" x 20" x 18"', 9, false, false, '/uploads/products/coffee-table-classic.svg',
    'A plain, sturdy rectangular coffee table where the Sheesham grain shows clearly. The matte polish resists scratches from everyday use.'),
  ('Modern TV Unit', 'Living Room', 'Walnut Finish', 21500, 25000, '60" x 16" x 22"', 5, true, false, '/uploads/products/tv-unit-modern.svg',
    'A TV unit for screens up to 55 inches, with two soft-close cabinets and cable routing at the back. There is room for a set-top box and a games console.'),
  ('TV Cabinet — Traditional', 'Living Room', 'Mango Wood', 16800, null, '48" x 16" x 24"', 6, false, false, '/uploads/products/tv-cabinet.svg',
    'A traditional TV cabinet in mango wood with brass handles and storage drawers, in a warm tone that suits older furniture.'),
  ('Wooden Jhula (Swing)', 'Living Room', 'Teak', 28500, 33000, '60" x 24" x 22" (seat)', 3, true, false, '/uploads/products/jhula-swing.svg',
    'A teak swing for a courtyard or balcony, supplied with stainless steel chains and ceiling hooks. It holds up to 200kg, and we handle the installation.'),
  ('Classic Jhula — Carved', 'Living Room', 'Sheesham', 34500, null, '66" x 26" x 24" (seat)', 2, false, false, '/uploads/products/jhula-classic.svg',
    'A traditional swing with side panels carved by hand in a Rajasthani pattern. A piece for a sitting room or veranda.'),

  -- ---- Doors & Panels ----
  ('Carved Main Door', 'Doors & Panels', 'Teak', 38500, 45000, '36" x 84" (standard)', 2, true, false, '/uploads/products/main-door-carved.svg',
    'A carved teak main door supplied complete with its frame. It is made to your measurements, so please confirm the opening before ordering. Fittings - hinges, handle and lock - are separate.'),
  ('Plain Panel Door', 'Doors & Panels', 'Sheesham', 14200, null, '32" x 80" (standard)', 6, false, false, '/uploads/products/door-panel-plain.svg',
    'A simple panel door for rooms inside the house, in solid Sheesham with no plywood filling. A water-resistant polish is available for bathroom use.'),

  -- ---- Custom Work (quote-only) ----
  ('Wooden Mandir / Temple', 'Custom Work', 'Teak', 0, null, 'Made to your measurements', 0, true, true, '/uploads/products/mandir-temple.svg',
    'A teak home temple made by hand, with a dome, carved pillars and storage drawers. Size, design and the amount of carving are entirely your choice, and the price follows from them - send an inquiry and we will prepare a quotation.'),
  ('Wall-Mount Mandir', 'Custom Work', 'Sheesham', 0, null, 'Made to your measurements', 0, false, true, '/uploads/products/mandir-wall-mount.svg',
    'A wall-mounted temple for a flat or a smaller space. It takes almost no floor room while keeping the traditional look. Send us the measurements and we will share a design and price.'),
  ('Custom Study Table', 'Custom Work', 'Mango Wood', 13500, 15500, '48" x 24" x 30"', 5, false, false, '/uploads/products/study-table.svg',
    'A study table with three drawers, equally suited to a child''s homework or working from home. The size can be changed to fit your room, which may adjust the price.'),
  ('Office Desk', 'Custom Work', 'Walnut Finish', 19800, 23000, '54" x 26" x 30"', 4, false, false, '/uploads/products/office-desk.svg',
    'A large desk for an office or home office, with a drawer unit. A keyboard tray and cable holes can be added. Ask about the rate for five or more.')
) as v(name, cat_name, wood_type, price, old_price, dimensions, stock_quantity, is_featured, is_custom_order, image_url, description)
join cat on cat.name = v.cat_name;
