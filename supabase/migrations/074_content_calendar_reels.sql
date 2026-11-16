-- Reels in de Content Calendar: mp4 toestaan in de privé-bucket, max 50 MB per bestand.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
    file_size_limit = 52428800
where id = 'content-calendar';
