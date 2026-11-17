-- 用户名：显示名，可以重名，未设置为 NULL；登录仍用邮箱。
ALTER TABLE users ADD COLUMN username text;
