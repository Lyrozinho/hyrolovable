CREATE POLICY "Authenticated users can read upgrade files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'upgrade-files');

CREATE POLICY "Authenticated users can upload upgrade files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'upgrade-files');

CREATE POLICY "Authenticated users can update upgrade files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'upgrade-files')
WITH CHECK (bucket_id = 'upgrade-files');

CREATE POLICY "Authenticated users can delete upgrade files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'upgrade-files');