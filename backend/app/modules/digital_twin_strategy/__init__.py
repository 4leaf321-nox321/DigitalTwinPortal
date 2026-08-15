"""
Digital Twin Strategy Module
디지털 트윈 전략 기획 — 연도별 전략 수립

계획서: frontend/src/modules/digital-twin-strategy/PLAN.md
"""
from .routes import bp

# 마이그레이션이 테이블을 인식하려면 모델이 import 되어 있어야 한다.
# routes 가 쓰지 않는 모델도 여기서 잡아준다.
from .models import (  # noqa: F401
    StrategyPlan, StrategyAssessment, StrategyMetricTarget,
    StrategyCrux, StrategyIssue, StrategyEvidence,
)

__all__ = [
    'bp', 'StrategyPlan', 'StrategyAssessment', 'StrategyMetricTarget',
    'StrategyCrux', 'StrategyIssue', 'StrategyEvidence',
]
