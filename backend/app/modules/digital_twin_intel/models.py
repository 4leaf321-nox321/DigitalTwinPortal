"""디지털 트윈 기술정보 — 바깥에서 들어온 소식과, 그 소식이 떠받치는 기술 레이더.

왜 두 개체인가
    같은 「바깥 정보」지만 **모양이 다르다.**

        소식   사건 하나. 발표일이 핵심이고 금방 낡는다. 많고, 훑고 지나간다.
        기술   개체 하나. 상태가 천천히 움직인다. 적고, 계속 되돌아와 참조한다.

    한 표에 섞으면 둘 다 못 쓴다 — 소식 100건에 묻혀 기술 20개를 못 찾고,
    기술을 세워 두면 같은 사건의 기사 셋이 각각 한 줄씩 선다.

⚠️⚠️ **이 자리는 세 번 시도됐다가 세 번 다 죽었다.** `tech_radar` ·
   `tech_archive` · `digital_twin_solution` 이 전부 "환영합니다!" 템플릿인 채로
   남아 있다(2026-08-25 확인). 죽은 이유는 기능이 모자라서가 아니라
   **기술 목록이 아무의 일도 아니어서**다. 과제는 관리해야 하니 채워지고 투자는
   예산이라 반드시 적히는데, 기술 목록은 처음 한 달만 채워지고 낡는다.
   낡은 레이더는 안 보고, 안 보면 아무도 안 채운다.

   그래서 이 설계는 **레이더를 따로 채우지 않는다.** 셋으로 막는다 —

     ① 소식을 넣을 때 **그 자리에서** 기술을 고르거나 만든다(`IntelEvidence`).
        레이더는 소식 정리의 **부산물**로 채워진다.
     ② 기술 화면이 「최근 근거」를 보여준다. 왜 그 단계인지 되짚을 수 있다.
     ③ 근거가 오래 없으면 **낡음**으로 표시된다(`IntelTech.is_stale`).
        앞선 셋은 낡아도 낡은 줄 몰랐다 — 표는 늘 그럴듯해 보인다.

바깥 인터넷은 서버가 못 간다
    운영 서버의 바깥 호출은 **사내 LLM 하나뿐**이다. 그래서 이 모듈은 **수집기가
    아니라 받는 자리**다. 넷으로 들어온다 — MCP(바깥 Claude 가 조사해 밀어넣기) ·
    사람이 손으로 · 파일 · 사내 LLM 정리. 어디로 들어왔는지를 `origin` 에 남긴다.
    섞이면 나중에 「이거 누가 확인한 거야?」에 답할 수 없다.
"""
from datetime import datetime, timedelta

from sqlalchemy.dialects.postgresql import JSONB

from app.extensions import db
from app.shared.models import BaseModel

# 어디로 들어왔나. 품질이 다르므로 **반드시 구분해 둔다.**
ORIGINS = ('ui', 'mcp', 'file', 'llm')

# 레이더 단계. ThoughtWorks 레이더의 네 고리를 우리 말로 옮겼다.
#   도입   이미 쓰고 있거나 바로 쓸 수 있다
#   시험   과제 하나에 걸어 보는 중이다
#   관찰   눈여겨보고 있다. 아직 안 써 봤다
#   보류   봤고, 지금은 아니라고 판단했다  ← **이 칸이 제일 값지다.**
#          안 쓰기로 한 이유를 안 적으면 6개월 뒤 같은 논의를 처음부터 다시 한다.
"""
레이더의 단계. **차례가 곧 고리 차례**다 — 앞이 안쪽(이미 쓰는 것), 뒤가 바깥쪽.

    도입   이미 쓰고 있거나 바로 쓸 수 있다
    시험   과제 하나에 걸어 보는 중
    관찰   눈여겨보고 있다. **지켜보기로 정했다**
    감지   목록에 들어왔다. **아직 아무도 안 봤다**        ← 2026-08-26 추가
    보류   봤고, 지금은 아니라고 판단했다

⚠️⚠️ **「감지」와 「관찰」의 차이가 이 층의 요점이다.** 앞엣것은 「누가 넣었다」는
   사실이고 뒤엣것은 **판단**이다. 그 둘이 안 갈려 있어서, 사업부가 검토하고
   동의한 것과 **한 번도 안 열어 본 것**이 화면에서 같아 보였다 — 자료로 재 보니
   역량 63 × 사업부 8 = 504칸 중 **24칸(4.8%)** 만 차 있었는데, 나머지가 전부
   「관찰」로 보였다.

⚠️ 새로 들어오는 것은 **감지**로 시작한다. 소식ㆍMCP 로 들어온 것을 「관찰」이라
   적으면, 아무도 안 본 것을 「지켜보는 중」이라 말하는 셈이다.
"""
STAGES = ('도입', '시험', '관찰', '감지', '보류')

