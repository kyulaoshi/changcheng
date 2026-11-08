// =====================================================================
//  기본 단어 데이터 (코드와 분리)
//  - 이 목록은 '연습 모드'와 '새로 만든 방의 기본 단어장'에 쓰입니다.
//  - 수업 중에는 교사 페이지의 [단어장 편집]에서 엑셀 붙여넣기로 바꾸면 됩니다.
//  형식: { ko: 한국어 뜻, zh: 중국어, py: 병음(성조 없이) }
// =====================================================================
export const DEFAULT_WORDS = [
  { ko: '사과',     zh: '苹果', py: 'pingguo' },
  { ko: '학교',     zh: '学校', py: 'xuexiao' },
  { ko: '선생님',   zh: '老师', py: 'laoshi' },
  { ko: '학생',     zh: '学生', py: 'xuesheng' },
  { ko: '친구',     zh: '朋友', py: 'pengyou' },
  { ko: '가족',     zh: '家人', py: 'jiaren' },
  { ko: '아버지',   zh: '爸爸', py: 'baba' },
  { ko: '어머니',   zh: '妈妈', py: 'mama' },
  { ko: '중국',     zh: '中国', py: 'zhongguo' },
  { ko: '한국',     zh: '韩国', py: 'hanguo' },
  { ko: '좋아하다', zh: '喜欢', py: 'xihuan' },
  { ko: '먹다',     zh: '吃',   py: 'chi' },
  { ko: '마시다',   zh: '喝',   py: 'he' },
  { ko: '가다',     zh: '去',   py: 'qu' },
  { ko: '오다',     zh: '来',   py: 'lai' },
  { ko: '보다',     zh: '看',   py: 'kan' },
  { ko: '듣다',     zh: '听',   py: 'ting' },
  { ko: '책',       zh: '书',   py: 'shu' },
  { ko: '물',       zh: '水',   py: 'shui' },
  { ko: '커피',     zh: '咖啡', py: 'kafei' },
];

/**
 * 엑셀/구글시트에서 복사한 텍스트를 단어 목록으로 변환합니다.
 * 지원 형식(한 줄에 한 단어, 탭·쉼표·| 구분):
 *   한국어뜻  중국어  병음
 *   번호  한국어뜻  중국어  병음
 *   한국어뜻  병음            (중국어 생략 가능)
 * 첫 줄이 제목 줄(번호/한국어/뜻/병음 등)이면 자동으로 건너뜁니다.
 */
export function parseWordText(text) {
  const words = [];
  const errors = [];
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    let cols = line.includes('\t') ? line.split('\t')
             : line.includes('|') ? line.split('|')
             : line.split(',');
    cols = cols.map(c => c.trim()).filter(c => c !== '');
    if (i === 0 && /번호|한국어|뜻|병음|pinyin|중국어/i.test(line)) return; // 제목 줄
    if (cols.length >= 4 && /^\d+$/.test(cols[0])) cols = cols.slice(1);   // 번호 열 제거
    if (cols.length === 2) cols = [cols[0], '', cols[1]];
    if (cols.length < 3) { errors.push(`${i + 1}번째 줄: 칸이 부족해요 → "${line}"`); return; }
    const [ko, zh, py] = cols;
    if (!/[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(py)) {
      errors.push(`${i + 1}번째 줄: 병음이 영어 알파벳이 아니에요 → "${py}"`);
      return;
    }
    words.push({ ko, zh, py });
  });
  return { words, errors };
}

/** 단어 목록 → 엑셀에 다시 붙여넣기 좋은 탭 구분 텍스트 */
export function wordsToText(words) {
  return (words || []).map(w => [w.ko, w.zh || '', w.py].join('\t')).join('\n');
}

