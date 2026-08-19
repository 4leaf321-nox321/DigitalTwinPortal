import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';
import {
  Overlay, Modal, ModalHeader, ModalTitle, CloseButton, ModalBody,
  ModalFooter, FooterRight, CancelButton, SaveButton,
} from './modalStyles';
import { AMOUNT_UNIT, CATEGORY1_OPTIONS, EMPTY_INVESTMENT, departmentsFor } from '../constants';

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  grid-column: ${props => props.$full ? '1 / -1' : 'auto'};
`;

const Label = styled.label`
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
`;

const Required = styled.span`
  color: #ef4444;
  margin-left: 2px;
`;

const inputStyle = `
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #1e293b;
  background: white;
  outline: none;
  &:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15); }
`;

const TextInput = styled.input`${inputStyle}`;
const Select = styled.select`${inputStyle} cursor: pointer;`;

const AmountWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  input { width: 100%; padding-right: 42px; }
`;

const Unit = styled.span`
  position: absolute;
  right: 10px;
  font-size: 0.78rem;
  color: #94a3b8;
  pointer-events: none;
`;

const InvestmentModal = ({
  isOpen,
  onClose,
  onSave,
  initialValue = null,
  divisions = [],
  processes = [],
  departments = [],
  departmentsByDivision = {},
  category2Options = [],
}) => {
  const [form, setForm] = useState({ ...EMPTY_INVESTMENT });

  // 열릴 때마다 폼을 다시 채운다. 수정이면 그 값을, 새로 등록이면 빈 값을.
  useEffect(() => {
    if (!isOpen) return;
    setForm(initialValue ? { ...EMPTY_INVESTMENT, ...initialValue } : { ...EMPTY_INVESTMENT });
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const canSave = form.name.trim().length > 0;

  const availableDepartments = departmentsFor(form.division, departments, departmentsByDivision);

  // 사업부를 바꾸면 그 아래에 없는 투자부서는 털어 낸다.
  // 안 그러면 화면에는 안 보이는 값이 그대로 저장된다.
  const updateDivision = (value) => setForm(prev => {
    const allowed = departmentsFor(value, departments, departmentsByDivision);
    return {
      ...prev,
      division: value,
      department: allowed.includes(prev.department) ? prev.department : '',
    };
  });

  const handleSave = () => {
    if (!canSave) return;
    onSave({ ...form, name: form.name.trim() });
  };

  const renderSelect = (key, options, { placeholder = '선택', onChange } = {}) => (
    <Select
      value={form[key] || ''}
      onChange={e => (onChange || (v => update(key, v)))(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {/* 예전에 저장해 둔 값이 지금 목록에 없더라도 그대로 보여 준다 —
          안 그러면 창을 열었다는 이유만으로 값이 조용히 지워진다. */}
      {[...new Set([...options, form[key]].filter(Boolean))].map(name => (
        <option key={name} value={name}>{name}</option>
      ))}
    </Select>
  );

  const renderAmount = (key) => (
    <AmountWrapper>
      <TextInput
        type="number"
        step="0.01"
        min="0"
        value={form[key] ?? ''}
        onChange={e => update(key, e.target.value)}
        placeholder="0"
      />
      <Unit>{AMOUNT_UNIT}</Unit>
    </AmountWrapper>
  );

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Modal $width="640px">
        <ModalHeader>
          <ModalTitle>{initialValue ? '투자 수정' : '투자 등록'}</ModalTitle>
          <CloseButton onClick={onClose}><X size={18} /></CloseButton>
        </ModalHeader>

        <ModalBody>
          <Grid>
            <Field $full>
              <Label>투자명<Required>*</Required></Label>
              <TextInput
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="투자명을 입력하세요"
                autoFocus
              />
            </Field>

            <Field>
              <Label>사업부</Label>
              {renderSelect('division', divisions, { onChange: updateDivision })}
            </Field>

            <Field>
              <Label>프로세스</Label>
              {renderSelect('process', processes)}
            </Field>

            <Field>
              <Label>투자부서</Label>
              {renderSelect('department', availableDepartments, {
                placeholder: form.division && availableDepartments.length === 0
                  ? '이 사업부에 등록된 부서가 없습니다'
                  : '선택',
              })}
            </Field>

            <Field>
              <Label>투자년도</Label>
              <TextInput
                type="number"
                min="1900"
                max="2999"
                value={form.year ?? ''}
                onChange={e => update('year', e.target.value)}
                placeholder="예: 2026"
              />
            </Field>

            <Field>
              <Label>계획값</Label>
              {renderAmount('planAmount')}
            </Field>

            <Field>
              <Label>실적값</Label>
              {renderAmount('actualAmount')}
            </Field>

            <Field>
              <Label>투자 유형</Label>
              {renderSelect('category1', CATEGORY1_OPTIONS)}
            </Field>

            <Field>
              <Label>디지털 트윈 영역</Label>
              {renderSelect('category2', category2Options)}
            </Field>
          </Grid>
        </ModalBody>

        <ModalFooter>
          <FooterRight>
            <CancelButton onClick={onClose}>취소</CancelButton>
            <SaveButton onClick={handleSave} disabled={!canSave}>저장</SaveButton>
          </FooterRight>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default InvestmentModal;
