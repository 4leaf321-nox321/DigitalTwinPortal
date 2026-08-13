import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Globe, Lock, Eye, ChevronDown, Check } from 'lucide-react';
import { useVisibilityScope } from '../../contexts/VisibilityScopeContext';

const Wrap = styled.div`
  position: relative;
  display: inline-block;
`;

const Btn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #334155;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;

  &:hover { background: #e2e8f0; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Menu = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 260px;
  max-height: 60vh;
  overflow-y: auto;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  padding: 4px;
`;

const SectionLabel = styled.div`
  padding: 8px 10px 4px;
  font-size: 0.68rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const Item = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 0.8rem;
  text-align: left;
  color: ${p => p.$active ? '#0066cc' : '#334155'};
  background: ${p => p.$active ? '#eff6ff' : 'transparent'};
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover { background: ${p => p.$active ? '#eff6ff' : '#f8fafc'}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; background: transparent; }
`;

const ItemBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ItemLabel = styled.span`
  font-weight: 600;
`;

const ItemDesc = styled.span`
  font-size: 0.7rem;
  font-weight: 400;
  color: #64748b;
`;

const Divider = styled.div`
  height: 1px;
  margin: 4px 6px;
  background: #f1f5f9;
`;

const MODE_META = {
  public:  { Icon: Globe, label: '전사 공개만', desc: '사업부 내 공개 과제 제외' },
  bu_only: { Icon: Lock,  label: '사업부 내 공개만', desc: '해당 사업부의 비공개 과제만' },
  bu_all:  { Icon: Eye,   label: '사업부 내 공개 포함', desc: '전사 공개 + 해당 사업부 비공개' },
};

const formatDivisionLabel = (divName) => divName || '전체 사업부';

const VisibilityScopeToggle = () => {
  const {
    mode, division, effectiveDivision,
    setMode, setDivision,
    isAdmin, userDivisionName, divisions, loaded,
  } = useVisibilityScope();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 비Admin이고 사업부 미지정 → BU 모드 비활성화
  const noDivision = !isAdmin && loaded && !userDivisionName;

  const currentMeta = MODE_META[mode] || MODE_META.public;
  const CurrentIcon = currentMeta.Icon;

  // 버튼 라벨 (헤더에서 짧게)
  let btnLabel;
  if (mode === 'public') {
    btnLabel = '전사 공개';
  } else {
    const divLabel = isAdmin
      ? formatDivisionLabel(division)
      : (userDivisionName || '사업부 미지정');
    btnLabel = mode === 'bu_only'
      ? `사업부만 (${divLabel})`
      : `사업부 포함 (${divLabel})`;
  }

  const handleSelectMode = (nextMode) => {
    if (noDivision && nextMode !== 'public') return;
    setMode(nextMode);
    // mode가 BU 계열로 바뀌고 admin이 division을 아직 지정 안 했다면 그대로 null(전체)로 둠
    setOpen(false);
  };

  const handleSelectAdminDivision = (divName) => {
    setDivision(divName); // null이면 "전체 사업부"
    // mode가 'public'이면 BU 모드로 자동 전환할까? — 사용자 의도 모호. 그대로 둠.
    setOpen(false);
  };

  return (
    <Wrap ref={wrapRef}>
      <Btn type="button" onClick={() => setOpen(o => !o)} title={currentMeta.label}>
        <CurrentIcon size={13} strokeWidth={2} />
        {btnLabel}
        <ChevronDown size={13} strokeWidth={2} />
      </Btn>
      {open && (
        <Menu>
          <SectionLabel>보기 모드</SectionLabel>
          {['public', 'bu_only', 'bu_all'].map(m => {
            const meta = MODE_META[m];
            const Icon = meta.Icon;
            const disabled = m !== 'public' && noDivision;
            const active = m === mode;
            return (
              <Item
                key={m}
                type="button"
                $active={active}
                disabled={disabled}
                onClick={() => !disabled && handleSelectMode(m)}
                title={disabled ? '내 사업부가 지정되지 않아 사업부 내 공개 과제를 볼 수 없습니다.' : ''}
              >
                <Icon size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                <ItemBody>
                  <ItemLabel>{meta.label}</ItemLabel>
                  <ItemDesc>{meta.desc}</ItemDesc>
                </ItemBody>
                {active && <Check size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
              </Item>
            );
          })}

          {/* Admin 전용: 사업부 선택 (BU 모드에서만 의미 있음) */}
          {isAdmin && (
            <>
              <Divider />
              <SectionLabel>적용 사업부 (Admin)</SectionLabel>
              <Item
                type="button"
                $active={division === null || division === undefined}
                onClick={() => handleSelectAdminDivision(null)}
              >
                <Globe size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                <ItemBody>
                  <ItemLabel>전체 사업부</ItemLabel>
                  <ItemDesc>모든 사업부의 BU-only 과제 포함</ItemDesc>
                </ItemBody>
                {(division === null || division === undefined)
                  && <Check size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
              </Item>
              {divisions.map(div => {
                const active = division === div.name;
                return (
                  <Item
                    key={div.id || div.name}
                    type="button"
                    $active={active}
                    onClick={() => handleSelectAdminDivision(div.name)}
                  >
                    <Lock size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <ItemBody>
                      <ItemLabel>{div.name}</ItemLabel>
                    </ItemBody>
                    {active && <Check size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
                  </Item>
                );
              })}
            </>
          )}

          {/* 비Admin 사용자에게는 자동 적용된 사업부를 안내 */}
          {!isAdmin && userDivisionName && mode !== 'public' && (
            <>
              <Divider />
              <SectionLabel>적용 사업부</SectionLabel>
              <div style={{ padding: '8px 10px', fontSize: '0.75rem', color: '#475569' }}>
                내 사업부: <strong>{userDivisionName}</strong>
              </div>
            </>
          )}
        </Menu>
      )}
    </Wrap>
  );
};

export default VisibilityScopeToggle;
