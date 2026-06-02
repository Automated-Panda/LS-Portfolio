-- 0029_catalog_images_bucket.sql
-- Public Storage bucket for admin-uploaded catalog images. Reads are public
-- (CDN-served); writes happen only through the service-role admin action.
insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do nothing;
