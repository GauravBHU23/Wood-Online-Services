-- ============================================================================
-- Storage buckets for admin-uploaded product/category images, replacing
-- wwwroot/uploads/{products,categories}/ from Services/ImageService.cs.
--
-- Public read (images are shown on public catalogue pages); writes are admin-only, enforced by
-- the same is_admin() helper the table policies use.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']),
  ('categories', 'categories', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'products');

create policy "product_images_admin_write" on storage.objects
  for insert with check (bucket_id = 'products' and public.is_admin());

create policy "product_images_admin_update" on storage.objects
  for update using (bucket_id = 'products' and public.is_admin());

create policy "product_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'products' and public.is_admin());

create policy "category_images_public_read" on storage.objects
  for select using (bucket_id = 'categories');

create policy "category_images_admin_write" on storage.objects
  for insert with check (bucket_id = 'categories' and public.is_admin());

create policy "category_images_admin_update" on storage.objects
  for update using (bucket_id = 'categories' and public.is_admin());

create policy "category_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'categories' and public.is_admin());