# 아직 아무도 안 본 것. 여러 곳에서 기본값으로 쓴다.
STAGE_NEW = '감지'

# 소식이 어디까지 처리됐나. **거르기만 되고 바꾸는 길이 없으면 죽은 칸이 된다** —
# 실제로 그랬다(2026-08-25 까지 전부 '신규' 였다).
#   신규    아무도 안 읽었다
#   확인됨  사람이 한 번 읽고 쓸모를 판단했다
#   보관    다 본 것. 목록에서 내려도 되지만 지우지는 않는다
NEWS_STATUSES = ('신규', '확인됨', '보관')

# 레이더의 **두 층**.
#
#   capability  역량ㆍ기법. 「explicit 해석」「CFD」「ROM」 — 사업부가 **어디까지 왔나**
#   tool        그 역량을 구현하는 제품. LS-DYNAㆍRADIOSSㆍAbaqus — **무엇으로 하나**
#
# ⚠️⚠️ **왜 나누나.** 도구 단위로만 두면 사업부 비교가 **원리적으로 불가능**하다 —
#    MX 가 LS-DYNA 도입, VD 가 RADIOSS 도입이면 둘 다 「도입」인데 서로 다른 줄이라
#    누가 앞섰는지 읽을 수 없다. 반대로 역량만 두면 **소식이 안 걸린다** — 소식은
#    「Ansys 가 LS-DYNA 에 X 추가」처럼 **도구 이름**으로 들어온다.
#
# ⚠️ 그래서 소식은 **도구**에 걸리고, 그 근거가 **역량으로 굴러 올라간다**
#    (`evidence_stats` 참고). 안 그러면 역량은 근거 0건이라 만들자마자 「낡음」이 된다.
#
# ⚠️ **부모 없는 도구는 레이더에 그대로 뜬다.** 역량 정의가 안 끝나도 모듈이 돌아야
#    한다 — 「먼저 다 정리하라」고 하면 아무도 안 한다.
TECH_KINDS = ('capability', 'tool')

"""
레이더가 「최근 며칠」의 단계 이동을 그릴지. 보는 사람이 고칠 수 있고, 아래 범위로 문다.

⚠️⚠️ **이 숫자는 여기 하나뿐이어야 한다.** 한때 화면(`RadarChart.jsx`)에도 90 이
   박혀 있었고, 요약 막대는 30 으로 따로 세고 있었다 — 막대는 「최근 30일 48」이라
   써 놓고 레이더는 90일 치를 그렸다. 눌러서 뜨는 수와 적힌 수가 다르면 그 막대는
   아무도 안 믿는다.

⚠️ 너무 짧으면 아무것도 안 뜨고, 너무 길면 전부 움직인 것처럼 보여 어느 쪽이든
   신호가 아니게 된다.
"""
MOVED_WINDOW_DAYS = 90
MOVED_WINDOW_MIN, MOVED_WINDOW_MAX = 7, 1095

"""
⚠️⚠️ **칸마다 어느 층의 사실인지 다르다.** 둘 다에 다 보여 주면 채우는 사람이
   「역량의 공급사」 같은 것을 적게 되고, 그 값은 아무 데도 안 쓰이면서 화면만
   어지럽힌다. 규칙은 두 줄이다.

       공급사 · 제품 주소        **도구에만.** 역량은 파는 회사가 없다
       분류 · 얽힌 갈래 · CPT    **레이더에 서는 줄에만**
                                 (= 역량이거나, 아직 안 매단 도구)

   자료로 확인(2026-08-25) — 역량 39개 중 공급사ㆍ주소가 적힌 것 **0개**. 반대로
   매달린 도구는 부채꼴에 안 서는데 116개 전부가 분류를 들고 있었고, 그중 3개는
   상위 역량과 **다른 부채꼴**이었다(FMI/FMU 는 시뮬레이션·해석, 상위는 표준화).
   아무 데도 안 그려지니 어긋난 줄도 몰랐던 것이다.

⚠️ 값을 지우지는 않는다 — 떼어 내면 그 도구가 다시 레이더에 서므로 분류가 필요해진다.
   **안 보이게만** 한다. 다만 공급사ㆍ주소는 역량에 개념적으로 없는 것이라 지운다.
"""


def shows_vendor(kind):
    """공급사ㆍ제품 주소를 보여줄 자리인가 — **도구에만.**"""
    return kind != 'capability'


