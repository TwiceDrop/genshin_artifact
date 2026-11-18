-- 账号头像：所选角色的英文键名（如 Mona，对应 src/assets/_gen_character.js），未设置为 NULL；不保存图片。
ALTER TABLE users ADD COLUMN avatar text;
