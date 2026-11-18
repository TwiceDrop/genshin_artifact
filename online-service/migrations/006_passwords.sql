-- 登录密码：scrypt 哈希（格式见 src/crypto.mjs 的 hashPassword），注册时必填；可为 NULL 只是为了不改动已有行。
ALTER TABLE users ADD COLUMN password_hash text;
