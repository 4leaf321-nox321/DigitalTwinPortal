"""
디지털 트윈 대시보드 — V2 이관 시험용 합성 데이터 생성 (Phase 2-4)

왜 필요한가
    운영 데이터는 반출할 수 없어 개발서버로 가져와 리허설할 수 없다(실행계획 2.6.3).
    개발 DB 는 깨끗한 편이라 이관 스크립트의 **예외 처리 경로가 한 번도 실행되지 않는다**.
    그래서 실제로 있었거나 있을 법한 예외를 **일부러 심은** 데이터셋을 만들어
    이관·검증 스크립트가 견디는지 확인한다.

심는 예외 (전부 운영 스캔에서 실제로 관찰됐거나 코드상 가능한 것)
    A. 레거시 성과 참조 3종 혼재   성과항목UUID / 성과항목ID / id / 성과UUID
    B. 고아 참조                    존재하지 않는 성과를 지목
    C. updatedAt 결측               개발 60% / 운영 0% — 둘 다 견뎌야 한다
    D. 모르는 키                    인벤토리에 없는 필드 → extra_fields 로 가야 함
    E. 타입 흔들림                  숫자가 문자열로, 불리언이 "TRUE"/"1" 로
    F. 삭제·영구삭제 상태
    G. 중복 참조                    같은 성과를 두 번 가리킴
    H. 빈 값 계열                   null / "" / [] / {}
    I. 사업부 미매칭                divisions 에 없는 값
    J. 선행과제 고아                존재하지 않는 과제 지목
    K. 이미지 참조                  Phase 1-2 이후 형태(imageId)
    L. 성과 소프트 삭제             _deleted 계열 4키
    M. 실적_N월 평면 키             월별실적 배열과 이중 표현
    N. UI 런타임 상태               isEditing / _idChanged → 이관 제외돼야 함

사용법
    python scripts\\dt2_make_fixture.py --dsn <합성용 DB DSN> --commit

    ⚠️ 운영/개발 DB 에 쓰지 말 것. 전용 빈 DB 를 만들어 쓴다.
       스크립트가 dashboard_data 를 통째로 덮어쓰므로 안전장치를 둔다(아래 --i-know).
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone

try:
    import psycopg
except ImportError:
    print("[FAIL] psycopg 를 찾을 수 없습니다.")
    sys.exit(1)


DIVISIONS = ['MX', 'VD', 'DA', 'NW', 'GTR', 'SR', 'CS', '의료기기']
STATUSES = ['정상진행', '지연', '완료', '취소', '보류']


def iso(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


def build(n_projects=120, n_performances=200):
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    performances = []
    projects = []

    # ── 성과 ────────────────────────────────────────────────────────────
    for i in range(n_performances):
        uuid = f'perf-uuid-{i:04d}'
        f = {
            'uuid': uuid,
            'id': f'performance-{i}',
            '성과항목': f'합성성과 {i}',
            'displayName': f'합성성과 {i} (표시)',
            '대분류': ['리드타임단축', '비용절감', '품질향상'][i % 3],
            '소분류': f'소분류{i % 7}',
            '단위': ['hrs', '%', '억원', '건'][i % 4],
            '성과년도': 2026 if i % 2 else '2025',          # E. 숫자/문자열 혼재
            '현재수준': i * 1.5,
            '목표수준': str(i * 2),                          # E. 문자열 숫자
            '실적수준': '' if i % 5 else str(i),             # H. 빈 문자열
            '월별실적': [str(m) for m in range(1, 13)] if i % 4 == 0 else [],
            '월별실적여부': 'TRUE' if i % 4 == 0 else False,  # E. 문자열 불리언
            'isAchievementType': i % 3 == 0,
            '설명': f'설명 {i}' if i % 2 else '',
            'isActive': True,
        }
        # A. 레거시 자기 참조
        if i % 3 == 0:
            f['성과항목UUID'] = f'legacy-uuid-{i:04d}'
        # C. updatedAt 결측 절반
        if i % 2 == 0:
            f['createdAt'] = iso(base + timedelta(days=i))
            f['updatedAt'] = iso(base + timedelta(days=i, hours=3))
        # L. 성과 소프트 삭제
        if i % 25 == 0 and i > 0:
            f['_deleted'] = True
            f['_deletedAt'] = iso(base + timedelta(days=i + 5))
            f['_deletedBy'] = '2'
            f['_deletedByName'] = '삭제자'
        # M. 실적_N월 평면 키 (값은 비어 있음 — 운영과 동일한 형태)
        if i % 6 == 0:
            for m in range(1, 13):
                f[f'실적_{m}월'] = ''
        # N. UI 런타임 상태 → 이관 제외돼야 함
        if i % 9 == 0:
            f['isEditing'] = False
            f['_idChanged'] = None
        # D. 모르는 키
        if i % 11 == 0:
            f['__synthetic_unknown_perf__'] = {'note': 'extra_fields 로 가야 함'}
        # linkedProjects — 파생 캐시. 이관되면 안 됨
        if i % 4 == 0:
            f['linkedProjects'] = [{'uuid': f'proj-uuid-{i:04d}', 'name': 'stale'}]
        performances.append(f)

    # ── 과제 ────────────────────────────────────────────────────────────
    for i in range(n_projects):
        uuid = f'proj-uuid-{i:04d}'
        div = DIVISIONS[i % len(DIVISIONS)]
        p = {
            'uuid': uuid,
            'id': f'{div}-{i}',
            '과제명': f'합성과제 {i}',
            '사업부': div,
            '프로세스': f'프로세스{i % 5}',
            '과제영역': f'영역{i % 4}' if i % 3 else '',
            '과제구분': f'구분{i % 3}',
            '진행상태': STATUSES[i % len(STATUSES)],
            '과제년도': 2026,
            '시작': (i % 12) + 1,
            '종료': 12,
            '진행률': i % 101 if i % 7 else None,            # H. null 섞기
            '과제상세설명': f'상세 {i}' if i % 2 else None,
            'PoC과제여부': i % 5 == 0,
            '중점과제여부': '1' if i % 8 == 0 else False,    # E. 문자열 불리언
            '사업부내공개여부': False,
            '과제PL': f'PL{i % 10}',
            '작성자': f'작성자{i % 6}',
            '담당부서목록': [f'부서{i % 9}'],
            '과제참여인력목록': [
                {'knoxId': f'user{i % 12}', '부서': f'부서{i % 9}', '이름': f'이름{i % 12}', '순번': 1}
            ],
            '액션아이템목록': [
                {'id': f'action_{i}_1', '제목': f'액션 {i}', '완료여부': i % 2 == 0,
                 '월별내용': {str(m): [] for m in range(1, 13)},
                 '세부항목목록': [{'내용': 'x', '비율': 50}]}
            ] if i % 3 == 0 else [],
            '이슈목록': [
                {'id': 900000 + i, '제목': f'이슈 {i}', '등록일': '2026-03-01',
                 '코멘트': '내용', '해결여부': False, '해결일': None,
                 '_sample': True if i % 15 == 0 else None}
            ] if i % 4 == 0 else [],
            '월간진척현황': {str(m): f'{m}월 내용' for m in range(1, (i % 5) + 1)},
            '상세정보_입력완료': i % 10 == 0,
        }
        # C. updatedAt 결측 — 절반만 넣는다
        if i % 2 == 0:
            p['createdAt'] = iso(base + timedelta(days=i))
            p['updatedAt'] = iso(base + timedelta(days=i, hours=5))

        # F. 삭제 / 영구삭제
        if i % 17 == 0 and i > 0:
            p['_deleted'] = True
            p['_deletedAt'] = iso(base + timedelta(days=i + 2))
            p['_deletedBy'] = '2'
            p['_deletedByName'] = '삭제자'
        if i % 23 == 0 and i > 0:
            p['_deleted'] = True
            p['_permanentlyDeleted'] = True
            p['_permanentlyDeletedAt'] = iso(base + timedelta(days=i + 3))
            p['_permanentlyDeletedBy'] = '1'
            p['_permanentlyDeletedByName'] = '영구삭제자'

        # I. 사업부 미매칭
        if i == 5:
            p['사업부'] = '없는사업부'

        # D. 모르는 키
        if i % 13 == 0:
            p['__synthetic_unknown_proj__'] = ['a', 'b']
            p['미지의한글키'] = '보존되어야 함'

        # K. 이미지 참조 (Phase 1-2 이후 형태)
        if i % 19 == 0:
            p['이미지_좌측'] = [{'imageId': 1000 + i, 'caption': f'캡션{i}', 'fileName': 'x.jpg'}]
            p['이미지_개요그림'] = [{'imageId': 2000 + i, 'caption': '', 'fileName': 'y.jpg'}]
            p['이미지_그룹1_카테고리'] = '개요그림'

        # J. 선행과제 (고아 포함)
        if i % 21 == 0 and i > 0:
            p['선행과제목록'] = [
                {'uuid': f'proj-uuid-{(i - 1):04d}', '과제명': 'prev'},
                {'uuid': 'proj-uuid-9999', '과제명': '존재하지 않음'},     # J. 고아
            ]

        # ── A/B/G. 성과 참조: 레거시 3종 혼재 + 고아 + 중복 ──
        refs = []
        if i % 2 == 0:
            j = i % n_performances
            refs.append({'성과항목UUID': f'perf-uuid-{j:04d}', '과제기여도': 50 + (i % 50)})
        if i % 3 == 0:
            j = (i + 7) % n_performances
            refs.append({'성과항목ID': f'performance-{j}', '과제기여도': str(30 + (i % 30)),
                         '단위': 'hrs', '대분류': '복제된 필드'})       # 성과 본체 복제
        if i % 5 == 0:
            j = (i + 13) % n_performances
            refs.append({'uuid': f'perf-uuid-{j:04d}', '과제기여도': 10})
        if i % 7 == 0:
            j = (i + 3) % n_performances
            if j % 3 == 0:
                refs.append({'성과UUID': f'legacy-uuid-{j:04d}', '과제기여도': 20})
        if i % 11 == 0:
            refs.append({'성과항목UUID': 'perf-uuid-9999', '과제기여도': 5})   # B. 고아
        if i % 29 == 0 and refs:
            refs.append(dict(refs[0]))                                        # G. 중복
        p['성과목록'] = refs

        projects.append(p)

    return projects, performances


def main():
    ap = argparse.ArgumentParser(description="V2 이관 시험용 합성 데이터 생성")
    ap.add_argument("--dsn", required=True, help="합성 전용 DB 접속 문자열")
    ap.add_argument("--commit", action="store_true")
    ap.add_argument("--projects", type=int, default=120)
    ap.add_argument("--performances", type=int, default=200)
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    if 'dxdigitaltwin_fixture' not in args.dsn:
        print("[FAIL] 안전장치: DB 이름에 'dxdigitaltwin_fixture' 가 들어가야 합니다.")
        print("       운영/개발 DB 를 덮어쓰는 사고를 막기 위한 제한입니다.")
        sys.exit(1)

    projects, performances = build(args.projects, args.performances)

    print("=" * 70)
    print(" 합성 데이터 생성")
    print("=" * 70)
    print(f"  과제 {len(projects):,}건 / 성과 {len(performances):,}건")
    n_refs = sum(len(p.get('성과목록') or []) for p in projects)
    n_del = sum(1 for p in projects if p.get('_deleted'))
    n_pdel = sum(1 for p in projects if p.get('_permanentlyDeleted'))
    n_noupd = sum(1 for p in projects if not p.get('updatedAt'))
    n_unknown = sum(1 for p in projects if '__synthetic_unknown_proj__' in p)
    n_img = sum(1 for p in projects if p.get('이미지_좌측'))
    print(f"  성과 참조 {n_refs:,}건 (고아 포함)")
    print(f"  삭제 {n_del} / 영구삭제 {n_pdel} / updatedAt 결측 {n_noupd}")
    print(f"  모르는 키 보유 과제 {n_unknown} / 이미지 참조 과제 {n_img}")

    if not args.commit:
        print("\n  --commit 을 붙이면 DB 에 씁니다.")
        return

    with psycopg.connect(args.dsn) as conn:
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM dashboard_data")
        if cur.fetchone()[0] == 0:
            cur.execute(
                "INSERT INTO dashboard_data (version, projects, performances, data_metadata, "
                " created_at, updated_at) VALUES (1, %s, %s, %s, now(), now())",
                (json.dumps(projects, ensure_ascii=False),
                 json.dumps(performances, ensure_ascii=False),
                 json.dumps({'version': 'fixture'}, ensure_ascii=False)),
            )
        else:
            cur.execute(
                "UPDATE dashboard_data SET projects = %s, performances = %s, "
                "version = version + 1, updated_at = now()",
                (json.dumps(projects, ensure_ascii=False),
                 json.dumps(performances, ensure_ascii=False)),
            )
        conn.commit()
    print("\n[OK] 합성 데이터를 dashboard_data 에 기록했습니다.")


if __name__ == "__main__":
    main()
