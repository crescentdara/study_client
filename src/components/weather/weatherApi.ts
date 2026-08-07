export interface WeatherResult {
    location: string;
    detail: string;
    latitude: number;
    longitude: number;
    temperature: number;
    apparentTemperature: number;
    precipitation: number;
    precipitationProbability: number | null;
    windSpeed: number;
    weatherCode: number;
    weatherLabel: string;
    weatherIcon: string;
    observedAt: string;
    fetchedAt: number;
    hourly: WeatherHourlyForecast[];
    daily: WeatherDailyForecast[];
}

export interface WeatherHourlyForecast {
    time: string;
    temperature: number;
    precipitationProbability: number | null;
    weatherCode: number;
    weatherLabel: string;
    weatherIcon: string;
}

export interface WeatherDailyForecast {
    date: string;
    temperatureMax: number;
    temperatureMin: number;
    precipitationProbability: number | null;
    weatherCode: number;
    weatherLabel: string;
    weatherIcon: string;
}

interface GeocodingResult {
    name: string;
    latitude: number;
    longitude: number;
    admin1?: string;
    admin2?: string;
    country_code?: string;
}

interface GeocodingResponse {
    results?: GeocodingResult[];
}

interface ForecastResponse {
    current?: {
        time?: string;
        temperature_2m?: number;
        apparent_temperature?: number;
        weather_code?: number;
        precipitation?: number;
        wind_speed_10m?: number;
    };
    hourly?: {
        time?: string[];
        temperature_2m?: number[];
        precipitation_probability?: number[];
        weather_code?: number[];
    };
    daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
    };
}

const CACHE_PREFIX = 'study.weather.v2.';
const CACHE_TTL_MS = 15 * 60 * 1000;

const KNOWN_KOREAN_LOCATIONS: Record<string, GeocodingResult> = {
    서울: { name: '서울', latitude: 37.5665, longitude: 126.978, admin1: '서울특별시' },
    강남구: { name: '강남구', latitude: 37.5172, longitude: 127.0473, admin1: '서울특별시' },
    서울강남구: { name: '강남구', latitude: 37.5172, longitude: 127.0473, admin1: '서울특별시' },
    송파구: { name: '송파구', latitude: 37.5145, longitude: 127.1059, admin1: '서울특별시' },
    서울송파구: { name: '송파구', latitude: 37.5145, longitude: 127.1059, admin1: '서울특별시' },
    마포구: { name: '마포구', latitude: 37.5663, longitude: 126.9014, admin1: '서울특별시' },
    서울마포구: { name: '마포구', latitude: 37.5663, longitude: 126.9014, admin1: '서울특별시' },
    부산: { name: '부산', latitude: 35.1796, longitude: 129.0756, admin1: '부산광역시' },
    해운대구: { name: '해운대구', latitude: 35.1631, longitude: 129.1635, admin1: '부산광역시' },
    부산해운대구: { name: '해운대구', latitude: 35.1631, longitude: 129.1635, admin1: '부산광역시' },
    대구: { name: '대구', latitude: 35.8714, longitude: 128.6014, admin1: '대구광역시' },
    인천: { name: '인천', latitude: 37.4563, longitude: 126.7052, admin1: '인천광역시' },
    광주: { name: '광주', latitude: 35.1595, longitude: 126.8526, admin1: '광주광역시' },
    대전: { name: '대전', latitude: 36.3504, longitude: 127.3845, admin1: '대전광역시' },
    울산: { name: '울산', latitude: 35.5384, longitude: 129.3114, admin1: '울산광역시' },
    세종: { name: '세종', latitude: 36.48, longitude: 127.289, admin1: '세종특별자치시' },
    수원: { name: '수원', latitude: 37.2636, longitude: 127.0286, admin1: '경기도' },
    성남: { name: '성남', latitude: 37.4201, longitude: 127.1262, admin1: '경기도' },
    고양: { name: '고양', latitude: 37.6584, longitude: 126.832, admin1: '경기도' },
    용인: { name: '용인', latitude: 37.2411, longitude: 127.1776, admin1: '경기도' },
    부천: { name: '부천', latitude: 37.5034, longitude: 126.766, admin1: '경기도' },
    화성: { name: '화성', latitude: 37.1995, longitude: 126.8312, admin1: '경기도' },
    안양: { name: '안양', latitude: 37.3943, longitude: 126.9568, admin1: '경기도' },
    춘천: { name: '춘천', latitude: 37.8813, longitude: 127.7298, admin1: '강원특별자치도' },
    원주: { name: '원주', latitude: 37.3422, longitude: 127.9202, admin1: '강원특별자치도' },
    청주: { name: '청주', latitude: 36.6424, longitude: 127.489, admin1: '충청북도' },
    천안: { name: '천안', latitude: 36.8151, longitude: 127.1139, admin1: '충청남도' },
    전주: { name: '전주', latitude: 35.8242, longitude: 127.148, admin1: '전북특별자치도' },
    군산: { name: '군산', latitude: 35.9677, longitude: 126.7366, admin1: '전북특별자치도' },
    목포: { name: '목포', latitude: 34.8118, longitude: 126.3922, admin1: '전라남도' },
    여수: { name: '여수', latitude: 34.7604, longitude: 127.6622, admin1: '전라남도' },
    순천: { name: '순천', latitude: 34.9506, longitude: 127.4872, admin1: '전라남도' },
    포항: { name: '포항', latitude: 36.019, longitude: 129.3435, admin1: '경상북도' },
    구미: { name: '구미', latitude: 36.1195, longitude: 128.3446, admin1: '경상북도' },
    창원: { name: '창원', latitude: 35.228, longitude: 128.6811, admin1: '경상남도' },
    김해: { name: '김해', latitude: 35.2285, longitude: 128.8894, admin1: '경상남도' },
    진주: { name: '진주', latitude: 35.1799, longitude: 128.1076, admin1: '경상남도' },
    제주: { name: '제주', latitude: 33.4996, longitude: 126.5312, admin1: '제주특별자치도' },
    제주도: { name: '제주', latitude: 33.4996, longitude: 126.5312, admin1: '제주특별자치도' },
};

