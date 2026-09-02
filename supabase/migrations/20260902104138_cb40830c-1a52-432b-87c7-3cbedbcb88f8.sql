CREATE POLICY "Users can read their own alex images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'alex-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar images are publicly readable"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'avatars');