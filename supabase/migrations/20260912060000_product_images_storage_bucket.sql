-- =============================================================================
-- Storage bucket for product/brand/category images.
--
-- frontend/src/lib/upload-image.ts uploads to a bucket named 'product-images'
-- via the browser (anon-key client, using the logged-in admin's session) and
-- reads images back with getPublicUrl() — this bucket never existed.
--
-- Public read (storefront needs to display images to everyone); writes
-- restricted to super_admin, matching every other admin-only policy in this
-- schema.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public             = TRUE,
      file_size_limit    = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

DROP POLICY IF EXISTS "public_read_product_images"   ON storage.objects;
DROP POLICY IF EXISTS "admin_insert_product_images"  ON storage.objects;
DROP POLICY IF EXISTS "admin_update_product_images"  ON storage.objects;
DROP POLICY IF EXISTS "admin_delete_product_images"  ON storage.objects;

CREATE POLICY "public_read_product_images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "admin_insert_product_images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "admin_update_product_images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "admin_delete_product_images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
