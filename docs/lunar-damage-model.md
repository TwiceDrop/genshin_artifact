# 月曜技能直伤

仅计算伤害所有者自己的面板，月感电／月结晶／月绽放基础系数分别为 3／1.6／1。独立倍率作用于本体分支，定额在其后加入；暴击、抗性和最后的擢升作用于整段伤害。

独立多人月感电／月结晶已删除，参见 [当前计算范围](direct-reactions-only-7108.md)。实现为 `beta-data/lunar-damage.mjs` 的 `calculateDirectLunarDamage`。