/** 중복 없이 n개를 무작위로 뽑습니다 (연습 모드용) */
export function pickWords(list, n, shuffle = true) {
  const seen = new Set();
  const uniq = list.filter(w => {
    const k = String(w.ko).trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const arr = uniq.slice();
  if (shuffle) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  return arr.slice(0, n);
}

// =====================================================================
//  기본 제공 주제별 단어장 (교사 페이지 [단어장 보관함]에서 바로 불러오기)
//  ※ 학교 교과서 단원과 다를 수 있으니 필요하면 고쳐서 '내 단어장'으로 저장하세요.
// =====================================================================
const W = s => s.trim().split('\n').map(l => { const [ko, zh, py] = l.trim().split('|'); return { ko, zh, py }; });

export const WORD_PRESETS = [
  { id: 'basic', name: '기본 20단어', words: DEFAULT_WORDS },
  { id: 'greet', name: '인사·나라', words: W(`
    안녕하세요|你好|nihao
    고맙습니다|谢谢|xiexie
    안녕히 가세요|再见|zaijian
    미안합니다|对不起|duibuqi
    괜찮습니다|没关系|meiguanxi
    이름|名字|mingzi
    중국|中国|zhongguo
    한국|韩国|hanguo
    일본|日本|riben
    미국|美国|meiguo
    중국 사람|中国人|zhongguoren
    한국 사람|韩国人|hanguoren`) },
  { id: 'family', name: '가족', words: W(`
    아빠|爸爸|baba
    엄마|妈妈|mama
    형·오빠|哥哥|gege
    누나·언니|姐姐|jiejie
    남동생|弟弟|didi
    여동생|妹妹|meimei
    할아버지|爷爷|yeye
    할머니|奶奶|nainai
    아들|儿子|erzi
    딸|女儿|nüer
    가족|家人|jiaren
    집|家|jia`) },
  { id: 'number', name: '숫자', words: W(`
    1 (일)|一|yi
    2 (이)|二|er
    3 (삼)|三|san
    4 (사)|四|si
    5 (오)|五|wu
    6 (육)|六|liu
    7 (칠)|七|qi
    8 (팔)|八|ba
    9 (구)|九|jiu
    10 (십)|十|shi
    100 (백)|百|bai
    0 (영)|零|ling`) },
  { id: 'food', name: '음식·음료', words: W(`
    밥|米饭|mifan
    국수|面条|miantiao
    만두(교자)|饺子|jiaozi
    찐빵(바오쯔)|包子|baozi
    빵|面包|mianbao
    달걀|鸡蛋|jidan
    사과|苹果|pingguo
    바나나|香蕉|xiangjiao
    수박|西瓜|xigua
    우유|牛奶|niunai
    차|茶|cha
    콜라|可乐|kele
    물|水|shui
    커피|咖啡|kafei`) },
  { id: 'school', name: '학교생활', words: W(`
    학교|学校|xuexiao
    선생님|老师|laoshi
    학생|学生|xuesheng
    반 친구|同学|tongxue
    교실|教室|jiaoshi
    책|书|shu
    펜|笔|bi
    책가방|书包|shubao
    숙제|作业|zuoye
    시험|考试|kaoshi
    중국어|汉语|hanyu
    수업하다|上课|shangke
    수업이 끝나다|下课|xiake
    도서관|图书馆|tushuguan`) },
  { id: 'verb', name: '동사·형용사', words: W(`
    먹다|吃|chi
    마시다|喝|he
    가다|去|qu
    오다|来|lai
    보다|看|kan
    듣다|听|ting
    말하다|说|shuo
    읽다|读|du
    쓰다|写|xie
    사다|买|mai
    좋아하다|喜欢|xihuan
    공부하다|学习|xuexi
    자다|睡觉|shuijiao
    좋다|好|hao
    크다|大|da
    작다|小|xiao
    많다|多|duo
    바쁘다|忙|mang`) },
  { id: 'time', name: '날짜·시간', words: W(`
    오늘|今天|jintian
    내일|明天|mingtian
    어제|昨天|zuotian
    지금|现在|xianzai
    아침|早上|zaoshang
    점심(정오)|中午|zhongwu
    저녁|晚上|wanshang
    요일·주|星期|xingqi
    년(해)|年|nian
    월(달)|月|yue
    일(날짜)|号|hao
    시(시각)|点|dian`) },
];

/** 엑셀 양식(CSV) 내용 */
export const WORD_TEMPLATE_ROWS = [
  ['한국어 뜻', '중국어', '병음'],
  ['사과', '苹果', 'pingguo'],
  ['학교', '学校', 'xuexiao'],
  ['초록색', '绿色', 'lvse'],
];
