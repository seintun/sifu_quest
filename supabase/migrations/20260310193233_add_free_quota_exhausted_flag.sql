-- Add free_quota_exhausted boolean to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN free_quota_exhausted BOOLEAN DEFAULT false;
