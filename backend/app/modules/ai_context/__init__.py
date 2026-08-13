"""
AI Context Module - Provides structured page context for AI assistant

🚦 **이건 옛 채팅(`AiChatSidebar`)의 보조 API 다. 에이전트와 관계없다.**
    · 여기(`/api/ai/*`)      브라우저가 `/llm` 을 직접 부르던 일반 대화용 페이지 맥락·분석
    · `/api/dt-v2/ai/agent`  백엔드가 LLM 을 부르고 **도구를 실행**하는 에이전트 (Phase 5)
    경로가 비슷하지만 다른 물건이다.

    ⚠️ **2026-08-01 에 `AiChatSidebar` 를 화면에서 내렸다** → 지금 이 API 를 부르는 화면이 없다.
       코드는 되살릴 수 있게 남겨 뒀다. 지우기 전에 루트 `디지털트윈_AI기능_지도.md` 를 볼 것.
"""
from flask import Blueprint

bp = Blueprint('ai_context', __name__)

from app.modules.ai_context import routes  # noqa
