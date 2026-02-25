/**
 * 都市判定ユーティリティ
 * 
 * 政令指定都市および東京23区のJISコード範囲を定義し、
 * cityCode から都市を判定する関数を提供します。
 */

// 政令指定都市の定義（全20市）
export const DESIGNATED_CITIES = {
    '札幌市': { min: 1100, max: 1110, emoji: '🏙', prefCode: '01' },
    '仙台市': { min: 4101, max: 4105, emoji: '🏙', prefCode: '04' },
    'さいたま市': { min: 11101, max: 11110, emoji: '🏙', prefCode: '11' },
    '千葉市': { min: 12101, max: 12106, emoji: '🏙', prefCode: '12' },
    '横浜市': { min: 14101, max: 14118, emoji: '🏙', prefCode: '14' },
    '川崎市': { min: 14131, max: 14137, emoji: '🏙', prefCode: '14' },
    '相模原市': { min: 14150, max: 14152, emoji: '🏙', prefCode: '14' },
    '新潟市': { min: 15101, max: 15108, emoji: '🏙', prefCode: '15' },
    '静岡市': { min: 22101, max: 22103, emoji: '🏙', prefCode: '22' },
    '浜松市': { min: 22130, max: 22137, emoji: '🏙', prefCode: '22' },
    '名古屋市': { min: 23101, max: 23116, emoji: '🏙', prefCode: '23' },
    '京都市': { min: 26101, max: 26111, emoji: '🏙', prefCode: '26' },
    '大阪市': { min: 27102, max: 27128, emoji: '🏙', prefCode: '27' },
    '堺市': { min: 27141, max: 27147, emoji: '🏙', prefCode: '27' },
    '神戸市': { min: 28101, max: 28109, emoji: '🏙', prefCode: '28' },
    '岡山市': { min: 33101, max: 33104, emoji: '🏙', prefCode: '33' },
    '広島市': { min: 34101, max: 34108, emoji: '🏙', prefCode: '34' },
    '北九州市': { min: 40101, max: 40107, emoji: '🏙', prefCode: '40' },
    '福岡市': { min: 40131, max: 40137, emoji: '🏙', prefCode: '40' },
    '熊本市': { min: 43101, max: 43105, emoji: '🏙', prefCode: '43' }
} as const;

// 東京23区の定義
export const TOKYO_23_WARDS = {
    min: 13101,
    max: 13123,
    prefCode: '13'
};

export type CityAreaId =
    | 'tokyo23'
    | 'tokyo-tama'
    | 'sapporo'
    | 'sendai'
    | 'saitama'
    | 'chiba'
    | 'yokohama'
    | 'kawasaki'
    | 'sagamihara'
    | 'niigata'
    | 'shizuoka'
    | 'hamamatsu'
    | 'nagoya'
    | 'kyoto'
    | 'osaka'
    | 'sakai'
    | 'kobe'
    | 'okayama'
    | 'hiroshima'
    | 'kitakyushu'
    | 'fukuoka'
    | 'kumamoto'
    | 'other';

/**
 * cityCode から政令指定都市名を判定
 */
export const getDesignatedCity = (cityCode: string | undefined): string | null => {
    if (!cityCode) return null;
    const code = Number(cityCode);

    for (const [cityName, range] of Object.entries(DESIGNATED_CITIES)) {
        if (code >= range.min && code <= range.max) {
            return cityName;
        }
    }
    return null;
};

/**
 * cityCode が東京23区かどうかを判定
 */
export const isTokyoWard = (cityCode: string | undefined): boolean => {
    if (!cityCode) return false;
    const code = Number(cityCode);
    return code >= TOKYO_23_WARDS.min && code <= TOKYO_23_WARDS.max;
};

/**
 * cityAreaId から JIS コード範囲を取得
 */
