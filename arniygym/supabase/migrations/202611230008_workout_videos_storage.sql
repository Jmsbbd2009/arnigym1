-- Private Supabase Storage bucket for workout / diet videos.
-- Used when Cloudflare Stream keys are not configured. Uploads use short-lived signed upload URLs
-- issued by the admin-video-upload-url Edge Function (admin only); playback uses 15-minute signed URLs
-- issued by create-video-ticket (active subscription or admin). No client-side storage policies exist,
-- so anon/authenticated users can neither list nor read objects directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workout-videos', 'workout-videos', false, 52428800,
        array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
