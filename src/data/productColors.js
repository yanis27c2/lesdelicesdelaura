// Couleurs pastel d'origine de la version initiale pour chaque produit
export const INITIAL_COLORS_BY_ID = {
    'p1': '#fbe2e2',
    'p2': '#fef3c7',
    'p3': '#e0e7ff',
    'p4': '#ffedd5',
    'p5': '#fce7f3',
    'p6': '#fae8ff',
    'p7': '#ffedd5',
    'p8': '#f3e8ff',
    'p9': '#fef3c7',
    'p10': '#e0f2fe',
    'p11': '#e5e7eb',
    'p12': '#f3f4f6',
    'p13': '#dcfce7',
    'p14': '#ffedd5',
    'p15': '#fef08a',
    'p16': '#fee2e2',
    'p17': '#dcfce7',
    'p18': '#fef3c7',
    'p19': '#e0e7ff',
};

export const INITIAL_COLORS_BY_NAME = {
    'tartelette framboise': '#fbe2e2',
    'tartelette citron meringuee': '#fef3c7',
    'paris brest': '#e0e7ff',
    'paris-brest': '#e0e7ff',
    'saint honore': '#ffedd5',
    'saint honore 6/8': '#e5e7eb',
    'le delice de laura': '#fce7f3',
    'trois chocolats': '#fae8ff',
    'tarte pistache/framboise': '#ffedd5',
    'tarte pistache framboise': '#ffedd5',
    'tarte aux fruits': '#f3e8ff',
    'macarons xxl': '#f3f4f6',
    'fraisier': '#dcfce7',
    'cookies': '#fef08a',
    'macarons boite de 6': '#fee2e2',
    'macarons boite de 12': '#dcfce7',
    'biscuits lot de 8': '#fef3c7',
    'cake entier': '#e0e7ff',
};

const PASTEL_PALETTE = [
    '#fbe2e2', '#fef3c7', '#e0e7ff', '#ffedd5', '#fce7f3',
    '#fae8ff', '#e0f2fe', '#dcfce7', '#fef08a', '#fee2e2'
];

function cleanKey(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

export function getInitialColor(product) {
    if (!product) return '#fbe2e2';

    // 1. Recherche par ID direct
    const idKey = String(product.id || '').toLowerCase();
    if (INITIAL_COLORS_BY_ID[idKey]) {
        return INITIAL_COLORS_BY_ID[idKey];
    }

    // 2. Recherche par nom nettoyé
    const nameClean = cleanKey(product.name);
    if (nameClean) {
        if (INITIAL_COLORS_BY_NAME[nameClean]) {
            return INITIAL_COLORS_BY_NAME[nameClean];
        }
        for (const [k, col] of Object.entries(INITIAL_COLORS_BY_NAME)) {
            const cleanK = cleanKey(k);
            if (nameClean.includes(cleanK) || cleanK.includes(nameClean)) {
                return col;
            }
        }
    }

    // 3. Couleur personnalisée enregistrée (si ce n'est pas le rose par défaut écrasé)
    if (product.color && product.color !== '#fbcfe8') {
        return product.color;
    }

    // 4. Attribution déterministe depuis la palette pastel
    let hash = 0;
    const str = nameClean || idKey;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PASTEL_PALETTE[Math.abs(hash) % PASTEL_PALETTE.length];
}