const weatherDescription = (code: number) => {
    if (code === 0) return { label: '맑음', icon: '☀️' };
    if (code === 1) return { label: '대체로 맑음', icon: '🌤️' };
    if (code === 2) return { label: '구름 조금', icon: '⛅' };
    if (code === 3) return { label: '흐림', icon: '☁️' };
    if (code === 45 || code === 48) return { label: '안개', icon: '🌫️' };
    if ([51, 53, 55, 56, 57].includes(code)) return { label: '이슬비', icon: '🌦️' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: '비', icon: '🌧️' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: '눈', icon: '🌨️' };
    if ([95, 96, 99].includes(code)) return { label: '뇌우', icon: '⛈️' };
    return { label: '날씨 정보', icon: '🌡️' };
};

const cacheKey = (location: string) => `${CACHE_PREFIX}${location.replace(/\s+/g, '').toLowerCase()}`;

const readCache = (location: string): WeatherResult | null => {
    try {
        const raw = localStorage.getItem(cacheKey(location));
        if (!raw) return null;
        const cached = JSON.parse(raw) as WeatherResult;
        if (
            !cached.fetchedAt
            || Date.now() - cached.fetchedAt > CACHE_TTL_MS
            || !Array.isArray(cached.hourly)
            || !Array.isArray(cached.daily)
        ) return null;
        return cached;
    } catch {
        return null;
    }
};

const writeCache = (location: string, result: WeatherResult) => {
    try {
        localStorage.setItem(cacheKey(location), JSON.stringify(result));
    } catch {
        // Weather still works when storage is unavailable or full.
    }
};

export const parseWeatherQuery = (query: string) => {
    const match = query.trim().match(/^(.+?)\s*날씨\s*$/);
    return match?.[1]?.trim() ?? '';
};

const findCurrentLocation = (signal: AbortSignal): Promise<GeocodingResult> => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
        reject(new Error('이 브라우저에서는 현재 위치를 사용할 수 없습니다.'));
        return;
    }
    const abort = () => reject(new DOMException('위치 검색이 취소되었습니다.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    navigator.geolocation.getCurrentPosition(
        (position) => {
            signal.removeEventListener('abort', abort);
            resolve({
                name: '내 동네',
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                admin1: '현재 기기 위치 기준',
            });
        },
        (error) => {
            signal.removeEventListener('abort', abort);
            if (error.code === error.PERMISSION_DENIED) {
                reject(new Error('동네 날씨를 보려면 위치 권한을 허용해주세요.'));
            } else {
                reject(new Error('현재 위치를 확인하지 못했습니다.'));
            }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
});

const findLocation = async (location: string, signal: AbortSignal): Promise<GeocodingResult> => {
    const compact = location.replace(/\s+/g, '');
    if (['내동네', '우리동네', '현재위치', '내위치'].includes(compact)) {
        return findCurrentLocation(signal);
    }
    const known = KNOWN_KOREAN_LOCATIONS[compact];
    if (known) return known;

    const locationParts = location.trim().split(/\s+/).filter(Boolean);
    const searchTerm = locationParts[locationParts.length - 1] ?? location;
    const searchCompact = searchTerm.replace(/\s+/g, '');
    const contextParts = locationParts.slice(0, -1);

    const params = new URLSearchParams({
        name: searchTerm,
        count: '20',
        language: 'ko',
        format: 'json',
        countryCode: 'KR',
    });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal });
    if (!response.ok) throw new Error('지역 검색 서버에 연결할 수 없습니다.');
    const data = await response.json() as GeocodingResponse;
    const administrativeNames = [`${searchCompact}시`, `${searchCompact}군`, `${searchCompact}구`];
    const score = (item: GeocodingResult) => {
        const name = item.name.replace(/\s+/g, '');
        const admin1 = item.admin1?.replace(/\s+/g, '') ?? '';
        const admin2 = item.admin2?.replace(/\s+/g, '') ?? '';
        let value = item.country_code === 'KR' ? 10 : 0;
        if (name === searchCompact) value += 40;
        if (administrativeNames.includes(name)) value += 100;
        if (admin1 === compact || admin2 === compact) value += 90;
        if (administrativeNames.includes(admin1) || administrativeNames.includes(admin2)) value += 80;
        for (const context of contextParts) {
            const normalized = context.replace(/\s+/g, '');
            if (admin1.includes(normalized) || admin2.includes(normalized) || name.includes(normalized)) value += 120;
        }
        return value;
    };
    const result = data.results
        ?.filter((item) => item.country_code === 'KR')
        .sort((left, right) => score(right) - score(left))[0]
        ?? data.results?.[0];
    if (!result) throw new Error(`“${location}” 지역을 찾을 수 없습니다.`);
    return result;
};

