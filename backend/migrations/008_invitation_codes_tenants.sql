-- 008_invitation_codes_tenants.sql
-- KAN-404: 授权码增加 allowed_tenants 字段，支持 tenant 映射方式

ALTER TABLE invitation_codes ADD COLUMN allowed_tenants TEXT;