def shows_sector(kind, linked):
    """분류ㆍ얽힌 갈래ㆍCPT 를 보여줄 자리인가 — **레이더에 서는 줄에만.**

    ⚠️ `linked` 는 「어느 역량엔가 매달렸나」다. 예전엔 `parent_uuid` 였는데, 이제는
       연결이 여럿일 수 있어 **있냐 없냐**로 본다.
    """
    return kind == 'capability' or not linked

# 근거가 이만큼 없으면 낡은 것으로 본다. 단계별로 다르다 —
# '도입'ㆍ'시험' 은 쓰고 있는 것이라 조용해도 이상하지 않지만,
# '관찰' 은 **지켜보겠다고 해 놓고 안 보고 있다는 뜻**이라 빨리 걸려야 한다.
#
# ⚠️⚠️ **'감지' 는 낡음을 아예 안 잰다**(None). 「아직 아무도 안 봤다」는 상태라
#    낡을 것이 없다 — 재면 아무도 안 본 50여 개가 반년 뒤 **한꺼번에 켜져** 낡음
#    표시가 신호가 아니라 잡음이 된다. 이 모듈의 자정 장치를 스스로 망가뜨리는 셈이다.
STALE_DAYS = {'도입': 540, '시험': 270, '관찰': 180, '감지': None, '보류': 365}
STALE_DAYS_DEFAULT = 270

# 레이더의 **부채꼴**. 기술 하나는 여기서 딱 하나에 속한다 — 자리를 정해야 그림이
# 그려지기 때문이다. 얽힌 나머지 갈래는 `tags` 로 남긴다.
#
# ⚠️ **이건 우리가 정한 갈래다.** 업계 공식 분류가 아니다(2026-08-25 조사 —
#    DTC CPT 는 「능력」을, ISO 23247 은 「구성요소」를 나눈 것이라 축이 다르다).
#    설정에서 늘릴 수 있게 두되, 기본값이 무엇을 뜻하는지는 여기 적어 둔다.
#
# ⚠️ 「시각화」를 일부러 뺐다. 디지털 트윈의 능력으로는 중요하지만 UnityㆍUnrealㆍ
#    WebGL 이 이미 성숙해 **전략을 바꾸지 않는다.** 현장 XR 항목이 쌓이면 그때 뺀다 —
#    지금 만들면 한두 개짜리 빈 부채꼴이 된다.
DEFAULT_SECTORS = [
    '시뮬레이션·해석',   # 무엇을 푸나 — 구조·유동·열·음향·전자기·공정·시스템
    '모델 신뢰·운영',    # 그 모델을 **믿고 돌리는 일** — V&V·UQ·동기화·ROM·메시·HPC·SDM
    '데이터·연결',       # OPC UA · MQTT · 센서 · 시계열 · 엣지 · 현실 캡처
    'AI',                # 대리모델 · PINN · 이상탐지 · 생성형
    '플랫폼',            # Omniverse · 3DEXPERIENCE · ThingWorx · PLM 연계
    '표준화',            # OpenUSD · AAS · ISO 23247 · FMI · ASME V&V
]

"""
⚠️⚠️ **「모델 신뢰·운영」을 왜 따로 뒀나** (2026-08-25 추가).

   앞의 다섯으로는 **디지털 트윈을 트윈이게 하는 것들이 갈 곳이 없었다.**

       모델 검증·보정(V&V)   해석이 실물과 얼마나 맞나 — 없으면 「시뮬레이션」이지
                             「트윈」이 아니다
       불확실성 정량화(UQ)    그 답을 얼마나 믿을 수 있나
       실시간 동기화·상태추정  트윈이 실물을 **따라가게** 하는 바로 그 장치
       메시·재료·HPC·SDM     해석이 실제로 돌아가려면 있어야 하는 바닥

   이것들은 「무엇을 푸나」(시뮬레이션·해석)도 아니고 「데이터를 어떻게 나르나」
   (데이터·연결)도 아니다. 억지로 끼워 넣으면 그 부채꼴의 뜻이 흐려진다.

   ⚠️ 붙여 둔 DTC CPT 태그가 같은 말을 했다 — **신뢰성 6개 · 관리 7개**로 여섯 묶음
      중 가장 얇았고, 빠진 것들이 정확히 거기 살았다. 우연이 아니다.
"""


