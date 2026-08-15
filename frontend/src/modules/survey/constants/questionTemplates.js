// 문항 템플릿.
//
// **매번 백지에서 설문을 설계하게 두면 아무도 안 쓴다.** 그래서 자주 쓰는 묶음을
// 버튼 하나로 채운다.
//
// ⚠️ 이 파일은 전략 모듈의 `definitions.py` 를 **부르지 않고 베껴 둔 것**이다.
// 설문 모듈이 전략 API 를 부르는 순간 백엔드에서 지킨 독립성(`survey/models.py`
// 6-16행, `manager_required` 가 전략 데코레이터를 안 쓰는 이유)이 무의미해진다.
// 대가는 원본이 바뀌면 여기가 조용히 어긋난다는 것인데, 설문 문구는 배포한
// 뒤에는 어차피 못 바꾸는 값이라(바꾸면 이미 받은 답이 무엇에 대한 답인지
// 알 수 없다) 사본이 굳는 편이 오히려 안전하다.
//
// 설문을 쓰는 모듈이 셋째로 늘어나면 그때 백엔드 템플릿 레지스트리로 승격시킨다.

/**
 * AX-5R 조직 역량 5축.
 *
 * ⚠️ 'redesign' 의 화면 표기는 **반드시 '업무 정착'** 이다. 원 논문 용어인
 * '업무 재설계'로 쓰면 AX 맥락에서 인력 감축 뉘앙스를 달고 다녀서, 그렇게
 * 읽히는 순간 답변 자체가 왜곡된다. 묻는 것은 조직 축소가 아니라 '실제 업무에
 * 녹아들었는가'다. (key 는 백엔드 진단 축과 맞춰야 하므로 redesign 그대로 둔다)
 */
export const ORGANIZATION_DIMENSIONS = [
  {
    key: 'readiness',
    label: '준비도',
    question: '할 수 있는 여건이 되는가',
    detail: '데이터·인력·인프라가 갖춰져 있는가.',
  },
  {
    key: 'redesign',
    label: '업무 정착',
    question: '실제 업무 흐름에 녹아 있는가',
    detail: '따로 돌리는 별도 활동인가, 평소 일하는 과정 안에 들어와 있는가.',
  },
  {
    key: 'role',
    label: '역할·책임',
    question: '누가 책임지는지 정해져 있는가',
    detail: '누가 만들고 누가 쓰고 누가 결정하는지 분명한가.',
  },
  {
    key: 'risk',
    label: '리스크 관리',
    question: '틀렸을 때의 대비가 있는가',
    detail: '모델이 현실과 어긋났을 때 무엇이 깨지고 어떻게 되돌리는가.',
  },
  {
    key: 'return',
    label: '성과 측정',
    question: '효과를 재고 있는가',
    detail: '무엇으로 좋아졌다고 말할 수 있는가. 재는 방법이 정해져 있는가.',
  },
];

// 척도 양끝 라벨. 조직 축은 "무엇을 할 수 있는가"가 아니라 "얼마나 자리잡았는가"를
// 재므로 1='없음' 5='지속 개선' 이다.
const ORGANIZATION_SCALE = {
  min: 1,
  max: 5,
  minLabel: '없음',
  maxLabel: '지속 개선',
};

export const STRATEGY_DIMENSION_LINK = 'strategy_dimension';

/** 'organization:readiness' 같은 링크 키를 만든다. 한 곳에서만 만든다. */
export const organizationLinkKey = (dimensionKey) => `organization:${dimensionKey}`;

/**
 * 링크 키를 사람이 읽을 말로. 화면에 'organization:readiness' 를 그대로 찍으면
 * 사용자가 무슨 소린지 모른다.
 */
export function linkKeyLabel(linkKey) {
  if (!linkKey) return null;
  const [category, dimension] = String(linkKey).split(':');
  if (category === 'organization') {
    const found = ORGANIZATION_DIMENSIONS.find(d => d.key === dimension);
    if (found) return `조직 역량 · ${found.label}`;
  }
  return linkKey;
}

/**
 * 템플릿 목록. 에디터는 이 배열을 그대로 버튼으로 그린다 — 배열이 비면 버튼도
 * 안 뜨므로, 템플릿을 늘리거나 줄이는 데 에디터를 고칠 필요가 없다.
 *
 * build() 가 돌려주는 문항에는 link_type/link_key 가 **반드시** 붙어야 한다.
 * 안 붙으면 백엔드가 에러 없이 201 을 주고 link 만 NULL 로 저장돼서, 겉보기엔
 * 멀쩡한데 집계값이 진단 칸으로 영영 들어가지 않는다.
 */
export const QUESTION_TEMPLATES = [
  {
    id: 'strategy_organization',
    label: '조직 역량 5축으로 채우기',
    hint: '진단의 조직 역량 5축(준비도·업무 정착·역할·책임·리스크 관리·성과 측정)을 문항으로 만듭니다',
    build: () => ORGANIZATION_DIMENSIONS.map((d, i) => ({
      order: i,
      text: `우리 조직의 '${d.label}' 는 어느 수준입니까? — ${d.question}`,
      help_text: d.detail,
      qtype: 'scale',
      required: true,
      options: { ...ORGANIZATION_SCALE },
      link_type: STRATEGY_DIMENSION_LINK,
      link_key: organizationLinkKey(d.key),
    })),
  },
];

export default QUESTION_TEMPLATES;
