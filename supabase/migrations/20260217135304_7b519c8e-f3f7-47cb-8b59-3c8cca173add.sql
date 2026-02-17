
-- Create storage bucket for exported documents
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', true);

-- RLS for exports bucket: users can manage their own files
CREATE POLICY "Users can upload exports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own exports"
ON storage.objects FOR SELECT
USING (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own exports"
ON storage.objects FOR DELETE
USING (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public can view exports (for sharing links)
CREATE POLICY "Public can view exports"
ON storage.objects FOR SELECT
USING (bucket_id = 'exports');