# Digital Twin Consortium — **Capabilities Periodic Table v1.1** 의 여섯 묶음.
#
# ⚠️ **우리 분류가 아니라 외부 표준이라 값이 고정이다.** 설정에서 못 늘린다 —
#    늘리는 순간 「업계 기준으로 우리가 어디를 보고 있나」를 못 센다.
# ⚠️ 부채꼴과 **축이 다르다.** CPT 는 「디지털 트윈이 할 줄 알아야 하는 능력」이라
#    기술 하나가 여러 개에 걸린다(Omniverse = UX + Integration + Data Services).
#    그래서 **여러 개 붙일 수 있는 태그**로 둔다.
CPT_GROUPS = [
    ('Data Services', '데이터 서비스'),      # 수집·변환·처리
    ('Integration', '통합'),                  # 다른 시스템과의 연결
    ('Intelligence', '지능'),                 # 분석·AI·기계학습
    ('User Experience', '사용자 경험'),       # 화면·시각화
    ('Management', '관리'),                   # 시스템·생태계 운영
    ('Trustworthiness', '신뢰성'),            # 보안·안전·신뢰성·책임
]
CPT_KEYS = tuple(k for k, _ in CPT_GROUPS)


class IntelNews(BaseModel):
    """바깥 소식 하나.

    ⚠️ `published_at` 과 `created_at` 은 **다른 것**이다. 옛 글도 뒤늦게 들어온다.
       목록을 `created_at` 으로 세우면 3년 전 논문이 오늘 것처럼 맨 위에 선다.
    """
    __tablename__ = 'dt_intel_news'

    uuid = db.Column(db.String(36), unique=True, nullable=False, index=True)

    title = db.Column(db.String(500), nullable=False)
    summary = db.Column(db.Text)          # 서너 줄. 목록에서 이것만 읽고 넘어간다
    body = db.Column(db.Text)             # 발췌·전문. 원문이 사라져도 남는다

    source = db.Column(db.String(200))    # 매체 이름 ("Gartner", "NVIDIA 블로그")
    url = db.Column(db.String(1000))
    published_at = db.Column(db.Date, index=True)

    # 분류·태그는 **설정에서 늘린다**(ModuleSettings). 코드에 박으면 조직이 바뀔 때
    # 화면이 조용히 틀어진다 — 투자 모듈의 `category2` 와 같은 방식이다.
    category = db.Column(db.String(50), index=True)
    tags = db.Column(JSONB, default=list)
    divisions = db.Column(JSONB, default=list)   # 관련 사업부

    origin = db.Column(db.String(20), nullable=False, default='ui', index=True)
    # 신규 → 확인됨 → 보관. 「확인됨」은 사람이 한 번 읽었다는 뜻이다.
    status = db.Column(db.String(20), nullable=False, default='신규', index=True)

    created_by = db.Column(db.Integer, index=True)

    __table_args__ = (
        db.Index('ix_dt_intel_news_pub_desc', 'published_at', 'id'),
    )

    def to_dict(self, evidence=None, with_body=False):
        """
        ⚠️ **목록에서는 본문을 뺀다**(`with_body=False`). 기사 전문이 수백 건이면
           응답이 메가바이트 단위가 되는데, 목록은 제목과 요약만 읽는 자리다.
           대신 **보관돼 있는지**(`hasBody`)와 길이는 알려 준다 — 그래야 화면이
           「원문 보관됨」 표시를 낼 수 있다.
        """
        d = super().to_dict()
        d['uuid'] = self.uuid
        body = d.pop('body', None)
        d['hasBody'] = bool((self.body or '').strip())
        d['bodyLength'] = len(self.body or '')
        if with_body:
            d['body'] = body
        # ⚠️ `published_at` 은 `Date` 라 `BaseModel.to_dict` 의 datetime 변환에
        #    안 걸린다. 그대로 두면 Flask 가 HTTP 날짜(`Thu, 13 Aug 2026 00:00:00
        #    GMT`)로 직렬화하고, 그 문자열이 **화면에 그대로 찍힌다**(2026-08-25 실측).
        d['published_at'] = self.published_at.isoformat() if self.published_at else None
        d['publishedAt'] = d['published_at']
        if evidence is not None:
            d['technologies'] = evidence
        return d

    def __repr__(self):
        return f'<IntelNews {self.uuid[:8]} {self.title[:30]!r}>'