export async function fetchWeather(location: string, signal: AbortSignal): Promise<WeatherResult> {
    const cached = readCache(location);
    if (cached) return cached;

    const place = await findLocation(location, signal);
    const params = new URLSearchParams({
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        current: 'temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m',
        hourly: 'temperature_2m,precipitation_probability,weather_code',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        forecast_days: '7',
        timezone: 'auto',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
    if (!response.ok) throw new Error('날씨 서버에 연결할 수 없습니다.');
    const data = await response.json() as ForecastResponse;
    const current = data.current;
    if (!current || typeof current.temperature_2m !== 'number') {
        throw new Error('현재 날씨 정보를 불러오지 못했습니다.');
    }

    const weatherCode = current.weather_code ?? -1;
    const description = weatherDescription(weatherCode);
    const hourlyTimes = data.hourly?.time ?? [];
    const currentHour = current.time?.slice(0, 13) ?? '';
    let hourIndex = currentHour
        ? hourlyTimes.findIndex((time) => time.slice(0, 13) === currentHour)
        : -1;
    if (hourIndex < 0 && current.time) {
        hourIndex = hourlyTimes.findIndex((time) => time >= current.time!);
    }
    const precipitationProbability = hourIndex >= 0
        ? data.hourly?.precipitation_probability?.[hourIndex] ?? null
        : null;
    const firstForecastHour = hourIndex >= 0 ? hourIndex : 0;
    const hourly = hourlyTimes
        .slice(firstForecastHour, firstForecastHour + 12)
        .map((time, offset): WeatherHourlyForecast => {
            const index = firstForecastHour + offset;
            const code = data.hourly?.weather_code?.[index] ?? -1;
            const hourDescription = weatherDescription(code);
            return {
                time,
                temperature: data.hourly?.temperature_2m?.[index] ?? current.temperature_2m ?? 0,
                precipitationProbability: data.hourly?.precipitation_probability?.[index] ?? null,
                weatherCode: code,
                weatherLabel: hourDescription.label,
                weatherIcon: hourDescription.icon,
            };
        });
    const daily = (data.daily?.time ?? []).map((date, index): WeatherDailyForecast => {
        const code = data.daily?.weather_code?.[index] ?? -1;
        const dayDescription = weatherDescription(code);
        return {
            date,
            temperatureMax: data.daily?.temperature_2m_max?.[index] ?? 0,
            temperatureMin: data.daily?.temperature_2m_min?.[index] ?? 0,
            precipitationProbability: data.daily?.precipitation_probability_max?.[index] ?? null,
            weatherCode: code,
            weatherLabel: dayDescription.label,
            weatherIcon: dayDescription.icon,
        };
    });
    const detailParts = [place.admin1, place.admin2].filter((part, index, parts) => part && parts.indexOf(part) === index);
    const result: WeatherResult = {
        location: place.name,
        detail: detailParts.join(' · '),
        latitude: place.latitude,
        longitude: place.longitude,
        temperature: current.temperature_2m,
        apparentTemperature: current.apparent_temperature ?? current.temperature_2m,
        precipitation: current.precipitation ?? 0,
        precipitationProbability,
        windSpeed: current.wind_speed_10m ?? 0,
        weatherCode,
        weatherLabel: description.label,
        weatherIcon: description.icon,
        observedAt: current.time ?? '',
        fetchedAt: Date.now(),
        hourly,
        daily,
    };
    writeCache(location, result);
    return result;
}
