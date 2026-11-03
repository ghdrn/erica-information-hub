import * as ollamaService from "./ollama-service";
import { ERICA_CAMPUS_MAP_URL, isBuildingMapQuestion, lookupCampusBuilding } from "./erica-campus-map";

export interface EricaBlogSource {
  title: string;
  url: string;
  snippet: string;
  content: string;
  score: number;
  publishedAt?: string;
}

export interface EricaStudentProfile {
  campus: "ERICA";
  college: string;
  department: string;
}

const BLOG_ID = "hyerica4473";
const BLOG_HOME = "https://blog.naver.com/hyerica4473";
const HANYANG_HOME = "https://www.hanyang.ac.kr";
const MODULE_INDEX_URL = "https://module.hanyang.ac.kr/front/hymdMdModule";
const MIN_RELEVANT_SCORE = 0.25;
const ERICA_OFFICIAL_INSTAGRAM_URL = "https://www.instagram.com/hanyang_erica/";
const STUDENT_COUNCIL_INSTAGRAM_URL = "https://www.instagram.com/hanyang_erica_stu/";
const STUDENT_COUNCIL_PARTNERSHIP_INSTAGRAM_URL = "https://www.instagram.com/hanyang_erica_stu_partnership/";
const STUDENT_COUNCIL_LINKTREE_URL = "https://linktr.ee/ericaact26";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || process.env.LLAMA_MODEL || "qwen2.5:7b-instruct-q4_K_M";

type QueryTopic =
  | "academic"
  | "scholarship"
  | "administration"
  | "military"
  | "dormitory"
  | "international"
  | "career"
  | "place"
  | "campus_life"
  | "transportation"
  | "university_event"
  | "student_council_event"
  | "general_discovery"
  | "general";

type QueryIntent = "verify" | "action" | "explore" | "discover";
type SourceKind = "official" | "blog" | "officialInstagram" | "studentCouncil";

interface QueryRoute {
  topic: QueryTopic;
  intent: QueryIntent;
  priority: SourceKind[];
}

const PROFILE_COLLEGE_KEYWORDS: Record<string, string[]> = {
  "공학대학": ["공학대학", "ieng.hanyang.ac.kr"],
  "소프트웨어융합대학": ["소프트웨어융합대학", "소융대", "sw", "software"],
  "첨단융합대학": ["첨단융합대학"],
  "약학대학": ["약학대학", "약학과"],
  "글로벌문화통상대학": ["글로벌문화통상대학", "lan-cul.hanyang.ac.kr"],
  "커뮤니케이션&컬처대학": ["커뮤니케이션", "컬처", "커뮤니케이션&컬처", "ccss.hanyang.ac.kr"],
  "경상대학": ["경상대학", "경제학부", "경영학부", "ibus.hanyang.ac.kr"],
  "디자인대학": ["디자인대학", "디자인"],
  "예체능대학": ["예체능대학", "스포츠", "무용", "실용음악"],
  "LIONS칼리지": ["LIONS", "라이언스", "자율전공"],
};

const STUDENT_COUNCIL_KEYWORDS = [
  "총학생회",
  "학생회",
  "축제",
  "행사",
  "부스",
  "라인업",
  "간식",
  "간식사업",
  "복지사업",
  "제휴사업",
  "문화사업",
  "사업문의",
  "시험기간",
  "이벤트",
  "제휴",
  "공동구매",
  "학생총회",
  "선거",
  "공약",
  "환급",
  "대동제",
  "동아리",
  "굿즈",
  "응시료",
  "장학",
  "법률",
  "상담",
  "학생요구",
  "학생회비",
  "환불",
  "납부",
  "회의록",
  "회칙",
  "복지몰",
  "한양문화제",
  "추석귀향버스",
  "귀향버스",
  "귀성버스",
  "추석버스",
  "주차장유료화",
  "주차유료화",
  "주차장",
  "주차요금",
  "주차비",
];

const STUDENT_COUNCIL_SOURCE: EricaBlogSource = {
  title: "한양대학교 ERICA 총학생회 공식 인스타그램",
  url: STUDENT_COUNCIL_INSTAGRAM_URL,
  snippet: "총학생회 주관 행사, 이벤트, 간식사업, 축제 등은 공식 인스타그램 최신 공지를 함께 확인하세요.",
  content: "총학생회 주관 행사, 이벤트, 간식사업, 축제 등은 일정과 장소가 바뀔 수 있어 공식 인스타그램 최신 공지를 확인하는 것이 좋습니다.",
  score: 1,
};

const STUDENT_COUNCIL_PARTNERSHIP_SOURCE: EricaBlogSource = {
  title: "한양대학교 ERICA 총학생회 제휴 인스타그램",
  url: STUDENT_COUNCIL_PARTNERSHIP_INSTAGRAM_URL,
  snippet: "총학생회 제휴, 할인, 혜택, 파트너십 관련 최신 공지는 제휴 전용 인스타그램에서 확인하세요.",
  content: "총학생회 제휴, 할인, 혜택, 파트너십 관련 정보는 한양대학교 ERICA 총학생회 제휴 인스타그램에서 확인하는 것이 좋습니다.",
  score: 1,
};

const ERICA_OFFICIAL_INSTAGRAM_SOURCE: EricaBlogSource = {
  title: "한양대학교 ERICA 공식 인스타그램",
  url: ERICA_OFFICIAL_INSTAGRAM_URL,
  snippet: "ERICA 공식 행사, 캠페인, 학교 소식, 현장 분위기는 ERICA 공식 인스타그램 최신 게시물을 함께 확인하세요.",
  content: "한양대학교 ERICA 공식 인스타그램은 학교 공식 행사, 캠페인, 공지성 소식, 캠퍼스 뉴스와 같은 발견형 정보를 확인하기 좋은 채널입니다. 단, 신청 기간이나 자격 같은 세부 규정은 공식 홈페이지 공지와 함께 확인해야 합니다.",
  score: 1,
};

const ERICA_BUS_SOURCE: EricaBlogSource = {
  title: "통학·셔틀버스 - 한양대학교",
  url: "https://hanyang.ac.kr/web/www/erica_bus",
  snippet: "ERICA 통학버스와 셔틀버스 운행 안내, 시간표, 운행 변경 공지를 확인하는 공식 페이지입니다.",
  content: "한양대학교 공식 홈페이지의 ERICA 통학·셔틀버스 안내 페이지입니다. 통학버스 시간표, 셔틀버스 운행 안내, 운행 변경 공지를 확인할 수 있습니다.",
  score: 1,
};

const LIBRARY_OFFICIAL_SOURCE: EricaBlogSource = {
  title: "한양대학교 ERICA학술정보관",
  url: "https://information.hanyang.ac.kr/",
  snippet: "자료 검색, 시설 이용, 이용시간과 좌석 현황을 확인하는 ERICA학술정보관 공식 사이트입니다.",
  content: "ERICA학술정보관 공식 사이트에서 소장자료 검색, 학습·연구지원, 시설이용, 이용시간, 열람실 좌석현황을 확인할 수 있습니다.",
  score: 1,
};

const LIBRARY_FACILITIES_SOURCE: EricaBlogSource = {
  title: "ERICA 학술정보관 시설 안내 - 한양대학교",
  url: "https://global.hanyang.ac.kr/s3/s3_7_1.php",
  snippet: "층별 자료열람실, 열람실, 멀티스페이스, 그룹스터디룸 안내입니다.",
  content: "1층 멀티스페이스, 2층 참고자료실·제1열람실, 3층 대출·반납 및 자료실, 4층 제2열람실·그룹스터디룸이 안내되어 있습니다. 이용시간은 변경될 수 있습니다.",
  score: 1,
};

const ICT_MAJOR_SOURCE: EricaBlogSource = {
  title: "ICT융합학부 전공소개 - 한양대학교 ERICA",
  url: "https://ict.hanyang.ac.kr/intro/major_intro.html",
  snippet: "ICT융합학부의 데이터인텔리전스전공과 디자인컨버전스전공 소개입니다.",
  content: "ICT융합학부는 데이터인텔리전스전공과 디자인컨버전스전공을 안내합니다.",
  score: 1,
};

const ICT_INTELLIGENCE_MODULE_SOURCE: EricaBlogSource = {
  title: "ICT융합학부 데이터인텔리전스전공 모듈 - 2025~2028 가이드북",
  url: "https://ict.hanyang.ac.kr/upload/ICT_module-intelligence.pdf",
  snippet: "AI & Data Analytics, 지능형 사물인터넷, 디지털 헬스케어 모듈 안내입니다.",
  content: "2025~2028 모듈형전공 가이드북 기준 데이터인텔리전스전공 모듈은 AI & Data Analytics, 지능형 사물인터넷, 디지털 헬스케어입니다.",
  score: 1,
};

const ICT_CONVERGENCE_MODULE_SOURCE: EricaBlogSource = {
  title: "ICT융합학부 디자인컨버전스전공 모듈 - 2025~2028 가이드북",
  url: "https://ict.hanyang.ac.kr/upload/ICT_module-convergence.pdf",
  snippet: "디자인공학 및 과학, 게임 & XR 엔터테인먼트, 사용자경험 및 프로덕트X 모듈 안내입니다.",
  content: "2025~2028 모듈형전공 가이드북 기준 디자인컨버전스전공 모듈은 디자인공학 및 과학, 게임 & XR 엔터테인먼트, 사용자경험 및 프로덕트X입니다.",
  score: 1,
};

const ELECTRONICS_MODULE_SOURCE: EricaBlogSource = {
  title: "전자공학부 전공모듈 - 한양대학교 ERICA",
  url: "https://module.hanyang.ac.kr/front/hymdMdModule/major/module?jid=gUEqEgZFRJqUvIrSq7AdaA&sd=12&so=UPDATED_AT_DESC&sp=1",
  snippet: "지능형 시스템과 반도체 모듈의 세부 분야를 안내합니다.",
  content: "지능형 시스템: Control, IoT/6G, Software, AI. 반도체: System, Chip, Circuit, Device.",
  score: 1,
};

const ELECTRONICS_MAJOR_SOURCE: EricaBlogSource = {
  title: "전자공학부 전공소개 - 한양대학교 ERICA",
  url: "https://module.hanyang.ac.kr/front/hymdMdModule/major/read?jid=gUEqEgZFRJqUvIrSq7AdaA&sd=12&so=UPDATED_AT_DESC&sp=1",
  snippet: "전공소개에 6개 교과 트랙 중심 이수체계 설명이 포함되어 있습니다.",
  content: "전자공학부 전공소개는 제어 및 로봇, 반도체, 전기에너지, 컴퓨터, 회로, 통신신호처리 6개 교과 트랙 중심의 이수체계를 안내합니다. 함께 실린 재학생 수치는 2022년 2학기 기준입니다.",
  score: 1,
};