class IntelTech(BaseModel):
    """기술 레이더의 한 줄.

    ⚠️ **별칭이 중요하다.** 같은 기술이 기사마다 다른 이름으로 나온다
       (Omniverse / NVIDIA Omniverse / OV). 별칭이 없으면 같은 기술이 세 줄이 되고,
       세 줄이 되는 순간 레이더는 목록이 아니라 잡동사니가 된다.
    """
    __tablename__ = 'dt_intel_tech'

    uuid = db.Column(db.String(36), unique=True, nullable=False, index=True)

    name = db.Column(db.String(300), nullable=False)
    aliases = db.Column(JSONB, default=list)
    vendor = db.Column(db.String(300))

    category = db.Column(db.String(50), index=True)   # 시뮬레이션 / 데이터 / 플랫폼 …
    # 공식 문서·제품 주소. **레이더에서 가장 자주 눌리는 칸이다** — 목적이 참고인데
    # 이름과 요약만 있으면 더 알아보려고 결국 검색을 다시 해야 한다.
    url = db.Column(db.String(1000))
    """
    ⚠️⚠️ **역량은 단계가 없다**(2026-08-26). 단계는 「누가 어디까지 왔나」인데
       그건 사업부마다 다르고, 회사 전체의 답이라는 것이 없다. 예전에 「기본
       설정」을 두었더니 아무도 안 적은 역량 48개가 전부 그 값 하나로 레이더에
       뭉쳐 그림이 안 읽혔다. 이제 **역량은 비어 있고, 단계는 사업부 줄에만 산다.**

    ⚠️ 도구는 그대로 값을 갖는다 — 도구의 단계는 「이 제품이 우리 손에 어디까지
       들어와 있나」라 하나로 말이 된다.
    """
    stage = db.Column(db.String(20), nullable=True, index=True)
    # 그 단계로 정한 **이유**. 특히 '보류' 에서 비면 안 된다 — 왜 안 쓰기로 했는지가
    # 사라지면 6개월 뒤 같은 논의를 처음부터 다시 한다.
    stage_reason = db.Column(db.Text)
    stage_changed_at = db.Column(db.DateTime)

    summary = db.Column(db.Text)
    description = db.Column(db.Text)
    divisions = db.Column(JSONB, default=list)

    # 부채꼴(`category`)은 하나뿐이라 **얽힌 갈래를 여기 남긴다.**
    # OPC UA = 데이터·연결(자리) + 표준화(태그) 처럼.
    tags = db.Column(JSONB, default=list)
    # DTC Capabilities Periodic Table v1.1 의 여섯 묶음 중 해당하는 것들.
    cpt = db.Column(JSONB, default=list)

    # capability | tool. 기본은 tool — 들어오는 것의 대부분이 제품이다.
    kind = db.Column(db.String(16), nullable=False, default='tool', index=True)
    """
    ⚠️⚠️ **도구가 속한 역량은 여기 없다.** 한때 `parent_uuid` 칸 하나였는데, 실제로는
       **한 도구가 여러 역량에 걸친다** — 자료로 세어 보니 546개 중 58개(11%)가
       그랬다(MATLAB/Simulink 는 1D 시스템ㆍ제어 검증ㆍ대리모델ㆍ예지보전에 걸친다).
       `dt_intel_tech_capability` 연결 표가 정본이다.

    ⚠️ 「중복 셈이 문제」라고 미뤄 뒀던 걱정은 **코드를 훑어 보니 없었다** — 근거 셈은
       역량마다 따로 세고 **어디에서도 합치지 않으며**, 낡음 판정은 건수가 아니라
       **마지막 시각(MAX)** 을 본다. 같은 소식이 세 역량을 함께 떠받치는 것은
       사실이고, 셋이 각각 「3건」이라 말하는 것이 맞다.
    """

    origin = db.Column(db.String(20), nullable=False, default='ui', index=True)
    is_archived = db.Column(db.Boolean, nullable=False, default=False, index=True)

    created_by = db.Column(db.Integer, index=True)

    def stale_after_days(self, stage=None):
        """⚠️ **어느 단계로 보느냐에 따라 기준 일수가 다르다.** 사업부별 단계가
           걸린 줄은 그 사업부의 단계로 재야 한다 — 기본 설정이 「도입」(540일)인데
           우리 사업부는 「관찰」(180일)이면, 우리한테는 벌써 낡은 것이다.
        """
        key = stage or self.stage
        """
        ⚠️⚠️ **단계가 아예 없으면 낡을 것도 없다.** 역량이 그렇다 — 아무도 「여기
           있다」고 말한 적이 없는데 「그 말이 낡았다」고 할 수는 없다. 기본값
           270일을 물리면 역량 63개가 만들자마자 죄다 「낡음」이 된다.
        """
        if not key:
            return None
        return STALE_DAYS[key] if key in STALE_DAYS else STALE_DAYS_DEFAULT

    def is_stale(self, last_evidence_at=None, now=None, stage=None):
        """근거가 오래 없으면 낡은 것으로 본다.

        ⚠️ **이 판정이 이 모듈의 자정 장치다.** 앞선 세 번의 시도는 낡아도 낡은 줄
           몰랐다. 화면이 스스로 「이 줄은 N개월째 근거가 없다」고 말해야 한다.

        `last_evidence_at` 이 None 이면 근거가 한 건도 없다는 뜻이라, **만든 지**
        오래됐는지로 본다(넣어만 두고 아무도 안 쓴 줄).
        """
        days = self.stale_after_days(stage)
        if days is None:
            return False        # '감지' — 아직 아무도 안 봤으니 낡을 것이 없다
        now = now or datetime.utcnow()
        base = last_evidence_at or self.stage_changed_at or self.created_at
        if base is None:
            return False
        return (now - base) > timedelta(days=days)

    def to_dict(self, last_evidence_at=None, evidence_count=None, now=None,
                children=None, capabilities=None, division=None,
                division_stage=None, division_tools=None):
        d = super().to_dict()
        d['uuid'] = self.uuid
        """
        ⚠️ 속한 역량은 **이름까지** 함께 준다. uuid 만 주면 화면이 「어느 역량인가」를
           보여주려고 기술 목록 전체를 뒤져야 하고, 걸러 본 목록에는 그 역량이 아예
           없을 수도 있다 — 그러면 빈칸이 뜬다.
        ⚠️ **여럿일 수 있다.** 하나만 골라 보내면 「MATLAB 은 1D 시스템」이라고만
           말하게 되고, 제어 검증 쪽에서 찾는 사람은 못 찾는다.
        """
        if capabilities is not None:
            d['capabilities'] = capabilities
            d['capabilityUuids'] = [c['uuid'] for c in capabilities]
        if children is not None:
            d['children'] = children
        """
        ⚠️⚠️ **사업부 눈으로 볼 때는 `stage` 를 그 사업부 값으로 바꿔 내보낸다.**
           화면이 두 값(기본 설정ㆍ사업부) 중 무엇을 그릴지 고르게 하면 레이더ㆍ목록ㆍ
           상세가 서로 다른 것을 그리게 된다 — 낡음 판정을 서버가 하는 것과 같은
           이유다. **고르는 일은 서버에서 한 번만 한다.**
        """
        """
        ⚠️ 역량이면 비어서 나간다 — 역량은 단계를 안 갖는다. 키 자체는 남긴다:
           없애면 화면이 `undefined` 와 「아직 안 정함」을 구별 못 한다.
        """
        d['companyStage'] = self.stage
        if division:
            d['division'] = division
            d['isDivisionOverride'] = bool(division_stage and division_stage.stage)
            if division_stage:
                if division_stage.stage:
                    d['stage'] = division_stage.stage
                d['divisionStageReason'] = division_stage.reason
                d['divisionTools'] = division_tools or []
                d['divisionStageAt'] = (
                    division_stage.changed_at.isoformat()
                    if division_stage.changed_at else None)
        eff = d['stage']
        d['staleAfterDays'] = self.stale_after_days(eff)
        d['isStale'] = self.is_stale(last_evidence_at, now=now, stage=eff)
        if last_evidence_at is not None:
            d['lastEvidenceAt'] = last_evidence_at.isoformat()
        if evidence_count is not None:
            d['evidenceCount'] = evidence_count
        return d

    def __repr__(self):
        return f'<IntelTech {self.uuid[:8]} {self.name!r} {self.stage}>'