export const getCityCodeRange = (cityAreaId: CityAreaId): [number, number] | null => {
    switch (cityAreaId) {
        case 'tokyo23':
            return [TOKYO_23_WARDS.min, TOKYO_23_WARDS.max];
        case 'tokyo-tama':
            // 多摩地域: 13201-13229 (市部)
            return [13201, 13229];
        case 'sapporo':
            return [DESIGNATED_CITIES['札幌市'].min, DESIGNATED_CITIES['札幌市'].max];
        case 'sendai':
            return [DESIGNATED_CITIES['仙台市'].min, DESIGNATED_CITIES['仙台市'].max];
        case 'saitama':
            return [DESIGNATED_CITIES['さいたま市'].min, DESIGNATED_CITIES['さいたま市'].max];
        case 'chiba':
            return [DESIGNATED_CITIES['千葉市'].min, DESIGNATED_CITIES['千葉市'].max];
        case 'yokohama':
            return [DESIGNATED_CITIES['横浜市'].min, DESIGNATED_CITIES['横浜市'].max];
        case 'kawasaki':
            return [DESIGNATED_CITIES['川崎市'].min, DESIGNATED_CITIES['川崎市'].max];
        case 'sagamihara':
            return [DESIGNATED_CITIES['相模原市'].min, DESIGNATED_CITIES['相模原市'].max];
        case 'niigata':
            return [DESIGNATED_CITIES['新潟市'].min, DESIGNATED_CITIES['新潟市'].max];
        case 'shizuoka':
            return [DESIGNATED_CITIES['静岡市'].min, DESIGNATED_CITIES['静岡市'].max];
        case 'hamamatsu':
            return [DESIGNATED_CITIES['浜松市'].min, DESIGNATED_CITIES['浜松市'].max];
        case 'nagoya':
            return [DESIGNATED_CITIES['名古屋市'].min, DESIGNATED_CITIES['名古屋市'].max];
        case 'kyoto':
            return [DESIGNATED_CITIES['京都市'].min, DESIGNATED_CITIES['京都市'].max];
        case 'osaka':
            return [DESIGNATED_CITIES['大阪市'].min, DESIGNATED_CITIES['大阪市'].max];
        case 'sakai':
            return [DESIGNATED_CITIES['堺市'].min, DESIGNATED_CITIES['堺市'].max];
        case 'kobe':
            return [DESIGNATED_CITIES['神戸市'].min, DESIGNATED_CITIES['神戸市'].max];
        case 'okayama':
            return [DESIGNATED_CITIES['岡山市'].min, DESIGNATED_CITIES['岡山市'].max];
        case 'hiroshima':
            return [DESIGNATED_CITIES['広島市'].min, DESIGNATED_CITIES['広島市'].max];
        case 'kitakyushu':
            return [DESIGNATED_CITIES['北九州市'].min, DESIGNATED_CITIES['北九州市'].max];
        case 'fukuoka':
            return [DESIGNATED_CITIES['福岡市'].min, DESIGNATED_CITIES['福岡市'].max];
        case 'kumamoto':
            return [DESIGNATED_CITIES['熊本市'].min, DESIGNATED_CITIES['熊本市'].max];
        default:
            return null;
    }
};

/**
 * 都道府県コードから、その県に存在する政令指定都市のリストを取得
 */
export const getDesignatedCitiesByPref = (prefCode: string): Array<{ id: CityAreaId; name: string; emoji: string }> => {
    const cities: Array<{ id: CityAreaId; name: string; emoji: string }> = [];

    // 東京都の特殊処理
    if (prefCode === '13') {
        cities.push({ id: 'tokyo23', name: '東京23区', emoji: '🏙' });
        cities.push({ id: 'tokyo-tama', name: '多摩・島嶼部', emoji: '🌳' });
        return cities;
    }

    // 各政令指定都市をチェック
    for (const [cityName, info] of Object.entries(DESIGNATED_CITIES)) {
        if (info.prefCode === prefCode) {
            const id = cityNameToId(cityName);
            cities.push({ id, name: cityName, emoji: info.emoji });
        }
    }

    return cities;
};

/**
 * 都市名から CityAreaId への変換
 */
function cityNameToId(cityName: string): CityAreaId {
    const mapping: Record<string, CityAreaId> = {
        '札幌市': 'sapporo',
        '仙台市': 'sendai',
        'さいたま市': 'saitama',
        '千葉市': 'chiba',
        '横浜市': 'yokohama',
        '川崎市': 'kawasaki',
        '相模原市': 'sagamihara',
        '新潟市': 'niigata',
        '静岡市': 'shizuoka',
        '浜松市': 'hamamatsu',
        '名古屋市': 'nagoya',
        '京都市': 'kyoto',
        '大阪市': 'osaka',
        '堺市': 'sakai',
        '神戸市': 'kobe',
        '岡山市': 'okayama',
        '広島市': 'hiroshima',
        '北九州市': 'kitakyushu',
        '福岡市': 'fukuoka',
        '熊本市': 'kumamoto'
    };
    return mapping[cityName] || 'other';
}

/**
 * cityCode が指定された cityAreaId の範囲内かどうかを判定
 */
export const isInCityArea = (cityCode: string | undefined, cityAreaId: CityAreaId): boolean => {
    if (!cityCode) return false;
    if (cityAreaId === 'other') return true; // 'other' は全てを含む

    const range = getCityCodeRange(cityAreaId);
    if (!range) return false;

    const code = Number(cityCode);
    return code >= range[0] && code <= range[1];
};
