"""
API 로 내보내는 시각을 **KST 로 못 박는다.**

무엇이 문제였나
    DB 는 `datetime.utcnow()`(naive UTC)로 저장한다. 그런데 직렬화가 그냥
    `.isoformat()` 이라 **"이게 UTC 다" 라는 표시가 빠진 채** 나갔다:

        '2026-08-01T20:29:34.106077'      ← 오프셋 없음

    JS 명세상 **오프셋이 없는 날짜-시간 문자열은 로컬로 해석**된다. 그래서 화면은
    이 값을 KST 벽시계 20:29 로 읽는다. 실제 시각은 2026-08-02 05:29 KST 다.
    **모든 서버 시각이 9시간 이르게 표시됐다.** 상대 시간도 같이 틀려서, 방금
    만든 항목이 '9시간 전' 으로 떴다. (2026-08-02 실측)

무엇으로 고쳤나
    나가는 값에 **KST 오프셋을 붙인다.**

        '2026-08-02T05:29:34.106077+09:00'

    이러면 값 자체가 시간대를 말하므로 브라우저 설정과 무관하게 어긋나지 않는다.
    `Z`(UTC)로 내보내도 화면 표시는 맞지만, 이 시스템은 **사용자에게 항상 한국시간을
    보여주는 것**이 요구사항이라 KST 로 붙인다 — 값만 봐도 한국시간임이 드러난다.
    (auth 의 접속이력과 tech_level 이 이미 이 방식이었다. 그 선례를 따른다)

⚠️ **`date`(날짜 전용) 는 그대로 둔다.** 회의 일정일·마감일 같은 값에 시간대를 붙이면
   '2026-08-02' 가 '2026-08-02T00:00+09:00' 이 되어 뜻이 달라진다. 그래서 이 함수는
   **타입을 보고 스스로 판단한다** — 호출부가 datetime 인지 date 인지 몰라도 안전하다.
"""

from datetime import date, datetime, timedelta, timezone

# 한국 표준시. 서머타임이 없어 고정 오프셋으로 충분하다
# (ZoneInfo 는 Windows 에서 tzdata 패키지가 따로 필요해 배포가 번거롭다).
KST = timezone(timedelta(hours=9))


def iso_kst(value):
    """
    시각을 **KST ISO 문자열**로. API 응답에 시각을 담을 때는 항상 이걸 쓴다.

        naive datetime  → UTC 로 간주하고 KST 로 변환 (DB 가 utcnow 로 저장하므로)
        aware datetime  → KST 로 변환
        date            → 그대로 (시간대 개념이 없다)
        None            → None
        그 외            → 손대지 않고 그대로 (이미 문자열인 경우 등)
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(KST).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def kst_date(value):
    """
    시각을 **KST 기준 'YYYY-MM-DD'** 로. 날짜별로 묶어 세는 화면이 쓴다.

    ⚠️ naive datetime 을 `str(value)[:10]` 으로 자르면 **UTC 날짜**가 나온다.
       DB 가 `utcnow()` 로 저장하므로, **KST 00:00~08:59 에 일어난 일이 전날로**
       찍힌다. 하루 경계에서만 틀려서 눈에 잘 안 띄는데, 그날 아침에 한 일이
       통째로 어제 칸에 가 있는다. (2026-08-09 「과제·성과 추이」에서 발견)
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(KST).date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)[:10]


def today_kst():
    """
    오늘(KST) `date`.

    `date.today()` 를 안 쓰는 이유: 그건 **서버의 로컬 시간대**를 따른다.
    개발 PC 는 KST 라 맞아 보이지만 운영 서버가 UTC 면 조용히 하루가 어긋난다.
    """
    return datetime.now(timezone.utc).astimezone(KST).date()


def now_kst_iso():
    """지금(KST) ISO 문자열. 응답에 '생성 시각' 을 새로 만들어 넣을 때 쓴다."""
    return datetime.now(timezone.utc).astimezone(KST).isoformat()


def now_utc_iso_z():
    """
    지금(UTC) ISO 문자열 + `Z`. **JSON 안에 저장되는 값**에는 이걸 쓴다.

    왜 여기만 KST 가 아닌가
        `updatedAt`·`_deletedAt` 같은 값은 화면에 보여주는 것이 아니라 **비교에 쓴다**
        (덮어쓰기 방지). 그런데 같은 필드를 **화면도 쓴다** — 프론트는
        `new Date().toISOString()`, 즉 **UTC + Z** 로 넣는다.
        서버만 KST 로 넣으면 한 필드에 두 표기가 섞인다. 기준을 프론트에 맞춘다.

        중요한 건 KST 냐 UTC 냐가 아니라 **오프셋이 붙어 있느냐**다. 붙어 있으면
        어느 쪽이든 화면은 정확히 한국시간으로 보여준다. 예전 값에는 그게 없어서
        9시간 어긋났다.
    """
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