class IntelEvidence(BaseModel):
    """소식이 기술을 떠받치는 자리. **이 표가 레이더를 살린다.**

    ⚠️ 이게 없으면 레이더는 「누가 왜 그렇게 판단했는지 모르는 표」가 된다. 그것이
       앞선 세 번이 죽은 방식이다 — 단계는 적혀 있는데 근거가 없어 아무도 못 고치고,
       못 고치니 낡고, 낡으니 안 본다.

    ⚠️ FK 를 걸지 않는다. 소식이 지워져도 「그때 이런 근거가 있었다」는 남아야 한다
       (투자 이력이 FK 를 안 거는 것과 같은 이유).
    """
    __tablename__ = 'dt_intel_evidence'

    news_uuid = db.Column(db.String(36), nullable=False, index=True)
    tech_uuid = db.Column(db.String(36), nullable=False, index=True)

    # 이 소식이 그 기술에 대해 **무엇을 말하는지** 한 줄. 제목만으로는 6개월 뒤
    # 왜 이었는지 알 수 없다.
    note = db.Column(db.Text)
    created_by = db.Column(db.Integer, index=True)
    source = db.Column(db.String(20), nullable=False, default='ui')

    __table_args__ = (
        db.UniqueConstraint('news_uuid', 'tech_uuid', name='uq_dt_intel_evidence'),
    )

    def __repr__(self):
        return f'<IntelEvidence {self.news_uuid[:8]}→{self.tech_uuid[:8]}>'