const RESERVE_FORCE_BLOG_SOURCE: EricaBlogSource = {
  title: "2026-2학기 학생예비군훈련 안내(입소 강조사항 필독)",
  url: "https://blog.naver.com/hyerica4473/224413716588",
  snippet: "2026-2학기 학생예비군훈련 일정과 편성 확인 안내입니다.",
  content: "2026-2학기 학생예비군훈련 일정은 2026. 9. 28.(월)~9. 30.(수) / 3일로 안내되어 있습니다. 훈련 편성은 예비군 홈페이지 로그인 후 '나의 훈련정보'에서 확인하고, 여비 지급용 계좌정보 입력도 함께 확인해야 합니다.",
  score: 1,
};

const SCHOLARSHIP_OFFICIAL_SOURCE: EricaBlogSource = {
  title: "ERICA 장학 안내 - 한양대학교",
  url: "https://www.hanyang.ac.kr/web/www/-40",
  snippet: "장학 종류, 신청 기간, 담당 부서는 한양대학교 공식 장학 안내와 학생지원팀 공지를 확인해야 합니다.",
  content: "생활비 지원 성격의 장학은 장학명과 학기별 공지에 따라 신청 기간이 달라질 수 있습니다. 정확한 마감일은 한양대학교 공식 장학 안내 또는 학생지원팀/ERICA 공지에서 해당 장학명을 확인해야 합니다.",
  score: 1,
};

const PC_ROOM_INFRA_SOURCE: EricaBlogSource = {
  title: "한양대학교 ERICA 소프트웨어중심대학사업단 - SW교육 인프라",
  url: "https://computer.hanyang.ac.kr/major/infra.php",
  snippet: "SW교육센터 PC1실, PC2실, PC3실, PC4실의 위치와 주요 시설을 확인할 수 있습니다.",
  content: "기존 컴퓨터공학과 교육/실습 환경 현황 기준으로 제4공학관 211호는 SW교육센터 PC1실, 제4공학관 212호는 SW교육센터 PC2실, 제4공학관 213호는 SW교육센터 PC3실, 제4공학관 201호는 SW교육센터 PC4실로 안내되어 있습니다.",
  score: 1,
};

const MILITARY_LEAVE_SOURCE: EricaBlogSource = {
  title: "ERICA 학사안내 - 휴학",
  url: "https://ehaksa.hanyang.ac.kr/timeoff",
  snippet: "입대휴학, 일반휴학, 병가휴학 등 휴학 관련 공식 학사안내입니다.",
  content: "ERICA 학사안내 휴학 페이지 기준으로 입대휴학은 입영 관련 공식 증빙자료를 제출해야 합니다. 입학 초기 휴학 제한에서도 질병, 입대 등의 사유는 예외로 안내됩니다. 일반휴학 중 입대하는 경우 입대휴학 절차를 별도로 확인해야 하며, 처리하지 않으면 휴학만료에 따른 문제가 생길 수 있습니다.",
  score: 1,
};

const HYIN_RECORD_CHANGE_SOURCE: EricaBlogSource = {
  title: "ERICA 학사안내 - 학적변동 신청방법",
  url: "https://ehaksa.hanyang.ac.kr/hyin",
  snippet: "휴학, 복학, 자퇴, 다중전공 등 학적변동은 HY-in에서 신청하는 공식 안내입니다.",
  content: "ERICA 학사안내 학적변동 신청방법 페이지는 휴학, 복학, 자퇴, 자진유급, 다중전공 등 학적변동 신청을 HY-in에서 처리할 수 있다고 안내합니다.",
  score: 1,
};

const SOFTWARE_COLLEGE_SOURCE: EricaBlogSource = {
  title: "소프트웨어융합대학 건물 안내",
  url: "https://blog.naver.com/PostSearchList.naver?blogId=hyerica4473&searchText=%EC%86%8C%ED%94%84%ED%8A%B8%EC%9B%A8%EC%96%B4%EC%9C%B5%ED%95%A9%EB%8C%80%ED%95%99%20%EC%9C%B5%ED%95%A9%EA%B5%90%EC%9C%A1%EA%B4%80%20%ED%95%99%EC%97%B0%EC%82%B0%ED%81%B4%EB%9F%AC%EC%8A%A4%ED%84%B0",
  snippet: "소융대는 소프트웨어융합대학을 뜻하며, 관련 공간은 융합교육관과 학연산클러스터지원센터를 나누어 사용합니다.",
  content: "소융대는 소프트웨어융합대학입니다. 소프트웨어융합대학 관련 건물은 제1공학관이 아니라 융합교육관과 학연산클러스터지원센터를 나누어 사용하는 것으로 안내해야 합니다.",
  score: 1,
};

const STUDENT_COUNCIL_LINKTREE_SOURCE: EricaBlogSource = {
  title: "총학생회 ACT Linktree",
  url: STUDENT_COUNCIL_LINKTREE_URL,
  snippet: "총학생회 ACT가 관리하는 신청폼, 규정집, 문의 채널, 학생요구파악, 회의록 링크 모음입니다.",
  content: "한양대학교 ERICA 제44대 총학생회 ACT Linktree입니다. 총학생회 관련 신청폼, 문의 채널, 규정집, 회의록, 학생요구파악 자료를 확인할 수 있습니다.",
  score: 1,
};

const KNOWN_LINKTREE_ITEMS: EricaBlogSource[] = [
  {
    title: "2026 한양문화제",
    url: STUDENT_COUNCIL_LINKTREE_URL,
    snippet: "한양문화제 관련 신청 및 안내 링크가 모여 있습니다.",
    content: "총학생회 ACT Linktree에는 2026 한양문화제 항목과 <스개팅 : 스타일로 하는 소개팅> 참가자 모집 링크가 있습니다.",
    score: 0,
  },
  {
    title: "추석귀향버스",
    url: STUDENT_COUNCIL_LINKTREE_URL,
    snippet: "총학생회가 운영하거나 안내하는 추석 귀향버스 관련 최신 공지는 Linktree와 공식 인스타그램을 확인하세요.",
    content: "추석귀향버스, 귀향버스, 귀성버스 관련 신청 및 안내는 총학생회 ACT Linktree 또는 공식 인스타그램 최신 공지에서 확인하는 것이 좋습니다.",
    score: 0,
  },
  {
    title: "주차장 유료화",
    url: STUDENT_COUNCIL_INSTAGRAM_URL,
    snippet: "주차장 유료화 관련 학생 안내와 변동 사항은 총학생회 공식 인스타그램 최신 공지를 확인하세요.",
    content: "주차장 유료화, 주차 유료화, 주차요금, 주차비 관련 이슈는 총학생회 공식 인스타그램 최신 공지에서 확인하는 것이 좋습니다.",
    score: 0,
  },
  {
    title: "총학생회비 추가 납부",
    url: STUDENT_COUNCIL_LINKTREE_URL,
    snippet: "총학생회비 추가 납부 신청 링크입니다.",
    content: "총학생회 ACT Linktree에는 총학생회비 추가 납부 링크가 있습니다.",
    score: 0,
  },
  {
    title: "총학생회비 환불 신청 및 환불 규정집",
    url: STUDENT_COUNCIL_LINKTREE_URL,
    snippet: "총학생회비 환불 신청과 환불 규정집 링크입니다.",
    content: "총학생회 ACT Linktree에는 총학생회비 환불 신청 링크와 총학생회비 환불 규정집 링크가 있습니다.",
    score: 0,
  },
  {
    title: "온라인 복지몰 with 이분의일 마켓",
    url: STUDENT_COUNCIL_LINKTREE_URL,
    snippet: "총학생회 온라인 복지몰 링크입니다.",
    content: "총학생회 ACT Linktree에는 온라인 복지몰 with 이분의일 마켓 링크가 있습니다.",
    score: 0,
  },
  {
    title: "학생법률지원 상담서",
    url: STUDENT_COUNCIL_LINKTREE_URL,
    snippet: "학생법률지원 상담 신청 링크입니다.",
    content: "총학생회 ACT Linktree에는 법률지원 상담서, 중국어 법률지원 상담 신청, 영어 Legal Support Consultation Request Form 링크가 있습니다.",
    score: 0,
  },
  {
    title: "학생요구파악 Q&A 및 아카이브",
    url: STUDENT_COUNCIL_LINKTREE_URL,
    snippet: "학생요구파악 Q&A와 아카이브 링크입니다.",
    content: "총학생회 ACT Linktree에는 학생요구파악 Q&A와 학생요구파악 아카이브 링크가 있습니다.",
    score: 0,
  },
  {
    title: "ACT 사업 문의 카카오톡 채널",
    url: STUDENT_COUNCIL_LINKTREE_URL,
    snippet: "ACT 각 국 사업 문의 채널 모음입니다.",
    content: "총학생회 ACT Linktree에는 교내협력국, 교육행정국, 대외협력국, 복지사업국, 시각디자인국, 재정관리국, 전략기획국, 중앙집행위원회, 학생인권위원회, 홍보미디어국 카카오톡 채널 링크가 있습니다.",
    score: 0,
  },
  {
    title: "총학생회 자료 및 회의록",
    url: STUDENT_COUNCIL_LINKTREE_URL,
    snippet: "총학생회칙, 선거시행세칙, 감사세칙, 확대운영위원회, 회의록 등 자료 링크입니다.",
    content: "총학생회 ACT Linktree에는 총학생회칙 및 선거시행세칙과 감사세칙, 확대운영위원회, 중앙감사위원회 회계 운영 간담회 회의록, 제44대 총학생회 및 중앙운영위원회 회의록 링크가 있습니다.",
    score: 0,
  },
  {
    title: "ERICA 총학생회 홈페이지",
    url: "https://ericastu.hanyang.ac.kr",
    snippet: "ERICA 총학생회 홈페이지 링크입니다.",
    content: "총학생회 ACT Linktree에는 ERICA 총학생회 홈페이지 링크가 있습니다.",
    score: 0,
  },
];

interface EricaPlaceEntry {
  canonical: string;
  aliases: string[];
  category: string;
  building?: string;
}

