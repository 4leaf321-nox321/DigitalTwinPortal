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
STAGES = ('도입', '시험', '관찰', '보류')

# 근거가 이만큼 없으면 낡은 것으로 본다. 단계별로 다르다 —
# '도입'ㆍ'시험' 은 쓰고 있는 것이라 조용해도 이상하지 않지만,
# '관찰' 은 **지켜보겠다고 해 놓고 안 보고 있다는 뜻**이라 빨리 걸려야 한다.
STALE_DAYS = {'도입': 540, '시험': 270, '관찰': 180, '보류': 365}
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
    '시뮬레이션·해석',   # CAE · CFD · 멀티피직스 · ROM · 시스템 시뮬레이션
    '데이터·연결',       # OPC UA · MQTT · 센서 · 시계열 · 엣지
    'AI',                # 대리모델 · PINN · 이상탐지 · 생성형
    '플랫폼',            # Omniverse · 3DEXPERIENCE · ThingWorx · PLM 연계
    '표준화',            # OpenUSD · AAS · ISO 23247 · FMI
]

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
    stage = db.Column(db.String(20), nullable=False, default='관찰', index=True)
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

    origin = db.Column(db.String(20), nullable=False, default='ui', index=True)
    is_archived = db.Column(db.Boolean, nullable=False, default=False, index=True)

    created_by = db.Column(db.Integer, index=True)

    def stale_after_days(self):
        return STALE_DAYS.get(self.stage, STALE_DAYS_DEFAULT)

    def is_stale(self, last_evidence_at=None, now=None):
        """근거가 오래 없으면 낡은 것으로 본다.

        ⚠️ **이 판정이 이 모듈의 자정 장치다.** 앞선 세 번의 시도는 낡아도 낡은 줄
           몰랐다. 화면이 스스로 「이 줄은 N개월째 근거가 없다」고 말해야 한다.

        `last_evidence_at` 이 None 이면 근거가 한 건도 없다는 뜻이라, **만든 지**
        오래됐는지로 본다(넣어만 두고 아무도 안 쓴 줄).
        """
        now = now or datetime.utcnow()
        base = last_evidence_at or self.stage_changed_at or self.created_at
        if base is None:
            return False
        return (now - base) > timedelta(days=self.stale_after_days())

    def to_dict(self, last_evidence_at=None, evidence_count=None, now=None):
        d = super().to_dict()
        d['uuid'] = self.uuid
        d['staleAfterDays'] = self.stale_after_days()
        d['isStale'] = self.is_stale(last_evidence_at, now=now)
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