class IntelChange(BaseModel):
    """무엇이 언제 왜 바뀌었나 — **지금은 레이더 단계 이동만** 남긴다.

    ⚠️ 단계를 「조직의 판단」이라며 관리자ㆍ사무국으로 좁혀 놓고 **그 판단의 기록이
       없었다.** `stage`ㆍ`stage_reason` 은 **지금 값**만 들고 있어서, 「왜 작년에
       도입이었다가 보류로 내려갔지」에 답할 수 없다. 판단을 좁혔으면 그 판단이
       남아야 한다 — 안 남으면 좁힌 의미가 절반이다.

    ⚠️ FK 를 걸지 않는다. 기술이 지워져도 「그때 이런 판단이 있었다」는 남아야 한다
       (`dt2_project_changes`ㆍ`dt_investment_changes` 와 같은 판단).
    """
    __tablename__ = 'dt_intel_changes'

    subject_kind = db.Column(db.String(10), nullable=False, index=True)   # tech | news
    subject_uuid = db.Column(db.String(36), nullable=False, index=True)
    # 지워져도 무엇에 대한 기록인지 알아야 한다.
    subject_name = db.Column(db.String(300))

    field = db.Column(db.String(30), nullable=False)      # stage · status …
    # ⚠️ **어느 사업부의 판단인가.** 비어 있으면 기본 설정이다. `field` 에 사업부 이름을
    #    이어 붙이는 것(`stage:MX`)도 생각했지만, 그러면 「단계 이력」을 뽑는 모든
    #    질의가 문자열을 쪼개야 하고 한 번만 빠뜨려도 기본 설정과 사업부가 뒤섞인다.
    scope = db.Column(db.String(100), index=True)
    before_value = db.Column(db.String(200))
    after_value = db.Column(db.String(200))
    reason = db.Column(db.Text)

    actor_user_id = db.Column(db.Integer, index=True)
    actor_name = db.Column(db.String(100))
    source = db.Column(db.String(20), nullable=False, default='ui')

    def to_dict(self):
        d = super().to_dict()
        return d

    def __repr__(self):
        return (f'<IntelChange {self.subject_kind}:{self.subject_uuid[:8]} '
                f'{self.field} {self.before_value}→{self.after_value}>')


class IntelTechCapability(BaseModel):
    """**도구 ↔ 역량 연결.** 한 도구가 여러 역량에 걸칠 수 있다.

    ⚠️⚠️ 이 표가 정본이다. 예전의 `dt_intel_tech.parent_uuid` 를 갈음한다 —
       칸 하나로는 「MATLAB 은 1D 시스템이면서 제어 검증이기도 하다」를 적을 수 없었다.

    ⚠️ **연결이 하나도 없는 도구는 「미아」**다. 레이더에 혼자 서지만 어느 사업부
       표에도 안 나온다 — 그 성질은 그대로다(예전에는 `parent_uuid IS NULL`).

    ⚠️ FK 를 안 건다. 나머지 표와 같은 이유이고, 지우는 자리에서 손으로 추스른다
       (`remove_tech` · `merge_tech`).
    """
    __tablename__ = 'dt_intel_tech_capability'
    __table_args__ = (
        # ⚠️ 같은 짝이 두 줄이면 「도구 3개」가 4개로 세어진다.
        db.UniqueConstraint('tech_uuid', 'capability_uuid',
                            name='uq_intel_tech_capability'),
    )

    tech_uuid = db.Column(db.String(36), nullable=False, index=True)
    capability_uuid = db.Column(db.String(36), nullable=False, index=True)

    def __repr__(self):
        return (f'<IntelTechCapability {self.tech_uuid[:8]}'
                f'→{self.capability_uuid[:8]}>')