const ERICA_PLACE_ENTRIES: EricaPlaceEntry[] = [
  { canonical: "본관", aliases: ["ERICA 본관"], category: "건물" },
  { canonical: "학생복지관", aliases: ["학생복지관"], category: "건물" },
  { canonical: "학생회관", aliases: ["학생회관"], category: "건물" },
  { canonical: "제1공학관", aliases: ["1공학관"], category: "건물" },
  { canonical: "제2공학관", aliases: ["2공학관"], category: "건물" },
  { canonical: "제3공학관", aliases: ["3공학관"], category: "건물" },
  { canonical: "제4공학관", aliases: ["4공학관"], category: "건물" },
  { canonical: "제5공학관", aliases: ["5공학관"], category: "건물" },
  { canonical: "건축디자인관", aliases: [], category: "건물" },
  { canonical: "디자인문화관", aliases: [], category: "건물" },
  { canonical: "디자인교육관", aliases: [], category: "건물" },
  { canonical: "디자인연구관", aliases: [], category: "건물" },
  { canonical: "경상관", aliases: [], category: "건물" },
  { canonical: "국제문화관", aliases: [], category: "건물" },
  { canonical: "사회교육관", aliases: ["학군단", "사회교육관/학군단"], category: "건물" },
  { canonical: "언론정보관", aliases: [], category: "건물" },
  { canonical: "제1과학기술관", aliases: ["1과학기술관"], category: "건물" },
  { canonical: "제2과학기술관", aliases: ["2과학기술관"], category: "건물" },
  { canonical: "컨퍼런스홀", aliases: ["콘퍼런스홀"], category: "건물" },
  { canonical: "실용영어교육관", aliases: ["실용영어관"], category: "건물" },
  { canonical: "제1학술관", aliases: ["1학술관"], category: "건물" },
  { canonical: "게스트하우스", aliases: [], category: "건물" },
  { canonical: "창업보육센터", aliases: [], category: "건물" },
  { canonical: "약학관", aliases: [], category: "건물" },
  { canonical: "학연산클러스터지원센터", aliases: ["학연산클러스터"], category: "건물" },
  { canonical: "융합교육관", aliases: ["소융대", "소프트웨어융합대학", "SW융합대학", "소프트웨어대학", "소프트웨어융합대"], category: "건물" },
  { canonical: "퓨전전기기술응용연구센터", aliases: [], category: "건물" },
  { canonical: "BMR센터", aliases: [], category: "건물" },
  { canonical: "Lion's Hall", aliases: ["Lion’s Hall", "라이언스홀", "라이온스홀"], category: "건물" },
  { canonical: "ERICA COEX", aliases: ["에리카 코엑스"], category: "건물" },
  { canonical: "학술정보관", aliases: ["ERICA학술정보관"], category: "건물" },
  { canonical: "체육관", aliases: [], category: "건물" },
  { canonical: "실용음악관", aliases: [], category: "건물" },
  { canonical: "Muse Hall", aliases: ["뮤즈홀"], category: "건물" },
  { canonical: "창의관", aliases: ["창의관 동관", "창의관 서관"], category: "기숙사" },
  { canonical: "인재관", aliases: [], category: "기숙사" },
  { canonical: "인재3관", aliases: [], category: "기숙사" },
  { canonical: "행복관", aliases: [], category: "기숙사" },
  { canonical: "창의인재원", aliases: ["창의인재원 교육관", "창의교육관"], category: "기숙사" },
  { canonical: "LG이노텍/마이크론연구소", aliases: ["LG이노텍", "마이크론연구소"], category: "연구" },

  { canonical: "국제문화관 오픈스페이스", aliases: ["국제문화관 오픈 스페이스", "오픈스페이스", "오픈 스페이스"], category: "내부공간", building: "국제문화관" },
  { canonical: "프라임 라운지", aliases: ["PRIME 라운지"], category: "내부공간" },
  { canonical: "그룹 스터디룸", aliases: ["스터디룸"], category: "내부공간" },
  { canonical: "학술정보관 북카페", aliases: ["북카페"], category: "내부공간", building: "학술정보관" },
  { canonical: "PBL-Lab", aliases: ["PBL Lab", "PBL랩"], category: "내부공간" },
  { canonical: "CARE-LAB", aliases: ["CARE LAB", "CARE랩"], category: "내부공간" },
  { canonical: "Knowledge Bunker 라운지", aliases: ["Knowledge Bunker", "Knowledge Bunker Lounge", "놀리지 벙커", "놀리지벙커"], category: "내부공간", building: "제5공학관" },
  { canonical: "해동부스트업룸", aliases: ["부스트업룸"], category: "내부공간" },
  { canonical: "캡슐룸", aliases: ["여자 캡슐룸", "남자 캡슐룸"], category: "내부공간" },
  { canonical: "포트폴리오실", aliases: [], category: "내부공간" },
  { canonical: "SW창업실", aliases: ["SW창업공동장비실"], category: "내부공간" },
  { canonical: "캡스톤디자인실습실", aliases: [], category: "내부공간" },
  { canonical: "창업교육센터", aliases: [], category: "내부공간" },
  { canonical: "이슬람학생기도실", aliases: ["이슬람 기도실", "학생기도실"], category: "내부공간" },
  { canonical: "IC-PBL실", aliases: ["IC-PBL강의실", "PBL강의실"], category: "강의실" },
  { canonical: "스마트교육강의실", aliases: ["첨단강의실", "전자공학부 첨단강의실", "대학원 첨단강의실", "U-첨단강의실", "U-토론강의실", "AMP 강의실"], category: "강의실" },
  { canonical: "멀티미디어실", aliases: ["제1멀티미디어실", "제2멀티미디어실"], category: "내부공간" },
  { canonical: "케이스룸", aliases: [], category: "내부공간" },
  { canonical: "ALC", aliases: ["ALC 1", "ALC 2"], category: "내부공간" },
  { canonical: "세미나실", aliases: [], category: "내부공간" },
  { canonical: "방송제작실습실", aliases: [], category: "내부공간" },
  { canonical: "PC실", aliases: ["PC1실", "PC2실", "PC 1실", "PC 2실", "PC실습실", "PC 이용공간"], category: "내부공간" },
  { canonical: "컨퍼런스홀 중강당", aliases: ["콘퍼런스홀 중강당", "중강당"], category: "내부공간", building: "컨퍼런스홀" },
  { canonical: "학생회관 소극장", aliases: ["소극장"], category: "내부공간", building: "학생회관" },
  { canonical: "학생복지관 콘서트홀", aliases: ["콘서트홀"], category: "내부공간", building: "학생복지관" },
  { canonical: "체력단련장", aliases: [], category: "운동시설" },
  { canonical: "다목적실", aliases: [], category: "내부공간" },
  { canonical: "Simba", aliases: ["Simba랑", "심바"], category: "내부공간" },
  { canonical: "악기연습실", aliases: ["악기실", "녹음실", "무용실"], category: "내부공간" },
  { canonical: "기숙사 독서실", aliases: ["독서실", "창의관 독서실"], category: "기숙사" },
  { canonical: "기숙사 휴게실", aliases: ["휴게실", "창의관 휴게실", "인재관 휴게실", "행복관 휴게실"], category: "기숙사" },
  { canonical: "파우더룸", aliases: [], category: "내부공간" },
  { canonical: "동아리실", aliases: [], category: "내부공간" },
  { canonical: "학술정보관 1층 로비", aliases: [], category: "내부공간", building: "학술정보관" },
  { canonical: "국제문화관 1층 로비", aliases: [], category: "내부공간", building: "국제문화관" },

  { canonical: "민주광장", aliases: [], category: "랜드마크" },
  { canonical: "노천극장", aliases: [], category: "랜드마크" },
  { canonical: "호수공원", aliases: ["라이온스 레이크", "Lion's Lake"], category: "랜드마크" },
  { canonical: "아고라", aliases: [], category: "랜드마크" },
  { canonical: "백로봉", aliases: [], category: "랜드마크" },
  { canonical: "생태습지공원", aliases: [], category: "랜드마크" },
  { canonical: "ERICA 10리 둘레길", aliases: ["10리 둘레길", "둘레길"], category: "랜드마크" },
  { canonical: "벚꽃길", aliases: [], category: "랜드마크" },
  { canonical: "가을 낙엽길", aliases: [], category: "랜드마크" },
  { canonical: "약초원", aliases: ["제1약초원", "제2약초원"], category: "랜드마크" },
  { canonical: "잔디공원", aliases: [], category: "랜드마크" },
  { canonical: "풋살장", aliases: [], category: "운동시설" },
  { canonical: "대운동장", aliases: ["대운동장본부석"], category: "운동시설" },
  { canonical: "테니스장", aliases: ["테니스장관리동"], category: "운동시설" },
  { canonical: "골프연습장", aliases: ["골프교육장"], category: "운동시설" },
  { canonical: "제5공학관 썬큰", aliases: ["썬큰"], category: "랜드마크", building: "제5공학관" },

  { canonical: "런치콕", aliases: ["제1학생식당", "1학생식당", "학생식당"], category: "식당", building: "학생복지관" },
  { canonical: "푸드코트", aliases: ["학생복지관 푸드코트"], category: "식당", building: "학생복지관" },
  { canonical: "교직원식당", aliases: [], category: "식당" },
  { canonical: "창의관식당", aliases: ["기숙사 식당"], category: "식당", building: "창의관" },
  { canonical: "창업보육센터식당", aliases: [], category: "식당", building: "창업보육센터" },
  { canonical: "오봉도시락", aliases: [], category: "식당" },
  { canonical: "세븐일레븐", aliases: ["학생복지관 세븐일레븐", "창의관 세븐일레븐", "창의교육관 세븐일레븐", "언론정보관 세븐일레븐"], category: "편의시설" },
  { canonical: "GS25", aliases: ["학술정보관 GS25"], category: "편의시설" },
  { canonical: "CU", aliases: ["셔틀콕 CU"], category: "편의시설" },
  { canonical: "셔틀콕", aliases: ["콕", "버스승강장", "버스승강장 및 휴게실", "버스승강장및휴게실", "셔틀버스 승강장", "셔틀 정류장", "셔틀버스 정류장", "셔틀콕 대기실", "셔틀콕 휴게실"], category: "교통" },
  { canonical: "무인택배함", aliases: ["기숙사 무인택배함", "창의관 무인택배함", "인재관 무인택배함", "행복관 무인택배함"], category: "기숙사" },
  { canonical: "인재관 당구장", aliases: ["당구장"], category: "기숙사", building: "인재관" },
  { canonical: "창의관 행정팀", aliases: [], category: "기숙사", building: "창의관" },
  { canonical: "인재관 경비실", aliases: [], category: "기숙사", building: "인재관" },

  { canonical: "스마트제조러닝센터", aliases: [], category: "연구" },
  { canonical: "부품소재관", aliases: [], category: "연구" },
  { canonical: "경기테크노파크", aliases: [], category: "연구" },
  { canonical: "한국생산기술연구원", aliases: ["생산기술연구원"], category: "연구" },
  { canonical: "한국산업기술시험원", aliases: [], category: "연구" },
  { canonical: "한국전기연구원", aliases: [], category: "연구" },
  { canonical: "휴온스", aliases: ["Huons"], category: "연구" },
  { canonical: "공장형실험동", aliases: [], category: "연구" },
  { canonical: "동물실험동", aliases: [], category: "연구" },
  { canonical: "포장가속시험동", aliases: ["포장가속실험동"], category: "연구" },
  { canonical: "초대형구조실험동", aliases: [], category: "연구" },
  { canonical: "풍환경실험관", aliases: [], category: "연구" },
  { canonical: "수리실험동", aliases: [], category: "연구" },
];

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function getMeta(html: string, key: string): string {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return decodeXml(pattern.exec(html)?.[1] || "");
}

