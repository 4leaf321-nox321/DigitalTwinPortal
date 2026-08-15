"""
Survey Module — 포탈 공용 설문.

**어느 모듈에도 의존하지 않는다.** 전략 기획이 첫 사용처일 뿐이고, 설문 자체는
누구든 쓸 수 있다. 그래서 전략 모듈을 import 하지 않고, 어디에 매달린
설문인지는 `context_type`/`context_id` 두 칸으로만 들고 있는다(models.py).

    manage_bp   /api/surveys/manage/...   사무국·관리자 — 만들기·배포·집계
    respond_bp  /api/surveys/...          전원 — 내가 받은 설문에 응답

계획서: frontend/src/modules/digital-twin-strategy/SURVEY_PLAN.md
"""
from .routes import admin_bp as manage_bp, respond_bp

from .models import (  # noqa: F401
    Survey, SurveyQuestion, SurveyResponse, SurveyAnswer, SurveyAccessLog,
)

__all__ = [
    'manage_bp', 'respond_bp',
    'Survey', 'SurveyQuestion', 'SurveyResponse', 'SurveyAnswer',
    'SurveyAccessLog',
]
