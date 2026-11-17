-- 用户名：全站唯一（不区分大小写），未设置为 NULL；以后可用于邮箱或用户名登录。
ALTER TABLE users ADD COLUMN username text;
CREATE UNIQUE INDEX users_username_unique ON users (lower(username));
