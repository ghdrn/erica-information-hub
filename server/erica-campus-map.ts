// Building numbers transcribed from the ERICA admissions office campus map.
export const ERICA_CAMPUS_MAP_URL = "https://goerica.hanyang.ac.kr/upload/BBS0061/2026022414004179BPHA.PDF#page=24";

export interface CampusBuilding {
  number: string;
  name: string;
  aliases?: string[];
}

export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  { number: "101", name: "본관" },
  { number: "102", name: "학생복지관" },
  { number: "103", name: "학생회관" },
  { number: "104", name: "제2공학관" },
  { number: "105", name: "건축디자인관" },
  { number: "106", name: "초대형구조실험동" },
  { number: "107", name: "풍환경실험관" },
  { number: "108", name: "수리실험동" },
  { number: "109", name: "디자인문화관" },
  { number: "110", name: "디자인교육관" },
  { number: "111", name: "디자인연구관" },
  { number: "112", name: "스마트건축관" },
  { number: "201", name: "경상관" },
  { number: "202", name: "글로벌문화통상관", aliases: ["국제문화관"] },
  { number: "203", name: "사회교육관/학군단", aliases: ["사회교육관", "학군단"] },
  { number: "204", name: "언론정보관" },
  { number: "205", name: "제1과학기술관" },
  { number: "206", name: "컨퍼런스홀", aliases: ["콘퍼런스홀"] },
  { number: "207", name: "제2과학기술관" },
  { number: "208", name: "한양맞춤의약연구원" },
  { number: "209", name: "제1학술관" },
  { number: "301", name: "제1공학관" },
  { number: "302", name: "폐수처리장관리동" },
  { number: "303", name: "제3공학관" },
  { number: "304", name: "제4공학관" },
  { number: "305", name: "제5공학관" },
  { number: "306", name: "버스승강장", aliases: ["셔틀콕"] },
  { number: "307", name: "ERICA컨벤션센터", aliases: ["ERICA 컨벤션센터"] },
  { number: "308", name: "창업보육센터" },
  { number: "309", name: "약학관" },
  { number: "310", name: "동물실험동" },
  { number: "311", name: "학연산클러스터지원센터", aliases: ["학연산클러스터"] },
  { number: "312", name: "산학연협력실" },
  { number: "313", name: "포장가속실험동" },
  { number: "314", name: "퓨전전기기술응용연구센터" },
  { number: "315", name: "BMR센터" },
  { number: "316", name: "Lion's Hall", aliases: ["라이언스홀", "라이온스홀"] },
  { number: "317", name: "융합교육관" },
  { number: "401", name: "학술정보관", aliases: ["도서관", "ERICA도서관"] },
  { number: "402", name: "체육관" },
  { number: "403", name: "실용음악관" },
  { number: "404", name: "대운동장" },
  { number: "405", name: "테니스장" },
  { number: "501", name: "창의관" },
  { number: "502", name: "인재관" },
  { number: "503", name: "행복관" },
  { number: "504", name: "창의인재원 교육관" },
  { number: "C01", name: "경기테크노파크" },
  { number: "C02", name: "한국산업기술시험원" },
  { number: "C03", name: "한국생산기술연구원" },
  { number: "C04", name: "한국전기연구원" },
  { number: "C05", name: "LG이노텍 안산 R&D연구소", aliases: ["LG이노텍 안산 연구소"] },
];

function compact(value: string): string {
  return value.toLowerCase().replace(/[\s\-_'"’/·&()]/g, "");
}

function buildingNames(building: CampusBuilding): string[] {
  const names = [building.name, ...(building.aliases || [])];
  if (/^제\d/.test(building.name)) names.push(building.name.slice(1));
  return names;
}

export function lookupCampusBuilding(query: string): CampusBuilding | null {
  const normalized = compact(query);
  const matches = CAMPUS_BUILDINGS.flatMap((building) =>
    buildingNames(building).map((name) => ({ building, name: compact(name) }))
  ).filter(({ name }) => name.length >= 2 && normalized.includes(name));
  matches.sort((a, b) => b.name.length - a.name.length);
  if (matches[0]) return matches[0].building;

  const numberMatch = query.match(/\b(C\d{2}|\d{3})\s*번?(?!\s*호)/i);
  if (numberMatch && /(건물|몇\s*번|뭐|어디)/.test(query)) {
    return CAMPUS_BUILDINGS.find((building) => building.number === numberMatch[1].toUpperCase()) || null;
  }
  return null;
}

export function isBuildingMapQuestion(query: string): boolean {
  const normalized = compact(query);
  if (/(전화번호|연락처|문의번호|학번|호실|강의실번호|\d+호)/.test(normalized)) return false;
  return /(건물번호|건물코드|몇번|번호|위치|어디|찾아가|가는법)/.test(normalized) ||
    /(?:건물\s*(?:번호|코드)\s*)?(?:C\d{2}|\d{3})\s*번?\s*건물/i.test(query);
}