function getTitleTag(html: string): string {
  return stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function scoreText(query: string, text: string): number {
  if (/PC\s*[-_]?\s*\d+\s*실/i.test(query)) {
    const compactQuery = query.toLowerCase().replace(/[\s\-_]/g, "");
    const compactText = text.toLowerCase().replace(/[\s\-_]/g, "");
    return compactText.includes(compactQuery) ? 1 : 0;
  }

  const queryTokens = tokenize(query);
  const haystack = text.toLowerCase();
  if (queryTokens.length === 0) return 0;

  const matches = queryTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
  return matches / queryTokens.length;
}

function compactForMatch(value: string): string {
  return value.toLowerCase().replace(/[\s\-_'"’/·&]+/g, "");
}

function detectEricaPlace(userQuery: string): EricaPlaceEntry | null {
  const compactQuery = compactForMatch(userQuery);
  const candidates = ERICA_PLACE_ENTRIES.flatMap((entry) => {
    return [entry.canonical, ...entry.aliases].map((name) => ({ entry, name, compactName: compactForMatch(name) }));
  });

  return candidates
    .filter((candidate) => candidate.compactName.length >= 2 && compactQuery.includes(candidate.compactName))
    .sort((a, b) => b.compactName.length - a.compactName.length)[0]?.entry || null;
}

function detectPlaceIntent(userQuery: string): string {
  const compactQuery = compactForMatch(userQuery);
  const intentRules: Array<{ keywords: string[]; term: string }> = [
    { keywords: ["밥", "먹", "식사", "식당", "푸드코트", "편의점", "카페", "도시락"], term: "식당" },
    { keywords: ["프린트", "프린터", "인쇄", "복사", "출력"], term: "프린트" },
    { keywords: ["택배", "무인택배", "택배함"], term: "택배" },
    { keywords: ["공부", "스터디", "열람", "독서실"], term: "스터디룸" },
    { keywords: ["기도", "이슬람"], term: "기도실" },
    { keywords: ["운동", "헬스", "체력"], term: "체력단련장" },
    { keywords: ["셔틀", "버스", "정류장", "승강장"], term: "셔틀" },
    { keywords: ["공연", "강연", "행사", "축제"], term: "행사" },
    { keywords: ["라운지", "휴게", "쉬", "쉴"], term: "라운지" },
    { keywords: ["위치", "어디", "장소", "가는법", "찾아"], term: "" },
  ];

  for (const rule of intentRules) {
    if (rule.keywords.some((keyword) => compactQuery.includes(compactForMatch(keyword)))) {
      return rule.term;
    }
  }

  return "";
}

function hasSoftwareCollegeIntent(query: string): boolean {
  const compactQuery = compactForMatch(query);
  return ["소융대", "소프트웨어융합대학", "sw융합대학", "소프트웨어대학", "소프트웨어융합대"].some((keyword) => {
    return compactQuery.includes(compactForMatch(keyword));
  });
}

function isBuildingQuestion(query: string): boolean {
  const compactQuery = compactForMatch(query);
  return ["건물", "어디", "위치", "장소", "가는법", "찾아"].some((keyword) => compactQuery.includes(compactForMatch(keyword)));
}

function hasMilitaryLeaveIntent(query: string): boolean {
  const compactQuery = compactForMatch(query).toLowerCase();
  return ["군휴학", "입대휴학", "군입대휴학", "군입대", "입영휴학", "입영", "입대"].some((keyword) => {
    return compactQuery.includes(compactForMatch(keyword).toLowerCase());
  });
}

function hasReserveForceIntent(query: string): boolean {
  return hasAnyKeyword(query, ["예비군", "학생예비군", "예비군훈련", "훈련일정"]);
}

function hasHolidayShuttleIntent(query: string): boolean {
  return hasAnyKeyword(query, ["셔틀버스", "셔틀", "통학버스"]) && hasAnyKeyword(query, ["명절", "연휴", "추석", "설날", "공휴일", "휴일"]);
}

function hasScholarshipDeadlineIntent(query: string): boolean {
  return hasAnyKeyword(query, ["장학", "장학금"]) && hasAnyKeyword(query, ["마감", "날짜", "기간", "신청", "언제"]);
}

function hasLibraryFacilitiesIntent(query: string): boolean {
  return hasAnyKeyword(query, ["도서관", "학술정보관"]) &&
    !hasAnyKeyword(query, ["대출", "반납", "이용시간", "운영시간", "휴관", "예약", "연장", "몇시"]);
}

function hasIctTrackIntent(query: string): boolean {
  const compactQuery = compactForMatch(query).toLowerCase();
  return ["ict융합학부", "ict융합", "데이터인텔리전스", "디자인컨버전스"].some((term) =>
    compactQuery.includes(term.toLowerCase())
  ) && ["트랙", "모듈"].some((term) => compactQuery.includes(term));
}

function ictTrackAnswer(query: string): { answer: string; sources: EricaBlogSource[] } {
  const compactQuery = compactForMatch(query).toLowerCase();
  const intelligenceOnly = compactQuery.includes("데이터인텔리전스") && !compactQuery.includes("디자인컨버전스");
  const convergenceOnly = compactQuery.includes("디자인컨버전스") && !compactQuery.includes("데이터인텔리전스");
  const intelligence = "데이터인텔리전스전공: AI & Data Analytics, 지능형 사물인터넷, 디지털 헬스케어";
  const convergence = "디자인컨버전스전공: 디자인공학 및 과학, 게임 & XR 엔터테인먼트, 사용자경험 및 프로덕트X";
  const lines = [intelligenceOnly ? intelligence : convergenceOnly ? convergence : `${intelligence}\n${convergence}`];
  lines.unshift("ICT융합학부 공식 2025~2028 모듈형전공 가이드북 기준 트랙(모듈)은 다음과 같아요.");
  lines.push("세부 교과목과 적용 연도는 아래 공식 자료에서 확인할 수 있어요.");
  return {
    answer: lines.join("\n\n"),
    sources: [ICT_MAJOR_SOURCE, ...(!convergenceOnly ? [ICT_INTELLIGENCE_MODULE_SOURCE] : []), ...(!intelligenceOnly ? [ICT_CONVERGENCE_MODULE_SOURCE] : [])],
  };
}

function hasElectronicsTrackIntent(query: string, userProfile?: EricaStudentProfile | null): boolean {
  const compactQuery = compactForMatch(query);
  if (!compactQuery.includes("트랙") && !compactQuery.includes("모듈")) return false;
  const explicit = ["전자과", "전자공학과", "전자공학부", "전자학부"].some((name) => compactQuery.includes(name));
  const asksOwnDepartment = /우리\s*(과|학과|전공)|내\s*(과|학과|전공)|소속\s*(학과|전공)/.test(query);
  return explicit || (asksOwnDepartment && userProfile?.department === "전자공학부");
}

function electronicsTrackAnswer(): { answer: string; sources: EricaBlogSource[] } {
  return {
    answer: [
      "ERICA 전자공학부 공식 모듈형 교육과정에는 두 전공모듈과 세부 분야가 안내되어 있어요.",
      "지능형 시스템: Control(제어), IoT/6G, Software(소프트웨어), AI(인공지능)",
      "반도체: System(시스템), Chip(칩), Circuit(회로), Device(소자)",
      "",
      "별도로 전공소개에는 제어 및 로봇, 반도체, 전기에너지, 컴퓨터, 회로, 통신신호처리의 6개 교과 트랙이 설명돼 있어요. 이 페이지에는 2022년 2학기 기준 현황도 함께 실려 있으므로, 현재 이수 기준은 학부 공지를 확인해 주세요.",
    ].join("\n"),
    sources: [ELECTRONICS_MODULE_SOURCE, ELECTRONICS_MAJOR_SOURCE],
  };
}

let moduleIndexCache: { departments: Map<string, string>; expiresAt: number } | null = null;

async function getModuleDepartments(): Promise<Map<string, string>> {
  if (moduleIndexCache && moduleIndexCache.expiresAt > Date.now()) return moduleIndexCache.departments;
  const html = await fetchText(MODULE_INDEX_URL, 6000);
  const departments = new Map<string, string>();
  const links = html.matchAll(/<a\b[^>]*href=["']([^"']*\/major\/read\?[^"']+)["'][^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<\/a>/gi);
  for (const match of Array.from(links)) {
    const name = stripTags(match[2]);
    const url = new URL(decodeXml(match[1]), MODULE_INDEX_URL);
    if (url.origin !== "https://module.hanyang.ac.kr" || !name) continue;
    url.pathname = url.pathname.replace(/\/major\/read$/, "/major/module");
    departments.set(name, url.toString());
  }
  if (departments.size === 0) throw new Error("No department modules found");
  moduleIndexCache = { departments, expiresAt: Date.now() + 60 * 60 * 1000 };
  return departments;
}

async function answerDepartmentModules(
  query: string,
  userProfile?: EricaStudentProfile | null
): Promise<{ answer: string; sources: EricaBlogSource[] } | null> {
  if (!hasAnyKeyword(query, ["트랙", "모듈"])) return null;

  try {
    const departments = await getModuleDepartments();
    const compactQuery = compactForMatch(query);
    const explicit = Array.from(departments.keys())
      .filter((name) => compactQuery.includes(compactForMatch(name)))
      .sort((a, b) => b.length - a.length)[0];
    const asksOwnDepartment = /우리\s*(과|학과|전공)|내\s*(과|학과|전공)|소속\s*(학과|전공)/.test(query);
    const profileName = userProfile?.department && Array.from(departments.keys()).find(
      (name) => compactForMatch(name) === compactForMatch(userProfile.department)
    );
    const department = explicit || (asksOwnDepartment ? profileName : undefined);
    if (!department) return null;

    const url = departments.get(department)!;
    const html = await fetchText(url, 6000);
    const titles = Array.from(html.matchAll(/<div\b[^>]*class=["'][^"']*module-introduce__title[^"']*["'][^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<p[^>]*>([\s\S]*?)<\/p>/gi))
      .filter((match) => stripTags(match[1]).startsWith("모듈"))
      .map((match) => stripTags(match[2]))
      .filter((title) => title.length >= 2 && title.length <= 80);
    const modules = Array.from(new Set(titles));
    if (modules.length === 0) return null;

    return {
      answer: `${department}의 전공모듈은 공식 ERICA 모듈형 교과정보관리 기준으로 ${modules.join(", ")}입니다.\n\n세부 교과목과 현재 적용 여부는 아래 공식 전공모듈 페이지에서 확인해 주세요.`,
      sources: [{
        title: `${department} 전공모듈 - 한양대학교 ERICA`,
        url,
        snippet: `공식 전공모듈: ${modules.join(", ")}`,
        content: `${department} 전공모듈: ${modules.join(", ")}`,
        score: 1,
      }],
    };
  } catch {
    return null;
  }
}

function getPcRoomSearchTerm(query: string): string | null {
  const normalized = query
    .replace(/\s+/g, " ")
    .replace(/[?!.,~。？！]+/g, " ")
    .trim();
  const pcRoomMatch = normalized.match(/PC\s*[-_]?\s*\d+\s*실/i);
  return pcRoomMatch ? pcRoomMatch[0].replace(/\s+/g, " ").trim() : null;
}

function getPcRoomNumber(query: string): number | null {
  const match = query.match(/PC\s*[-_]?\s*(\d+)\s*실/i);
  return match ? Number(match[1]) : null;
}

function buildSearchQuery(userQuery: string): string {
  const normalized = userQuery
    .replace(/\s+/g, " ")
    .replace(/[?!.,~。？！]+/g, " ")
    .trim();
  const compactNormalized = compactForMatch(normalized).toLowerCase();

  if (compactNormalized.includes("군e러닝") || compactNormalized.includes("군이러닝")) {
    return "군 e러닝";
  }

  if (compactNormalized.includes("e러닝") || compactNormalized.includes("이러닝")) {
    return "e러닝";
  }

  if (hasReserveForceIntent(normalized)) {
    return "학생예비군훈련";
  }

  if (hasHolidayShuttleIntent(normalized)) {
    return "셔틀버스 운행 변경";
  }

  if (hasScholarshipDeadlineIntent(normalized)) {
    return normalized
      .replace(/신청\s*기간|마감\s*날짜|마감일|마감|날짜|기간|언제|알려줘|자격|조건|대상/g, " ")
      .split(/\s+/)
      .filter((token) => token && token !== "과")
      .join(" ") || "장학";
  }

  if (hasMilitaryLeaveIntent(normalized)) {
    return "입대휴학 휴학 학적변동 ERICA";
  }

  if (hasSoftwareCollegeIntent(normalized)) {
    return "소프트웨어융합대학 융합교육관 학연산클러스터지원센터";
  }

  const pcRoomSearchTerm = getPcRoomSearchTerm(normalized);
  if (pcRoomSearchTerm) {
    return pcRoomSearchTerm;
  }

  const place = detectEricaPlace(normalized);
  if (place) {
    const intent = detectPlaceIntent(normalized);
    const alreadyContainsIntent = intent && compactForMatch(place.canonical).includes(compactForMatch(intent));
    return [place.canonical, intent && !alreadyContainsIntent ? intent : ""].filter(Boolean).join(" ");
  }

  const roomMatch = normalized.match(/[가-힣A-Za-z0-9]+(?:관|동|실|호|센터|라운지|도서관|식당|카페|행정팀|학과|전공|강의실|연구실)/);
  if (roomMatch) {
    return roomMatch[0].trim();
  }

  const stopWords = new Set([
    "어디", "어딨어", "어디있어", "어디야", "위치", "장소", "알려줘", "알려",
    "궁금해", "뭐야", "무엇", "어떻게", "언제", "있는지", "있나요", "있어",
    "인가요", "이야", "야", "은", "는", "이", "가", "을", "를", "에", "에서", "으로",
  ]);

  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.replace(/(은|는|이|가|을|를|에|에서|으로|인가요|이에요|예요|입니다|있어|있나요)$/g, ""))
    .filter((token) => token.length > 0)
    .filter((token) => !stopWords.has(token));

  return tokens.join(" ").trim() || normalized;
}

function hasStudentCouncilIntent(query: string): boolean {
  const normalized = query.toLowerCase().replace(/\s+/g, "");
  const strongKeywords = [
    "총학생회",
    "학생회",
    "축제",
    "부스",
    "라인업",
    "간식",
    "간식사업",
    "복지사업",
    "제휴사업",
    "문화사업",
    "사업문의",
    "제휴",
    "공동구매",
    "학생총회",
    "선거",
    "공약",
    "환급",
    "대동제",
    "굿즈",
    "응시료",
    "법률",
    "학생요구",
    "학생회비",
    "환불",
    "납부",
    "회의록",
    "회칙",
    "복지몰",
    "한양문화제",
    "추석귀향버스",
    "귀향버스",
    "귀성버스",
    "추석버스",
    "주차장유료화",
    "주차유료화",
    "주차장",
    "주차요금",
    "주차비",
  ];
  const hasStrongKeyword = strongKeywords.some((keyword) => normalized.includes(keyword.toLowerCase().replace(/\s+/g, "")));
  if (hasStrongKeyword) return true;

  const hasBusinessIntent = /[가-힣a-z0-9]+사업/.test(normalized);
  const likelyAcademicBusiness = ["linc", "링크", "국책", "연구", "정부", "지원사업", "산학", "창업지원사업"].some((keyword) => {
    return normalized.includes(keyword);
  });

  return hasBusinessIntent && !likelyAcademicBusiness;
}

function hasPartnershipIntent(query: string): boolean {
  const normalized = query.toLowerCase().replace(/\s+/g, "");
  return ["제휴", "할인", "혜택", "파트너십", "partner", "partnership"].some((keyword) => {
    return normalized.includes(keyword.toLowerCase().replace(/\s+/g, ""));
  });
}

function hasAnyKeyword(query: string, keywords: string[]): boolean {
  const normalized = compactForMatch(query).toLowerCase();
  return keywords.some((keyword) => normalized.includes(compactForMatch(keyword).toLowerCase()));
}

function detectQueryIntent(query: string): QueryIntent {
  if (hasAnyKeyword(query, ["신청", "접수", "지원", "납부", "환불", "발급", "참여", "예약", "제출", "등록"])) {
    return "action";
  }

  if (hasAnyKeyword(query, ["언제", "기간", "마감", "자격", "대상", "조건", "절차", "방법", "문의", "전화", "가능", "확인"])) {
    return "verify";
  }

  if (hasAnyKeyword(query, ["뭐 있어", "뭐있어", "요즘", "이번주", "오늘", "행사", "소식", "추천"])) {
    return "discover";
  }

  return "explore";
}

function detectQueryTopic(query: string): QueryTopic {
  const compact = compactForMatch(query).toLowerCase();
  const strongStudentCouncil = hasAnyKeyword(query, [
    "총학생회",
    "학생회",
    "한양문화제",
    "대동제",
    "라인업",
    "간식사업",
    "제휴",
    "공동구매",
    "학생회비",
    "회의록",
    "회칙",
    "학생요구",
    "추석귀향버스",
    "귀향버스",
    "귀성버스",
    "주차장유료화",
    "주차유료화",
  ]);

  if (strongStudentCouncil) return "student_council_event";
  if (hasMilitaryLeaveIntent(query) || hasAnyKeyword(query, ["군e러닝", "군이러닝", "예비군", "병무", "군복무", "사회복무"])) return "military";
  if (hasAnyKeyword(query, ["장학금", "장학", "국가근로", "학자금", "근로장학"])) return "scholarship";
  if (hasAnyKeyword(query, ["수강신청", "수업", "학사", "휴학", "복학", "졸업", "학점", "성적", "계절학기", "전과", "다전공"])) return "academic";
  if (hasAnyKeyword(query, ["등록금", "증명서", "증명발급", "행정절차", "신청기간"])) return "administration";
  if (hasAnyKeyword(query, ["기숙사", "창의인재원", "인재관", "행복관"])) return "dormitory";
  if (hasAnyKeyword(query, ["교환학생", "해외파견", "국제처", "외국인", "국제프로그램"])) return "international";
  if (hasAnyKeyword(query, ["취업", "현장실습", "인턴", "커리어", "진로", "채용"])) return "career";
  if (detectEricaPlace(query) || /PC\s*[-_]?\s*\d+\s*실/i.test(query) || hasAnyKeyword(query, ["건물", "강의실", "공간", "위치", "어디", "가는법", "찾아가는"])) return "place";
  if (hasAnyKeyword(query, ["셔틀", "통학버스", "정류장", "버스", "지하철", "교통"])) return "transportation";
  if (hasAnyKeyword(query, ["학식", "식당", "편의시설", "프린터", "휴게공간", "학생생활", "복지매장"])) return "campus_life";
  if (hasAnyKeyword(query, ["축제", "학생행사", "부스"])) return "student_council_event";
  if (hasAnyKeyword(query, ["공식행사", "캠페인", "프로그램", "특강", "작가와의만남", "공모전"])) return "university_event";
  if (["뭐있어", "뭐 있어", "오늘", "이번주", "요즘"].some((keyword) => compact.includes(compactForMatch(keyword)))) return "general_discovery";

  return hasStudentCouncilIntent(query) ? "student_council_event" : "general";
}

function routeForQuery(query: string): QueryRoute {
  const topic = detectQueryTopic(query);
  const intent = detectQueryIntent(query);

  switch (topic) {
    case "academic":
    case "scholarship":
    case "administration":
    case "military":
    case "dormitory":
    case "international":
    case "career":
      return { topic, intent, priority: ["official", "blog", "officialInstagram", "studentCouncil"] };
    case "place":
    case "campus_life":
      return { topic, intent, priority: ["blog", "official", "officialInstagram", "studentCouncil"] };
    case "transportation":
      return { topic, intent, priority: ["official", "blog", "officialInstagram", "studentCouncil"] };
    case "university_event":
      return { topic, intent, priority: ["officialInstagram", "official", "blog", "studentCouncil"] };
    case "student_council_event":
      return { topic, intent, priority: ["studentCouncil", "official", "officialInstagram", "blog"] };
    case "general_discovery":
      return { topic, intent, priority: ["officialInstagram", "studentCouncil", "official", "blog"] };
    default:
      return { topic, intent, priority: ["blog", "official", "officialInstagram", "studentCouncil"] };
  }
}

function routePrefersOfficial(route: QueryRoute): boolean {
  return route.priority[0] === "official";
}

function routeUsesStudentCouncil(route: QueryRoute): boolean {
  return route.priority.includes("studentCouncil") && (route.topic === "student_council_event" || route.topic === "general_discovery");
}

function routeUsesOfficialInstagram(route: QueryRoute): boolean {
  return route.topic === "university_event" || route.topic === "general_discovery";
}

function sourceKind(source: EricaBlogSource): SourceKind {
  if (source.url === ERICA_OFFICIAL_INSTAGRAM_URL) return "officialInstagram";
  if (
    source.url === STUDENT_COUNCIL_INSTAGRAM_URL ||
    source.url === STUDENT_COUNCIL_PARTNERSHIP_INSTAGRAM_URL ||
    source.url === STUDENT_COUNCIL_LINKTREE_URL
  ) {
    return "studentCouncil";
  }
  if (isHanyangOfficialUrl(source.url)) return "official";
  return "blog";
}

function orderSourcesByRoute(sources: EricaBlogSource[], route: QueryRoute): EricaBlogSource[] {
  const priorityIndex = new Map(route.priority.map((kind, index) => [kind, index]));
  return [...sources].sort((a, b) => {
    const aPriority = priorityIndex.get(sourceKind(a)) ?? route.priority.length;
    const bPriority = priorityIndex.get(sourceKind(b)) ?? route.priority.length;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return b.score - a.score;
  });
}

function textMatchesAny(text: string, keywords: string[]): boolean {
  const compactText = compactForMatch(text).toLowerCase();
  return keywords.some((keyword) => compactText.includes(compactForMatch(keyword).toLowerCase()));
}

function profileMatchScore(source: EricaBlogSource, profile?: EricaStudentProfile | null): number {
  if (!profile?.college && !profile?.department) return 0;

  const text = `${source.title} ${source.snippet} ${source.url}`;
  let score = 0;
  if (profile.department && textMatchesAny(text, [profile.department])) score += 0.8;
  if (profile.college && textMatchesAny(text, PROFILE_COLLEGE_KEYWORDS[profile.college] || [profile.college])) score += 0.45;
  return score;
}

function isCentralOfficialSource(source: EricaBlogSource): boolean {
  const host = (() => {
    try {
      return new URL(source.url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (host === "www.hanyang.ac.kr" || host === "ehaksa.hanyang.ac.kr") return true;
  const text = `${source.title} ${source.snippet}`;
  return textMatchesAny(text, ["ERICA 학사안내", "학사운영팀"]);
}

function isProfileMismatchCollegeSource(source: EricaBlogSource, profile?: EricaStudentProfile | null): boolean {
  if (!profile?.college || sourceKind(source) !== "official" || isCentralOfficialSource(source)) return false;

  const text = `${source.title} ${source.snippet} ${source.url}`;
  const ownKeywords = PROFILE_COLLEGE_KEYWORDS[profile.college] || [profile.college];
  if (textMatchesAny(text, ownKeywords) || (profile.department && textMatchesAny(text, [profile.department]))) return false;

  return Object.entries(PROFILE_COLLEGE_KEYWORDS).some(([college, keywords]) => {
    if (college === profile.college) return false;
    return textMatchesAny(text, keywords);
  });
}

function applyProfileToOfficialSources(
  sources: EricaBlogSource[],
  route: QueryRoute,
  profile?: EricaStudentProfile | null
): EricaBlogSource[] {
  return sources
    .filter((source) => {
      if (route.topic === "general" || route.topic === "general_discovery") return true;
      if (route.topic === "military" && sourceKind(source) === "official") {
        return isCentralOfficialSource(source) || profileMatchScore(source, profile) > 0;
      }
      return !isProfileMismatchCollegeSource(source, profile);
    })
    .map((source) => {
      const boost = profileMatchScore(source, profile);
      return boost > 0 ? { ...source, score: source.score + boost } : source;
    });
}

function getStudentCouncilInstagramSource(query: string): EricaBlogSource {
  return hasPartnershipIntent(query) ? STUDENT_COUNCIL_PARTNERSHIP_SOURCE : STUDENT_COUNCIL_SOURCE;
}

function withStudentCouncilSource(query: string, sources: EricaBlogSource[]): EricaBlogSource[] {
  if (!hasStudentCouncilIntent(query)) return sources;

  const instagramSource = getStudentCouncilInstagramSource(query);
  const hasInstagram = sources.some((source) => source.url === instagramSource.url);
  return hasInstagram ? sources : [instagramSource, ...sources];
}

function makeBlogSearchSource(query: string): EricaBlogSource {
  const searchUrl = new URL("https://blog.naver.com/PostSearchList.naver");
  searchUrl.searchParams.set("blogId", BLOG_ID);
  searchUrl.searchParams.set("searchText", query);

  return {
    title: `ERICA 블로그 내부 검색: ${query}`,
    url: searchUrl.toString(),
    snippet: "개별 글 본문을 자동으로 가져오지 못한 경우, 블로그 내부 검색 결과에서 직접 확인할 수 있습니다.",
    content: `"${query}" 관련 글은 ERICA 블로그 내부 검색 결과에서 직접 확인해 주세요.`,
    score: 1,
  };
}

function isBlogSearchFallbackSource(source: EricaBlogSource): boolean {
  return source.url.startsWith("https://blog.naver.com/PostSearchList.naver");
}

function isOfficialSearchFallbackSource(source: EricaBlogSource): boolean {
  return source.url.startsWith("https://search.naver.com/search.naver") &&
    source.title.startsWith("Hanyang ERICA official homepage search:");
}

function withBlogSearchFallback(query: string, sources: EricaBlogSource[]): EricaBlogSource[] {
  const hasRelevantBlogSource = sources.some((source) => {
    if (source.url === STUDENT_COUNCIL_INSTAGRAM_URL || source.url === STUDENT_COUNCIL_PARTNERSHIP_INSTAGRAM_URL) return false;
    return source.score >= MIN_RELEVANT_SCORE && scoreText(query, `${source.title} ${source.content} ${source.snippet}`) > 0;
  });

  if (hasRelevantBlogSource) return sources;
  return [
    makeBlogSearchSource(query),
    ...sources.filter((source) => source.url === STUDENT_COUNCIL_INSTAGRAM_URL || source.url === STUDENT_COUNCIL_PARTNERSHIP_INSTAGRAM_URL),
  ];
}

function appendStudentCouncilNotice(query: string, answer: string): string {
  if (!hasStudentCouncilIntent(query)) return answer;
  const instagramSource = getStudentCouncilInstagramSource(query);
  if (answer.includes(instagramSource.url)) return answer;

  if (instagramSource.url === STUDENT_COUNCIL_PARTNERSHIP_INSTAGRAM_URL) {
    return `${answer.trim()}\n\n제휴, 할인, 혜택 관련 최신 안내는 총학생회 제휴 인스타그램도 함께 확인해 주세요.\n${instagramSource.url}`;
  }

  return `${answer.trim()}\n\n총학생회 관련 최신 안내와 변동 사항은 공식 인스타그램도 함께 확인해 주세요.\n${instagramSource.url}`;
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 ERICA-Campus-Info-Chatbot/1.0",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function uniqueSources(sources: EricaBlogSource[]): EricaBlogSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.title}|${source.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readLiveLinktreeItems(): Promise<EricaBlogSource[]> {
  try {
    const html = await fetchText(STUDENT_COUNCIL_LINKTREE_URL, 6000);
    const pageText = stripTags(html);
    const anchorMatches = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
    const items = anchorMatches
      .map((match) => {
        const rawUrl = decodeXml(match[1]);
        const title = stripTags(match[2]);
        if (!title || title.length < 2) return null;
        if (/privacy|report|cookie|explore|join.*linktree/i.test(title)) return null;

        return {
          title,
          url: rawUrl.startsWith("http") ? rawUrl : STUDENT_COUNCIL_LINKTREE_URL,
          snippet: "총학생회 ACT Linktree에서 확인된 링크입니다.",
          content: `총학생회 ACT Linktree 항목: ${title}`,
          score: 0,
        } satisfies EricaBlogSource;
      })
      .filter((item): item is EricaBlogSource => Boolean(item));

    if (items.length > 0) return uniqueSources([...items, ...KNOWN_LINKTREE_ITEMS]);

    if (pageText.includes("총학생회 ACT")) {
      return [STUDENT_COUNCIL_LINKTREE_SOURCE, ...KNOWN_LINKTREE_ITEMS];
    }
  } catch {
    // Linktree may block server-side fetch in some environments. Static known items keep the chatbot useful.
  }

  return KNOWN_LINKTREE_ITEMS;
}

async function searchStudentCouncilLinktree(query: string, searchQuery: string): Promise<EricaBlogSource[]> {
  if (!hasStudentCouncilIntent(query)) return [];

  const candidates = await readLiveLinktreeItems();
  const scored = candidates
    .map((source) => ({
      ...source,
      score: Math.max(
        source.score,
        scoreText(query, `${source.title} ${source.snippet} ${source.content}`),
        scoreText(searchQuery, `${source.title} ${source.snippet} ${source.content}`)
      ),
    }))
    .filter((source) => source.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 4);
  if (top.length > 0) {
    return uniqueSources([STUDENT_COUNCIL_LINKTREE_SOURCE, ...top]);
  }

  return [STUDENT_COUNCIL_LINKTREE_SOURCE];
}

async function searchRss(query: string): Promise<EricaBlogSource[]> {
  const xml = await fetchText(`https://rss.blog.naver.com/${BLOG_ID}.xml`);
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 50);

  return items
    .map((match) => {
      const item = match[1];
      const title = decodeXml(/<title>([\s\S]*?)<\/title>/.exec(item)?.[1] || "");
      const url = decodeXml(/<link>([\s\S]*?)<\/link>/.exec(item)?.[1] || "");
      const description = stripTags(decodeXml(/<description>([\s\S]*?)<\/description>/.exec(item)?.[1] || ""));
      const rawDate = decodeXml(/<pubDate>([\s\S]*?)<\/pubDate>/.exec(item)?.[1] || "");
      const publishedAt = Number.isFinite(Date.parse(rawDate)) ? new Date(rawDate).toISOString() : undefined;
      const score = scoreText(query, `${title} ${description}`);

      return {
        title,
        url,
        snippet: description.slice(0, 260),
        content: description,
        score,
        publishedAt,
      };
    })
    .filter((item) => item.title && item.url)
    .sort((a, b) => b.score - a.score);
}

async function searchNaverView(query: string): Promise<EricaBlogSource[]> {
  const searchUrl = new URL("https://search.naver.com/search.naver");
  searchUrl.searchParams.set("where", "view");
  searchUrl.searchParams.set("query", `site:blog.naver.com/${BLOG_ID} ${query}`);

  const html = await fetchText(searchUrl.toString());
  const matches = Array.from(html.matchAll(/href="(https:\/\/blog\.naver\.com\/[^"]*hyerica4473[^"]*)"[^>]*>([\s\S]*?)<\/a>/g));
  const seen = new Set<string>();

  return matches
    .map((match) => {
      const url = decodeXml(match[1]);
      const title = stripTags(match[2]);
      return { title, url, snippet: title, content: title, score: scoreText(query, title) };
    })
    .filter((item) => {
      if (!item.title || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, 8);
}

function hasOfficialHomepageIntent(query: string): boolean {
  const route = routeForQuery(query);
  if (routePrefersOfficial(route)) return true;

  const normalized = compactForMatch(query);
  const keywords = [
    "e러닝",
    "이러닝",
    "군e러닝",
    "군이러닝",
    "학사",
    "수강",
    "수강신청",
    "계절학기",
    "등록",
    "등록금",
    "장학",
    "장학금",
    "휴학",
    "복학",
    "졸업",
    "학점",
    "성적",
    "예비군",
    "학사일정",
    "공지",
    "입학",
  ];

  return keywords.some((keyword) => normalized.includes(compactForMatch(keyword)));
}

function makeHanyangSearchSource(query: string): EricaBlogSource {
  const searchUrl = new URL("https://search.naver.com/search.naver");
  searchUrl.searchParams.set("where", "web");
  searchUrl.searchParams.set("query", `site:hanyang.ac.kr ERICA ${query}`);

  return {
    title: `Hanyang ERICA official homepage search: ${query}`,
    url: searchUrl.toString(),
    snippet: "Search Hanyang University official homepage pages with ERICA-focused terms.",
    content: `Official homepage search query: site:hanyang.ac.kr ERICA ${query}`,
    score: hasOfficialHomepageIntent(query) ? 1 : 0.2,
  };
}

function isHanyangOfficialUrl(rawUrl: string): boolean {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname === "hanyang.ac.kr" || hostname.endsWith(".hanyang.ac.kr");
  } catch {
    return false;
  }
}

function normalizeHanyangUrl(rawUrl: string): string | null {
  const url = decodeXml(rawUrl);
  if (!isHanyangOfficialUrl(url)) return null;
  if (/\.(png|jpg|jpeg|gif|svg|css|js|ico)(\?|$)/i.test(url)) return null;
  return url;
}

async function enrichHanyangOfficialSource(source: EricaBlogSource, query: string): Promise<EricaBlogSource> {
  if (/\.pdf(?:[/?#]|$)/i.test(source.url)) {
    return source;
  }

  try {
    const html = await fetchText(source.url, 6000);
    const pageTitle = getMeta(html, "og:title") || getTitleTag(html) || source.title;
    const title = scoreText(query, source.title) > scoreText(query, pageTitle) ? source.title : pageTitle;
    const description = getMeta(html, "og:description") || getMeta(html, "description") || source.snippet;
    const pageText = stripTags(html).slice(0, 2400);
    const content = [description, pageText].filter(Boolean).join("\n").slice(0, 1200);
    const ericaBoost = /ERICA|에리카/i.test(`${title} ${description}`) ? 0.35 : 0;

    return {
      ...source,
      title,
      snippet: description || source.snippet,
      content: content || source.content,
      score: Math.max(source.score, scoreText(query, `${title} ${description}`) + ericaBoost),
    };
  } catch {
    return source;
  }
}

async function searchHanyangOfficial(query: string, limit = 4): Promise<EricaBlogSource[]> {
  try {
    const searchUrl = new URL("https://search.naver.com/search.naver");
    searchUrl.searchParams.set("where", "web");
    searchUrl.searchParams.set("query", `site:hanyang.ac.kr ERICA ${query}`);

    const html = await fetchText(searchUrl.toString(), 7000);
    const matches = Array.from(
      html.matchAll(/<a[^>]+href=["'](https:\/\/(?:[a-z0-9-]+\.)*hanyang\.ac\.kr[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    );
    const seen = new Set<string>();
    const candidates = matches
      .map((match) => {
        const url = normalizeHanyangUrl(match[1]);
        const title = stripTags(match[2]);
        if (!url || !title || seen.has(url)) return null;
        seen.add(url);

        return {
          title,
          url,
          snippet: title,
          content: title,
          score: scoreText(query, title) + (/(ERICA|에리카)/i.test(title) ? 0.35 : 0),
        } satisfies EricaBlogSource;
      })
      .filter((source): source is EricaBlogSource => Boolean(source))
      .slice(0, Math.max(limit, 8));

    const enriched = await Promise.all(candidates.map((candidate) => enrichHanyangOfficialSource(candidate, query)));
    const relevant = enriched
      .filter((source) => {
        const audience = ["국제교육원", "사회교육원", "평생교육원", "대학원"];
        if (audience.some((name) => source.title.includes(name) && !query.includes(name))) return false;
        return scoreText(query, `${source.title} ${source.snippet}`) >= 0.6;
      })
      .sort((a, b) => b.score - a.score);

    const officialSources = uniqueSources(relevant).slice(0, limit);
    if (officialSources.length > 0) return officialSources;
  } catch {
    // Network search can fail in local/offline environments. Keep an official search link for admin-style questions.
  }

  return hasOfficialHomepageIntent(query) ? [makeHanyangSearchSource(query)] : [];
}

function mobileUrl(url: string): string {
  const logNo = /logNo=(\d+)/.exec(url)?.[1] || /\/(\d{8,})/.exec(url)?.[1];
  return logNo ? `https://m.blog.naver.com/${BLOG_ID}/${logNo}` : url.replace("https://blog.naver.com", "https://m.blog.naver.com");
}

async function enrichPost(source: EricaBlogSource, query: string): Promise<EricaBlogSource> {
  try {
    const html = await fetchText(mobileUrl(source.url), 6000);
    const title = getMeta(html, "og:title") || source.title;
    const description = getMeta(html, "og:description") || source.snippet;
    const bodyMatch =
      /<div[^>]+class=["'][^"']*se-main-container[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i.exec(html) ||
      /<div[^>]+id=["']postViewArea["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
    const body = bodyMatch ? stripTags(bodyMatch[1]) : "";
    const content = [description, body].filter(Boolean).join("\n").slice(0, 2400);

    return {
      ...source,
      title,
      snippet: description || source.snippet,
      content: (content || source.content).slice(0, 1200),
      score: Math.max(source.score, scoreText(query, `${title} ${description} ${content}`)),
    };
  } catch {
    return source;
  }
}

function sourceMentionsPlace(source: EricaBlogSource, place: EricaPlaceEntry): boolean {
  const compactText = compactForMatch(`${source.title} ${source.snippet} ${source.content}`);
  return [place.canonical, ...place.aliases].some((name) => compactText.includes(compactForMatch(name)));
}

function filterRelevantBlogSources(query: string, sources: EricaBlogSource[]): EricaBlogSource[] {
  const place = detectEricaPlace(query);

  return sources.filter((source) => {
    if (source.score <= 0) return false;
    if (place && !sourceMentionsPlace(source, place)) return false;
    return true;
  });
}

export async function searchEricaBlog(query: string, limit = 5): Promise<EricaBlogSource[]> {
  const sourceGroups = await Promise.allSettled([searchRss(query), searchNaverView(query)]);
  const merged = new Map<string, EricaBlogSource>();

  for (const group of sourceGroups) {
    if (group.status !== "fulfilled") continue;
    for (const item of group.value) {
      const existing = merged.get(item.url);
      if (!existing || item.score > existing.score) {
        merged.set(item.url, item);
      }
    }
  }

  const candidates = Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(limit, 8));

  const enriched = await Promise.all(candidates.map((candidate) => enrichPost(candidate, query)));
  const blogSources = filterRelevantBlogSources(query, enriched)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return withStudentCouncilSource(query, withBlogSearchFallback(query, blogSources)).slice(0, limit + 1);
}

function fallbackAnswer(query: string, sources: EricaBlogSource[]): string {
  if (sources.length === 0) {
    const answer = `"${query}"와 직접 연결되는 공식 자료를 아직 찾지 못했어요. 학과명, 장학명, 행사명, 장소명처럼 핵심 단어를 조금 더 구체적으로 넣어서 다시 물어봐 주세요.\n\n검색 대상: ${BLOG_HOME}`;
    return appendStudentCouncilNotice(query, answer);
  }

  const lines = sources.slice(0, 3).map((source, index) => {
    const summary = source.snippet || source.content.slice(0, 160);
    const title = isOfficialSearchFallbackSource(source)
      ? source.title.replace("Hanyang ERICA official homepage search:", "한양대 공식 홈페이지 검색:")
      : source.title;
    const description = isOfficialSearchFallbackSource(source)
      ? "공식 홈페이지에서 ERICA 관련 페이지를 직접 확인하는 검색 링크입니다."
      : summary;
    return `${index + 1}. ${title}\n${description}\n출처: ${source.url}`;
  });

  return appendStudentCouncilNotice(
    query,
    `확인 가능한 출처를 먼저 정리했어요. 원문 본문을 자동으로 충분히 가져오지 못한 자료는 아래 출처에서 직접 확인해 주세요.\n\n${lines.join("\n\n")}`
  );
}

function militaryLeaveAnswer(): string {
  return [
    "군 휴학은 ERICA 학사안내 기준으로 '입대휴학'에 해당합니다.",
    "",
    "핵심만 정리하면:",
    "1. 신청은 학적변동 메뉴에서 진행하는 유형입니다.",
    "2. 입대휴학은 입영통지서 같은 입영 관련 공식 증빙자료를 업로드해야 합니다.",
    "3. 신입생의 초기 학기 휴학 제한에서도 질병, 입대 등은 예외 사유로 안내됩니다.",
    "4. 일반휴학 중 군 입대를 하게 되면 입대휴학 전환/신청 절차를 반드시 확인해야 합니다.",
    "",
    "정확한 신청 가능 기간, 제출 서류 표현, 처리 기준은 학기마다 달라질 수 있으니 아래 ERICA 학사안내의 '휴학'과 '학적변동 신청방법' 페이지를 먼저 확인하는 게 가장 안전합니다.",
  ].join("\n");
}

function reserveForceAnswer(query: string): string {
  const asks2026SecondSemester = hasAnyKeyword(query, ["2026", "2학기", "2 학기"]);
  if (asks2026SecondSemester) {
    return [
      "2026년 2학기 학생예비군훈련은 ERICA 공식 블로그 공지 기준으로 2026. 9. 28.(월)~9. 30.(수), 3일 일정으로 안내되어 있습니다.",
      "",
      "확인해야 할 것:",
      "1. 예비군 홈페이지에 로그인해서 '나의 훈련정보'에서 본인 편성을 확인하세요.",
      "2. 여비 지급을 위해 계좌정보 입력 여부도 같이 확인해야 합니다.",
      "3. 예비군 일정은 수정될 수 있으니 원문 공지를 최종 기준으로 확인하세요.",
    ].join("\n");
  }

  return [
    "예비군 정보는 학과/단과대보다 ERICA 예비군연대 또는 학생지원 관련 공식 공지가 우선입니다.",
    "",
    "현재 확인 가능한 자료 기준으로는 학생예비군훈련 공지에서 훈련 일정, 편성 확인 방법, 입소 강조사항을 확인해야 합니다.",
    "본인 훈련 편성은 예비군 홈페이지 로그인 후 '나의 훈련정보'에서 확인하는 방식으로 안내되어 있습니다.",
  ].join("\n");
}

function holidayShuttleAnswer(): string {
  return [
    "명절 연휴 셔틀버스 운행 여부는 일반 시간표만으로 확정하면 안 되고, 연휴 직전의 운행 변경 공지를 확인해야 합니다.",
    "",
    "확인 순서:",
    "1. 한양대학교 공식 홈페이지의 ERICA 통학·셔틀버스 페이지에서 기본 운행 안내를 확인하세요.",
    "2. 명절/연휴 기간에는 별도 운행 중지 또는 단축 운행 공지가 올라올 수 있으니 최신 공지를 함께 확인하세요.",
    "3. 제공된 자료만으로는 지금 질문한 명절 연휴에 실제 운행하는지까지 확정할 수 없습니다.",
  ].join("\n");
}

function scholarshipDeadlineAnswer(query: string): string {
  return [
    `"${query}"는 장학금 종류와 학기에 따라 마감일과 자격이 달라집니다.`,
    "현재 확인된 자료만으로 특정 날짜를 확정할 수 없어요. 장학금 이름이나 공지 제목을 알려주면 신청 기간과 대상 조건을 더 정확히 찾아볼게요.",
  ].join("\n");
}

function libraryFacilitiesAnswer(): string {
  return "ERICA 학술정보관에는 1층 멀티스페이스, 2층 참고자료실·제1열람실, 3층 대출·반납 및 자료실, 4층 제2열람실·그룹스터디룸 등이 안내되어 있어요. 이용시간과 좌석 현황은 아래 학술정보관 공식 사이트에서 확인할 수 있습니다.";
}

function pcRoomAnswer(pcRoomSearchTerm: string, roomNumber: number | null): string {
  const roomLocations: Record<number, string> = {
    1: "제4공학관 211호",
    2: "제4공학관 212호",
    3: "제4공학관 213호",
    4: "제4공학관 201호",
  };
  const location = roomNumber ? roomLocations[roomNumber] : undefined;

  if (location) {
    return [
      `${pcRoomSearchTerm.toUpperCase()}은 SW교육센터 실습실 기준으로 ${location}에 있습니다.`,
      "",
      "질문 문장 전체가 아니라 장소명만 뽑아 확인하도록 처리했고, 아래 출처에서 PC실 위치 표를 확인할 수 있어요.",
    ].join("\n");
  }

  return [
    `"${pcRoomSearchTerm}"은 질문 문장 전체가 아니라 장소명만 뽑아서 ERICA 공식 블로그에서 검색하도록 처리했어요.`,
    "",
    "다만 현재 자동으로 블로그 본문까지 가져오지는 못해서, 정확한 건물명은 원문을 확인해야 합니다.",
    `아래 출처 카드의 "ERICA 블로그 내부 검색: ${pcRoomSearchTerm}"을 눌러 확인해 주세요.`,
  ].join("\n");
}

export async function answerEricaQuestion(
  query: string,
  userProfile?: EricaStudentProfile | null
): Promise<{ answer: string; sources: EricaBlogSource[] }> {
  if (isBuildingMapQuestion(query)) {
    const building = lookupCampusBuilding(query);
    if (building) {
      const detail = `ERICA 캠퍼스 안내도에서 ${building.name}의 건물번호는 ${building.number}번입니다.`;
      return {
        answer: `${detail} 아래 공식 안내도에서 위치를 확인할 수 있어요.`,
        sources: [{
          title: "한양대학교 ERICA 캠퍼스 안내도",
          url: ERICA_CAMPUS_MAP_URL,
          snippet: `${building.number}번 ${building.name}`,
          content: detail,
          score: 1,
        }],
      };
    }
  }
  if (hasIctTrackIntent(query)) return ictTrackAnswer(query);
  if (hasElectronicsTrackIntent(query, userProfile)) return electronicsTrackAnswer();
  const departmentModules = await answerDepartmentModules(query, userProfile);
  if (departmentModules) return departmentModules;

  const searchQuery = buildSearchQuery(query);
  const route = routeForQuery(query);
  const hasCouncilIntent = hasStudentCouncilIntent(query);
  const hasOfficialIntent = hasOfficialHomepageIntent(query) || routePrefersOfficial(route);
  const [blogSources, linktreeSources, officialSources] = await Promise.all([
    searchEricaBlog(searchQuery, 5),
    searchStudentCouncilLinktree(query, searchQuery),
    searchHanyangOfficial(searchQuery, 4),
  ]);
  const officialInstagramSources = routeUsesOfficialInstagram(route) ? [ERICA_OFFICIAL_INSTAGRAM_SOURCE] : [];
  const studentCouncilSources = routeUsesStudentCouncil(route) || hasCouncilIntent ? linktreeSources : [];
  const softwareCollegeSources = hasSoftwareCollegeIntent(query) ? [SOFTWARE_COLLEGE_SOURCE] : [];
  const militaryLeaveSources = hasMilitaryLeaveIntent(query) ? [MILITARY_LEAVE_SOURCE, HYIN_RECORD_CHANGE_SOURCE] : [];
  const filteredBlogSources = route.topic === "student_council_event" && studentCouncilSources.length > 0
    ? blogSources.filter((source) => {
        if (source.url === STUDENT_COUNCIL_INSTAGRAM_URL || source.url === STUDENT_COUNCIL_PARTNERSHIP_INSTAGRAM_URL) return true;
        return false;
      })
    : hasSoftwareCollegeIntent(query)
    ? blogSources.filter((source) => {
        const text = compactForMatch(`${source.title} ${source.snippet} ${source.content}`);
        return text.includes(compactForMatch("소프트웨어융합대학")) ||
          text.includes(compactForMatch("융합교육관")) ||
          text.includes(compactForMatch("학연산클러스터"));
      })
    : blogSources;
  const relevantOfficialSources = hasOfficialIntent
    ? officialSources
    : officialSources.filter((source) => source.score >= 0.65 || scoreText(searchQuery, `${source.title} ${source.snippet}`) >= 0.5);
  const profiledOfficialSources = applyProfileToOfficialSources(relevantOfficialSources, route, userProfile);
  const sources = orderSourcesByRoute(uniqueSources(
    hasOfficialIntent
      ? [...softwareCollegeSources, ...militaryLeaveSources, ...profiledOfficialSources, ...studentCouncilSources, ...officialInstagramSources, ...filteredBlogSources]
      : [...softwareCollegeSources, ...militaryLeaveSources, ...studentCouncilSources, ...officialInstagramSources, ...filteredBlogSources, ...profiledOfficialSources]
  ), route).slice(0, 9);

  if (hasSoftwareCollegeIntent(query) && isBuildingQuestion(query)) {
    return {
      answer: "소융대는 소프트웨어융합대학을 뜻합니다. 소프트웨어융합대학 관련 건물은 제1공학관으로 안내하면 안 되고, 융합교육관과 학연산클러스터지원센터를 나누어 사용한다고 보는 것이 맞습니다.\n\n블로그에서 더 확인하려면 아래 출처 카드의 소프트웨어융합대학 건물 검색 링크를 확인해 주세요.",
      sources: sources.slice(0, 3),
    };
  }

  if (hasMilitaryLeaveIntent(query)) {
    return {
      answer: militaryLeaveAnswer(),
      sources: sources.slice(0, 4),
    };
  }

  if (hasReserveForceIntent(query)) {
    const reserveSources = uniqueSources([RESERVE_FORCE_BLOG_SOURCE, ...blogSources]).slice(0, 4);
    return {
      answer: reserveForceAnswer(query),
      sources: reserveSources,
    };
  }

  if (hasHolidayShuttleIntent(query)) {
    const shuttleSources = uniqueSources([ERICA_BUS_SOURCE, ...blogSources]).slice(0, 4);
    return {
      answer: holidayShuttleAnswer(),
      sources: shuttleSources,
    };
  }

  if (hasScholarshipDeadlineIntent(query)) {
    const scholarshipSources = uniqueSources([
      SCHOLARSHIP_OFFICIAL_SOURCE,
      makeBlogSearchSource(searchQuery),
    ]).slice(0, 4);
    return {
      answer: scholarshipDeadlineAnswer(query),
      sources: scholarshipSources,
    };
  }

  if (hasLibraryFacilitiesIntent(query)) {
    return {
      answer: libraryFacilitiesAnswer(),
      sources: [LIBRARY_OFFICIAL_SOURCE, LIBRARY_FACILITIES_SOURCE],
    };
  }

  const pcRoomSearchTerm = getPcRoomSearchTerm(query);
  if (pcRoomSearchTerm) {
    const pcRoomSource = makeBlogSearchSource(pcRoomSearchTerm);
    const pcRoomNumber = getPcRoomNumber(query);
    return {
      answer: pcRoomAnswer(pcRoomSearchTerm, pcRoomNumber),
      sources: pcRoomNumber && pcRoomNumber >= 1 && pcRoomNumber <= 4
        ? [PC_ROOM_INFRA_SOURCE, pcRoomSource]
        : [pcRoomSource],
    };
  }

  const hasOnlySearchFallback = sources.length > 0 && sources.every((source) => {
    return (
      isBlogSearchFallbackSource(source) ||
      isOfficialSearchFallbackSource(source) ||
      source.url === STUDENT_COUNCIL_INSTAGRAM_URL ||
      source.url === STUDENT_COUNCIL_PARTNERSHIP_INSTAGRAM_URL
    );
  });

  if (hasOnlySearchFallback) {
    const blogSearchSource = sources.find(isBlogSearchFallbackSource);
    const officialSearchSource = sources.find(isOfficialSearchFallbackSource);
    const baseAnswer = blogSearchSource
      ? `"${searchQuery}" 관련 글은 ERICA 블로그 내부 검색에서 확인할 수 있어요. 자동으로 본문까지 가져오지는 못해서 위치나 날짜를 단정하지 않고, 아래 출처 카드의 "ERICA 블로그 내부 검색"에서 원문을 확인하도록 안내할게요.\n\n${blogSearchSource.url}`
      : officialSearchSource
      ? `"${searchQuery}" 관련 공식 홈페이지 본문을 자동으로 충분히 가져오지 못했어요. 아래 공식 홈페이지 검색 링크에서 ERICA 관련 원문을 확인해 주세요.\n\n${officialSearchSource.url}`
      : fallbackAnswer(query, sources);

    return {
      answer: appendStudentCouncilNotice(query, baseAnswer),
      sources,
    };
  }

  const evidenceSources = sources.filter((source) =>
    !isBlogSearchFallbackSource(source) && !isOfficialSearchFallbackSource(source)
  );
  const context = evidenceSources
    .map((source, index) => {
      return `[출처 ${index + 1}] ${source.title}\nURL: ${source.url}${source.publishedAt ? `\n게시일: ${source.publishedAt.slice(0, 10)}` : ""}\n내용: ${(source.content || source.snippet).slice(0, 900)}`;
    })
    .join("\n\n---\n\n");

  if (!context) {
    return { answer: fallbackAnswer(query, sources), sources: withStudentCouncilSource(query, sources) };
  }

  const systemPrompt = `너는 한양대학교 ERICA 캠퍼스 정보를 알려주는 한국어 챗봇이다.
제공된 자료만 근거로 답한다. 자료에는 ERICA 공식 블로그와 총학생회 ACT Linktree가 포함될 수 있다.
총학생회 ACT Linktree 자료가 있으면 질문과 직접 관련된 항목만 설명한다.
자료가 부족하면 확인할 수 없는 부분을 짧게 밝힌다.
자료 제목이 질문과 직접 관련 있으면 그 글의 설명과 스니펫을 우선 사용한다.
질문에 먼저 답하고, 핵심 정보만 한국어 2~3문장으로 작성한다.
출처 링크와 제목은 화면의 출처 카드에 표시되므로 답변에서 반복하지 않는다.`;

  const profileLabel = [userProfile?.college, userProfile?.department].filter(Boolean).join(" / ") || "미설정";
  const userPrompt = `질문: ${query}
검색어: ${searchQuery}
질문 분류: ${route.topic}
질문 목적: ${route.intent}
사용자 소속: ${profileLabel}

참고 자료:
${context}

위 자료만 사용해서 답변해 주세요.`;

  const officialPromptNote = `Source routing policy: Homepage = Verify, Blog = Understand, Official Instagram = Discover, Student Council = Participate. The current route is topic=${route.topic}, intent=${route.intent}, source priority=${route.priority.join(" > ")}. User profile is ${profileLabel}. Official homepage sources from ${HANYANG_HOME} may be included. For university-wide rules such as reserve forces, leave of absence, scholarship, registration, and course enrollment, prefer central ERICA academic sources over college pages. For department-specific questions, prefer the user's selected department/college sources when present. For places and campus-life explanations, prefer ERICA official blog sources. For student council festivals, partnerships, welfare events, and student council services, prefer student council Linktree/Instagram sources. An Instagram or search link alone does not verify event details, dates, discounts, or eligibility. A source without a publication date must not be described as current.`;

  const result = await ollamaService.generateWithOllama(DEFAULT_MODEL, userPrompt, `${systemPrompt}\n${officialPromptNote}`, {
    temperature: 0.2,
    maxTokens: 180,
  });

  if (result.response) {
    return { answer: appendStudentCouncilNotice(query, result.response), sources };
  }

  return { answer: fallbackAnswer(query, sources), sources };
}