class IntelDivisionStage(BaseModel):
    """**사업부별 단계 — 기본 설정과 다를 때만** 한 줄 남긴다.

    ⚠️⚠️ **기본 설정 값이 정본이고, 여기 있는 것은 예외뿐이다.** 사업부 8개 × 역량 39개
       = 312칸을 채우게 하면 아무도 안 채우고, 채운 것도 곧 낡아 **표 전체를 못
       믿게 된다.** 없으면 기본 설정 값을 쓴다 — 그래서 「아직 안 정함」과 「기본 설정과 같음」이
       같은 뜻이 되고, 그게 맞다.

    ⚠️ 이 표가 있어야 사업부 비교가 성립한다. 도구 단위로는 원리적으로 불가능하다 —
       MX 가 LS-DYNA 도입, VD 가 RADIOSS 도입이면 둘 다 「도입」인데 서로 다른
       줄이라 누가 앞섰는지 읽을 수 없다. **같은 역량 한 줄에 사업부별 값**이
       붙어야 비로소 견줄 수 있다.

    ⚠️ 역량뿐 아니라 도구에도 걸 수 있다. 역량에 걸면 「우리 사업부는 어디까지
       왔나」, 도구에 걸면 「어느 사업부가 무엇을 쓰나」 — 묻는 것이 다르지만
       **장치는 하나면 된다.**

    ⚠️ FK 를 안 건다. 사업부 이름은 포털의 사업부 표를 **값으로** 들고 있는다 —
       기술이 지워져도 「그때 이 사업부는 이랬다」는 판단 기록이 남아야 한다
       (`dt_intel_changes` 와 같은 판단).
    """
    __tablename__ = 'dt_intel_division_stage'
    __table_args__ = (
        db.UniqueConstraint('tech_uuid', 'division',
                            name='uq_intel_division_stage'),
    )

    tech_uuid = db.Column(db.String(36), nullable=False, index=True)
    division = db.Column(db.String(100), nullable=False, index=True)
    """
    ⚠️⚠️ **비어 있으면 「기본 설정을 따른다」**는 뜻이고, 그때도 줄은 남을 수 있다 —
       도구나 메모를 적어 두려고. 예외를 만들어야만 도구를 적을 수 있으면 가장 흔한
       경우(기본 설정 도입 · 우리도 도입 · 도구는 LS-DYNA)를 **아예 못 적는다.**

           None      기본 설정을 따른다. 기본 설정이 움직이면 같이 움직인다
           '도입'     기본 설정과 다르게 본다 (예외)
    """
    stage = db.Column(db.String(10))
    # ⚠️⚠️ **이유 없이 예외를 만들 수 없다**(서비스가 막는다). 단계만 바꿔 놓고
    #    왜 그런지가 없으면, 이 표는 앞선 세 번의 시도와 똑같아진다 — 적혀는 있는데
    #    아무도 왜인지 모르는 표.
    reason = db.Column(db.Text)
    # 그 사업부가 이 역량을 **무엇으로 하나.** 기술 uuid 목록.
    # ⚠️ 단계만 있고 도구가 없으면 「MX 도입」이 무슨 뜻인지 6개월 뒤에 모른다.
    tools = db.Column(JSONB, default=list)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    changed_by = db.Column(db.Integer)

    def follows_company(self):
        """기본 설정을 따르는 줄인가. 도구ㆍ메모만 담고 단계는 안 정한 상태."""
        return not self.stage

    def is_empty(self):
        """⚠️ 아무것도 안 담긴 줄은 **지워야 한다** — 안 지우면 「다르게 보는 사업부」
           셈이 부풀고, 그 숫자가 이 화면의 답이라 곧바로 못 믿게 된다."""
        return (self.follows_company() and not (self.reason or '').strip()
                and not (self.tools or []))

    def to_dict(self, tool_names=None):
        d = super().to_dict()
        d['changed_at'] = self.changed_at.isoformat() if self.changed_at else None
        d['changedAt'] = d['changed_at']
        d['followsCompany'] = self.follows_company()
        if tool_names is not None:
            # ⚠️ uuid 만 주면 화면이 이름을 찾으러 목록 전체를 뒤져야 한다. 없어진
            #    도구는 여기서 조용히 빠진다 — 그게 FK 를 안 건 값이다.
            d['toolNames'] = tool_names
        return d

    def __repr__(self):
        return (f'<IntelDivisionStage {self.division} '
                f'{self.tech_uuid[:8]} {self.stage}>')


class IntelLink(BaseModel):
    """소식·기술을 **포털 안쪽**과 잇는다. 이게 없으면 북마크 목록이다.

        과제        이 기술이 우리 어느 과제와 관련 있나
        KPI         어느 지표를 움직일 만한가
        보유 SW     `sw_resources` — **이미 라이선스가 있는지**. 「관찰」로 적어 둔
                    기술을 우리가 이미 사 놨는데 아무도 모르는 경우를 잡는다.

    ⚠️ `target_ref` 는 문자열이다. 과제는 uuid, KPI 는 정의 id, SW 는 id 라 타입이
       제각각이다. 표를 셋으로 나누는 대신 종류를 함께 들고 있는다.
    """
    __tablename__ = 'dt_intel_links'

    subject_kind = db.Column(db.String(10), nullable=False, index=True)   # news | tech
    subject_uuid = db.Column(db.String(36), nullable=False, index=True)

    target_kind = db.Column(db.String(20), nullable=False, index=True)    # project | kpi | sw
    target_ref = db.Column(db.String(64), nullable=False, index=True)

    relevance = db.Column(db.Text)     # 왜 관련 있는지 한 줄
    created_by = db.Column(db.Integer, index=True)
    source = db.Column(db.String(20), nullable=False, default='ui')

    __table_args__ = (
        db.UniqueConstraint('subject_kind', 'subject_uuid', 'target_kind', 'target_ref',
                            name='uq_dt_intel_link'),
    )

    def __repr__(self):
        return (f'<IntelLink {self.subject_kind}:{self.subject_uuid[:8]} '
                f'→ {self.target_kind}:{self.target_ref}>')
