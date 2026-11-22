// Face and torso centerline, measured from the left of the original portrait.
// Centered compositions use the image midpoint. Element variants share artwork.
const focusX = {
    Aether: 57, Lumine: 44,
    Aino: 59, Albedo: 54, Alhaitham: 47, Aloy: 48, Amber: 52,
    Arlecchino: 78, Baizhu: 54, Bennett: 55, Candace: 45,
    Charlotte: 68, Chasca: 65, Chevreuse: 75, Chiori: 67, Chongyun: 54,
    Citlali: 70, Clorinde: 80, Columbina: 70, Cyno: 55, Dahlia: 65,
    Dehya: 47, Diluc: 53, Diona: 53, Durin: 60, Emilie: 68,
    Escoffier: 68, Eula: 52, Fischl: 54, Flins: 31, Freminet: 71,
    Furina: 71, Gaming: 75, Gorou: 47, HuTao: 47, Iansan: 68, Ifa: 69,
    Illuga: 77, Ineffa: 58, Jahoda: 62, Kachina: 72, Kaeya: 55,
    KamisatoAyaka: 53, KamisatoAyato: 55, Kirara: 75, Kinich: 70,
    Klee: 46, KujouSara: 53, KukiShinobu: 57, Lanyan: 69, Lauma: 67,
    Linnea: 57, Lohen: 68, Lynette: 76, Lyney: 72, Mavuika: 73,
    Mika: 54, Mitya: 41, Mona: 54, Mualani: 74, Nahida: 46, Navia: 71,
    Nefer: 64, Neuvillette: 73, Nicole: 68, Odette: 66, Ororon: 67,
    Prune: 71, RaidenShogun: 58, Rosaria: 53, Sandrone: 67,
    Sethos: 74, Shenhe: 53, ShikanoinHeizou: 54, Sigewinne: 75, Skirk: 68,
    Thoma: 53, Tighnari: 54, Valeriy: 39, Varesa: 61, Varka: 64,
    Vesna: 42, Vodyanitsa: 68, Wriothesley: 69, Xiangling: 55, Xianyun: 70,
    Xilonen: 72, Xingqiu: 53, Yanfei: 46, Yaoyao: 55,
    YumemizukiMizuki: 63, Zibai: 72,
}

export function characterPortraitFocus(name) {
    const subject = name?.replace(/^(Aether|Lumine)(Anemo|Geo|Electro|Dendro|Hydro|Pyro|Cryo)$/, '$1')
    return focusX[subject] ?? 50
}
