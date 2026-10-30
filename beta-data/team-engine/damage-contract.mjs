// Model identity is independent of attack category, element and reaction tags.
// Only legacy hits without an explicit model use the original category routing.
export const damageModelId=event=>event.damageModel??(event.category==='equipment'?'equipment.physical':'native.skill');
