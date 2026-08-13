import React, { useRef, useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, ImagePlus } from 'lucide-react';
import { uploadReportImage } from '../../../services/settingsApi';
import { compressImageFile } from '../../../utils/reportImageHelper';
// 수준값의 0 과 미입력은 다른 뜻이다. `|| '-'` 로 다루면 0 이 '-' 로 찍힌다.
import { levelText } from '../../../utils/levelValue';
import ReportImg from '../../ReportImage/ReportImg';

// 섹션 목록과 '하위 줄 없는 섹션'(- 레벨만, 최대 2개)은 **여기가 정본이 아니다.**
// 보고서·상세 보기와 같은 표를 써야 한다 — 갈리면 편집한 것이 다른 화면에서 안 보인다.
import { DETAIL_SECTIONS, PARENT_ONLY_SECTIONS } from '../../../utils/detailSections';

// 섹션별 플레이스홀더
const SECTION_PLACEHOLDERS = {
  과제개요: '과제에 대해 요약된 정보를 기입하세요',
  추진배경: '과제를 추진하게 된 배경이나 필요성을 기입하세요',
  과제목표: '과제를 통해 달성하고자 하는 목표를 기입하세요',
  상세내용: '과제의 세부 추진 내용을 기입하세요',
  성과: '기술/경영 성과에 대한 요약을 기입하세요',
  산출물: '예) OOO 프로그램, OOO 측정 데이터, OOO 플랫폼',
  향후계획: '향후 추진 예정인 계획이나 방향을 기입하세요',
};

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 85vw;
  height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

  @media (max-width: 768px) {
    width: 95vw;
    height: 85vh;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
`;

const ModalTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f3f4f6;
    color: #111827;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
`;

const Button = styled.button`
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid #e5e7eb;
  background: white;
  color: #374151;

  &:hover {
    background: #f3f4f6;
  }

  &.primary {
    background: #10b981;
    border-color: #10b981;
    color: white;

    &:hover {
      background: #059669;
      border-color: #059669;
    }
  }
`;

const SectionCard = styled.div`
  border: 2px solid ${props => props.$active ? '#10b981' : '#e5e7eb'};
  border-radius: 0.5rem;
  overflow: visible;
  flex-shrink: 0;
  transition: border-color 0.2s ease;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: ${props => props.$active ? '#f0fdf4' : '#f9fafb'};
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;

  &:hover {
    background: ${props => props.$active ? '#ecfdf5' : '#f3f4f6'};
  }
`;

const SectionCheckbox = styled.input`
  width: 1.125rem;
  height: 1.125rem;
  accent-color: #10b981;
  cursor: pointer;
  flex-shrink: 0;
`;

const SectionLabel = styled.span`
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
  flex: 1;
`;

const SectionBadge = styled.span`
  font-size: 0.75rem;
  color: #6b7280;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 0.125rem 0.5rem;
`;

const SectionBody = styled.div`
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid #e5e7eb;
`;

/* 상위 항목 (□) */
const ParentItemRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const ParentPrefix = styled.span`
  font-size: 0.9rem;
  color: #374151;
  flex-shrink: 0;
  width: 1.25rem;
  text-align: center;
`;

/* 하위 항목 (-) */
const ChildItemRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-left: 1.75rem;
`;

const ChildPrefix = styled.span`
  font-size: 0.9rem;
  color: #9ca3af;
  flex-shrink: 0;
  width: 1.25rem;
  text-align: center;
`;

const Input = styled.input`
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.85rem;
  font-family: inherit;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: #d1d5db;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &.delete:hover {
    background: #fee2e2;
    color: #ef4444;
  }

  &.add:hover {
    background: #f0fdf4;
    color: #10b981;
  }

  &.add-child:hover {
    background: #eff6ff;
    color: #3b82f6;
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.4rem;
  border: 2px dashed #d1d5db;
  border-radius: 0.375rem;
  background: transparent;
  color: #6b7280;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #10b981;
    color: #059669;
    background: #f0fdf4;
  }
`;

const AddChildButton = styled(AddButton)`
  margin-left: 1.75rem;
  border-style: dotted;
  font-size: 0.75rem;
  padding: 0.3rem;

  &:hover {
    border-color: #3b82f6;
    color: #2563eb;
    background: #eff6ff;
  }
`;

const ItemGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;

  & + & {
    margin-top: 0.25rem;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const AddImageButton = styled(AddButton)`
  &:hover {
    border-color: #8b5cf6;
    color: #7c3aed;
    background: #f5f3ff;
  }
`;

const ImageItemCard = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #fafafa;
`;

const ImagePreview = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 0.375rem;
  overflow: hidden;
  flex-shrink: 0;
  background: #e5e7eb;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const ImageInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
`;

const ImageFileName = styled.span`
  font-size: 0.75rem;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CaptionInput = styled.input`
  width: 100%;
  padding: 0.4rem 0.625rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-family: inherit;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const CompletionRow = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #f0fdf4;
  border: 2px solid #bbf7d0;
  border-radius: 0.5rem;
`;

const CompletionCheckbox = styled.input`
  width: 1.25rem;
  height: 1.25rem;
  accent-color: #10b981;
  cursor: pointer;
  flex-shrink: 0;
`;

const CompletionLabel = styled.label`
  font-size: 0.9rem;
  font-weight: 600;
  color: #065f46;
  cursor: pointer;
`;

const ImageSectionCard = styled.div`
  border: 2px solid #8b5cf6;
  border-radius: 0.5rem;
  overflow: visible;
  flex-shrink: 0;
  grid-column: 1 / -1;
`;

const ImageSectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f5f3ff;
`;

const ImageRatioHint = styled.div`
  font-size: 0.7rem;
  color: #9ca3af;
  text-align: center;
  margin-top: 0.25rem;
`;

const ImageCategorySelect = styled.select`
  margin-left: auto;
  padding: 0.375rem 0.625rem;
  border: 2px solid #d8b4fe;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #6d28d9;
  background: white;
  cursor: pointer;
  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
`;

const ImageSectionBody = styled.div`
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
`;

const ImageSideContainer = styled.div`
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  min-width: 0;
`;

const ImageSideHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: #fafafa;
  border-bottom: 1px solid #e5e7eb;
`;

const ImageSideLabel = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
`;

const ImageSideBody = styled.div`
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const PerfTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  margin-top: 0.25rem;
`;

const PerfTh = styled.th`
  padding: 0.375rem 0.5rem;
  background: #d1d5db;
  border: 1px solid #d1d5db;
  font-weight: 600;
  color: #111827;
  text-align: center;
  white-space: nowrap;
`;

const PerfTd = styled.td`
  padding: 0.375rem 0.5rem;
  border: 1px solid #d1d5db;
  color: #111827;
  text-align: center;
`;

const PerfLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  margin-top: 0.75rem;
  margin-bottom: 0.25rem;
`;

const IMAGE_CATEGORIES = [
  { key: '개요그림', label: '개요 그림' },
  { key: '상세내용그림', label: '상세 내용 그림' },
  { key: '향후계획그림', label: '향후 계획 그림' },
];

const IMAGE_GROUP_COUNT = 2;

const DetailInfoModal = ({ isOpen, onClose, formData, handleInputChange, onSaveAndUpload, projectId }) => {
  const fileInputRefs = useRef({});

  // [Phase 1-2] 이미지 업로드 상태
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [imageError, setImageError] = useState('');

  /**
   * 각 그룹이 고른 이미지 카테고리.
   *
   * 🐞 **저장된 값이 목록에 없으면 기본값으로 되돌린다** (2026-08-08 수정).
   *    예전에는 저장된 문자열을 그대로 썼는데, 데이터에 `방사 패턴`·`측정 비교` 같은
   *    **자유 텍스트**가 들어 있는 과제가 있었다(개발 DB 435건 중 100건).
   *    그러면 이런 일이 벌어졌다:
   *      ① 업로드가 `이미지_방사 패턴` 슬롯으로 올라간다
   *      ② 편집창에는 잘 보인다 (방금 formData 에 넣었으니까)
   *      ③ **저장할 때 조용히 사라진다** — 저장 어댑터는 정해진 슬롯 5개만 모은다
   *      ④ 보고서에도 영영 안 나온다 — 서버도 그 5개만 되돌린다
   *    "편집창에서 고쳤는데 안 들어간다" 의 정체가 이것이었다.
   */
  const getGroupCategory = (groupIdx) => {
    const saved = formData[`이미지_그룹${groupIdx + 1}_카테고리`];
    if (saved && IMAGE_CATEGORIES.some((c) => c.key === saved)) return saved;
    return IMAGE_CATEGORIES[groupIdx]?.key || IMAGE_CATEGORIES[0].key;
  };
  const setGroupCategory = (groupIdx, catKey) => {
    handleInputChange({
      target: { name: `이미지_그룹${groupIdx + 1}_카테고리`, value: catKey },
    });
  };

  // 목록에 없는 값이 저장돼 있으면 **열 때 한 번 바로잡는다.** 읽을 때만 감추면
  // 화면과 저장값이 계속 어긋난 채로 남아, 다음 사람이 같은 함정을 다시 만난다.
  // (훅이므로 아래 `isOpen` 이른 반환보다 **위**에 있어야 한다)
  useEffect(() => {
    if (!isOpen) return;
    IMAGE_CATEGORIES.slice(0, IMAGE_GROUP_COUNT).forEach((_, gi) => {
      const saved = formData[`이미지_그룹${gi + 1}_카테고리`];
      if (saved && !IMAGE_CATEGORIES.some((c) => c.key === saved)) {
        console.info(`[DT] 이미지 그룹${gi + 1} 카테고리 "${saved}" 는 쓸 수 없는 값이라 `
          + `"${IMAGE_CATEGORIES[gi]?.key}" 로 바꿉니다 (그 슬롯의 이미지는 저장되지 않습니다).`);
        setGroupCategory(gi, IMAGE_CATEGORIES[gi]?.key || IMAGE_CATEGORIES[0].key);
      }
    });
    // formData 전체를 의존성에 넣으면 타이핑마다 돈다 — 열릴 때와 그 두 값만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, formData.이미지_그룹1_카테고리, formData.이미지_그룹2_카테고리]);

  if (!isOpen) return null;

  // 가중치 기반 글자 수 계산 (띄어쓰기 = 0.5글자)
  const MAX_WEIGHTED_LENGTH = 39;
  const getWeightedLength = (text) => {
    let w = 0;
    for (const ch of text) {
      w += ch === ' ' ? 0.5 : 1;
    }
    return w;
  };
  const isWithinLimit = (text) => getWeightedLength(text) <= MAX_WEIGHTED_LENGTH;

  const getFieldName = (key) => `상세정보_${key}`;

  // items: [{ text: '', children: [{ text: '' }, ...] }, ...]
  const getSectionData = (key) => {
    const raw = formData[getFieldName(key)];
    if (!raw) return { enabled: false, items: [{ text: '', children: [] }] };
    const items = Array.isArray(raw.items) && raw.items.length > 0
      ? raw.items.map(item =>
          typeof item === 'string'
            ? { text: item, children: [] }
            : { text: item.text ?? '', children: Array.isArray(item.children) ? item.children : [] }
        )
      : [{ text: '', children: [] }];
    return { enabled: raw.enabled ?? false, items };
  };

  const updateSection = (key, data) => {
    handleInputChange({
      target: { name: getFieldName(key), value: data },
    });
  };

  const toggleSection = (key) => {
    const current = getSectionData(key);
    updateSection(key, { ...current, enabled: !current.enabled });
  };

  // 상위 항목
  const updateParentText = (key, idx, value) => {
    if (!isWithinLimit(value)) return;
    const current = getSectionData(key);
    const newItems = [...current.items];
    newItems[idx] = { ...newItems[idx], text: value };
    updateSection(key, { ...current, items: newItems });
  };

  const addParent = (key) => {
    const current = getSectionData(key);
    updateSection(key, { ...current, items: [...current.items, { text: '', children: [] }] });
  };

  const removeParent = (key, idx) => {
    const current = getSectionData(key);
    if (current.items.length <= 1) return;
    updateSection(key, { ...current, items: current.items.filter((_, i) => i !== idx) });
  };

  // 하위 항목
  const updateChildText = (key, parentIdx, childIdx, value) => {
    if (!isWithinLimit(value)) return;
    const current = getSectionData(key);
    const newItems = [...current.items];
    const newChildren = [...newItems[parentIdx].children];
    newChildren[childIdx] = { ...newChildren[childIdx], text: value };
    newItems[parentIdx] = { ...newItems[parentIdx], children: newChildren };
    updateSection(key, { ...current, items: newItems });
  };

  const addChild = (key, parentIdx) => {
    const current = getSectionData(key);
    const newItems = [...current.items];
    newItems[parentIdx] = {
      ...newItems[parentIdx],
      children: [...newItems[parentIdx].children, { text: '' }],
    };
    updateSection(key, { ...current, items: newItems });
  };

  const removeChild = (key, parentIdx, childIdx) => {
    const current = getSectionData(key);
    const newItems = [...current.items];
    newItems[parentIdx] = {
      ...newItems[parentIdx],
      children: newItems[parentIdx].children.filter((_, i) => i !== childIdx),
    };
    updateSection(key, { ...current, items: newItems });
  };

  // 독립 이미지 (좌측/우측)
  const getImageData = (side) => {
    const raw = formData[`이미지_${side}`];
    return Array.isArray(raw) ? raw : [];
  };

  const updateImageData = (side, images) => {
    handleInputChange({
      target: { name: `이미지_${side}`, value: images },
    });
  };

  const MAX_IMAGES_PER_SIDE = 3;
  const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;   // 원본 20MB 초과는 거부

  /**
   * [Phase 1-2] 이미지 업로드
   *
   * 이전에는 원본을 그대로 base64 로 만들어 과제 JSON 안에 넣었다.
   * 운영에서 이 방식으로 33.9 MB 가 쌓여 저장 payload 의 94.4% 를 차지했고,
   * 과제 하나만 수정해도 그게 통째로 왕복했다.
   *
   * 지금은
   *   1) 캔버스로 리사이즈·압축하고 (보통 10~20배 감소)
   *   2) 서버에 파일로 올린 뒤
   *   3) JSON 에는 imageId 참조만 남긴다.
   *
   * 아직 저장되지 않은 신규 과제(uuid 없음)는 업로드할 대상이 없으므로
   * 압축된 base64 로 임시 보관한다. 이후 이관 스크립트가 파일로 분리한다.
   */
  const triggerImageUpload = (side) => {
    const current = getImageData(side);
    if (current.length >= MAX_IMAGES_PER_SIDE) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_ORIGINAL_BYTES) {
        setImageError(`이미지가 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB). 20MB 이하만 올릴 수 있습니다.`);
        return;
      }

      setImageError('');
      setUploadingSlot(side);

      try {
        const compressed = await compressImageFile(file);
        const latest = getImageData(side);
        if (latest.length >= MAX_IMAGES_PER_SIDE) return;

        // projectId 는 부모에서 project.uuid || project.id 로 넘어온다.
        // formData 에는 uuid 가 없으므로(화이트리스트) formData.uuid 를 쓰면 안 된다.
        const projectUuid = projectId || formData?.uuid;
        let newImage;

        if (projectUuid) {
          const uploaded = await uploadReportImage(projectUuid, compressed, `이미지_${side}`, {
            position: latest.length,
            fileName: file.name,
          });
          newImage = { imageId: uploaded.id, fileName: file.name, caption: '' };
        } else {
          // 신규 과제 — 아직 서버에 과제가 없어 업로드할 수 없다. 압축본을 임시 보관.
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(compressed);
          });
          newImage = { dataUrl, fileName: file.name, caption: '' };
        }

        updateImageData(side, [...latest, newImage]);
      } catch (err) {
        setImageError(err?.message || '이미지 업로드에 실패했습니다.');
      } finally {
        setUploadingSlot(null);
      }
    });
    input.click();
  };

  const updateImageCaption = (side, imgIdx, caption) => {
    const current = getImageData(side);
    const newImages = [...current];
    newImages[imgIdx] = { ...newImages[imgIdx], caption };
    updateImageData(side, newImages);
  };

  const removeImage = (side, imgIdx) => {
    const current = getImageData(side);
    updateImageData(side, current.filter((_, i) => i !== imgIdx));
  };

  return (
    <Overlay onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>상세 과제 정보 입력</ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={18} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          {DETAIL_SECTIONS.map(({ key, label }) => {
            const data = getSectionData(key);
            return (
              <SectionCard key={key} $active={data.enabled} data-section={key}>
                <SectionHeader
                  $active={data.enabled}
                  onClick={() => toggleSection(key)}
                >
                  <SectionCheckbox
                    type="checkbox"
                    checked={data.enabled}
                    onChange={() => toggleSection(key)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <SectionLabel>{label}</SectionLabel>
                  {data.enabled && (
                    <SectionBadge>{data.items.length}개 항목</SectionBadge>
                  )}
                </SectionHeader>

                {data.enabled && (
                  <SectionBody>
                    {data.items.map((item, pIdx) => (
                      <ItemGroup key={pIdx}>
                        {/* 상위 항목 */}
                        <ParentItemRow>
                          <ParentPrefix>-</ParentPrefix>
                          <Input
                            value={item.text}
                            onChange={(e) => updateParentText(key, pIdx, e.target.value)}
                            placeholder={SECTION_PLACEHOLDERS[key] || `${label} 내용을 입력하세요`}
                            data-parent-idx={pIdx}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (PARENT_ONLY_SECTIONS.has(key) && data.items.length >= 2) return;
                                addParent(key);
                                const nextIdx = data.items.length;
                                setTimeout(() => {
                                  const card = document.querySelector(`[data-section="${key}"]`);
                                  const next = card?.querySelector(`[data-parent-idx="${nextIdx}"]`);
                                  if (next) next.focus();
                                }, 50);
                              }
                            }}
                          />
                          {/* 부모 전용 섹션은 하위 항목 추가 불가 */}
                          {!PARENT_ONLY_SECTIONS.has(key) && (
                            <IconButton
                              type="button"
                              className="add-child"
                              onClick={() => addChild(key, pIdx)}
                              title="하위 항목 추가"
                            >
                              <Plus size={13} />
                            </IconButton>
                          )}
                          {data.items.length > 1 && (
                            <IconButton
                              type="button"
                              className="delete"
                              onClick={() => removeParent(key, pIdx)}
                              title="삭제"
                            >
                              <Trash2 size={13} />
                            </IconButton>
                          )}
                        </ParentItemRow>

                        {/* 하위 항목들 (부모 전용 섹션 제외) */}
                        {!PARENT_ONLY_SECTIONS.has(key) && item.children.map((child, cIdx) => (
                          <ChildItemRow key={cIdx}>
                            <ChildPrefix>&middot;</ChildPrefix>
                            <Input
                              value={child.text}
                              onChange={(e) => updateChildText(key, pIdx, cIdx, e.target.value)}
                              placeholder="하위 내용을 입력하세요"
                              data-child-idx={`${pIdx}-${cIdx}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addChild(key, pIdx);
                                  const nextIdx = item.children.length;
                                  setTimeout(() => {
                                    const card = document.querySelector(`[data-section="${key}"]`);
                                    const next = card?.querySelector(`[data-child-idx="${pIdx}-${nextIdx}"]`);
                                    if (next) next.focus();
                                  }, 50);
                                }
                              }}
                            />
                            <IconButton
                              type="button"
                              className="delete"
                              onClick={() => removeChild(key, pIdx, cIdx)}
                              title="삭제"
                            >
                              <Trash2 size={13} />
                            </IconButton>
                          </ChildItemRow>
                        ))}

                      </ItemGroup>
                    ))}

                    {/* 부모 전용 섹션은 최대 2개, 나머지는 제한 없음 */}
                    {(!PARENT_ONLY_SECTIONS.has(key) || data.items.length < 2) && (
                      <ButtonRow>
                        <AddButton type="button" onClick={() => addParent(key)}>
                          <Plus size={14} />
                          항목 추가{PARENT_ONLY_SECTIONS.has(key) ? ` (${data.items.length}/2)` : ''}
                        </AddButton>
                      </ButtonRow>
                    )}

                    {/* 성과 섹션: 연결된 성과 테이블 */}
                    {key === '성과' && formData.성과목록 && formData.성과목록.length > 0 && (
                      <>
                        <PerfLabel>연결된 성과 항목</PerfLabel>
                        <PerfTable>
                          <thead>
                            <tr>
                              <PerfTh>성과분류</PerfTh>
                              <PerfTh>성과항목명</PerfTh>
                              <PerfTh>기존</PerfTh>
                              <PerfTh>목표</PerfTh>
                              <PerfTh>실적</PerfTh>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.성과목록.map((perf, perfIdx) => {
                              const unit = perf.단위 || '';
                              const base = parseFloat(perf.현재수준);
                              const target = parseFloat(perf.목표수준);
                              const actual = parseFloat(perf.실적수준);
                              const fmtDelta = (v) => {
                                if (isNaN(base) || isNaN(v)) return null;
                                const d = v - base;
                                return d >= 0 ? `(+${d})` : `(${d})`;
                              };
                              const targetDelta = fmtDelta(target);
                              const actualDelta = fmtDelta(actual);
                              return (
                                <tr key={perfIdx}>
                                  <PerfTd style={{ textAlign: 'left' }}>{perf.소분류 || '-'}</PerfTd>
                                  <PerfTd style={{ textAlign: 'left' }}>{(perf.성과항목 || '-').replace(/^\[.+?\]\s*/, '')}</PerfTd>
                                  <PerfTd>{levelText(perf.현재수준, '-')}{unit && ` ${unit}`}</PerfTd>
                                  <PerfTd>{levelText(perf.목표수준, '-')}{unit && ` ${unit}`}{targetDelta && <><br/><span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{targetDelta}</span></>}</PerfTd>
                                  <PerfTd>{levelText(perf.실적수준, '-')}{unit && ` ${unit}`}{actualDelta && <><br/><span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{actualDelta}</span></>}</PerfTd>
                                </tr>
                              );
                            })}
                          </tbody>
                        </PerfTable>
                      </>
                    )}
                  </SectionBody>
                )}
              </SectionCard>
            );
          })}

          {/* 독립 이미지 추가 섹션 */}
          <ImageSectionCard>
            <ImageSectionHeader>
              <ImagePlus size={18} style={{ color: '#8b5cf6' }} />
              <SectionLabel>이미지 추가</SectionLabel>
            </ImageSectionHeader>
            <ImageSectionBody style={{ display: 'flex', gap: '1rem' }}>
              {Array.from({ length: IMAGE_GROUP_COUNT }, (_, gi) => {
                const catKey = getGroupCategory(gi);
                const otherIdx = gi === 0 ? 1 : 0;
                const images = getImageData(catKey);
                return (
                  <ImageSideContainer key={gi}>
                    <ImageSideHeader>
                      <ImageCategorySelect
                        value={catKey}
                        onChange={(e) => {
                          const newVal = e.target.value;
                          const otherVal = getGroupCategory(otherIdx);
                          setGroupCategory(gi, newVal);
                          // 상대 그룹과 같은 카테고리를 선택하면, 상대 그룹에서 남은 카테고리 중 첫 번째로 변경
                          if (newVal === otherVal) {
                            const remaining = IMAGE_CATEGORIES.find(c => c.key !== newVal);
                            if (remaining) setGroupCategory(otherIdx, remaining.key);
                          }
                        }}
                      >
                        {IMAGE_CATEGORIES.map(({ key, label }) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </ImageCategorySelect>
                      <SectionBadge>{images.length}개</SectionBadge>
                    </ImageSideHeader>
                    <ImageSideBody>
                      {images.map((img, imgIdx) => (
                        <ImageItemCard key={`${catKey}-${imgIdx}`}>
                          <ImagePreview>
                            <ReportImg img={img} />
                          </ImagePreview>
                          <ImageInfo>
                            <ImageFileName>{img.fileName}</ImageFileName>
                            <CaptionInput
                              value={img.caption}
                              onChange={(e) => updateImageCaption(catKey, imgIdx, e.target.value)}
                              placeholder="캡션을 입력하세요"
                              maxLength={36}
                            />
                          </ImageInfo>
                          <IconButton
                            type="button"
                            className="delete"
                            onClick={() => removeImage(catKey, imgIdx)}
                            title="이미지 삭제"
                          >
                            <Trash2 size={13} />
                          </IconButton>
                        </ImageItemCard>
                      ))}
                      {images.length < MAX_IMAGES_PER_SIDE && (
                        <AddImageButton
                          type="button"
                          onClick={() => triggerImageUpload(catKey)}
                          disabled={uploadingSlot === catKey}
                        >
                          <ImagePlus size={14} />
                          {uploadingSlot === catKey
                            ? '업로드 중…'
                            : `이미지 추가 (${images.length}/${MAX_IMAGES_PER_SIDE})`}
                        </AddImageButton>
                      )}
                      {imageError && (
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>
                          {imageError}
                        </div>
                      )}
                      {/* [Phase 1-2] 서버 업로드가 아닌 임시 보관 경로로 갈 때 그 사실을 드러낸다.
                          조용히 base64 로 저장되면 payload 가 계속 커지는데도 알 수 없다. */}
                      {!projectId && images.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#92400e', marginTop: '0.25rem' }}>
                          과제를 저장하면 이미지가 파일로 전환됩니다 (현재는 임시 보관)
                        </div>
                      )}
                      <ImageRatioHint>
                        권장 가로-세로 비율 — 1장: 3:1 / 2장: 1.5:1 / 3장: 1:1
                      </ImageRatioHint>
                    </ImageSideBody>
                  </ImageSideContainer>
                );
              })}
            </ImageSectionBody>
          </ImageSectionCard>

          {/* 상세 정보 입력 완료 체크박스 */}
          <CompletionRow>
            <CompletionCheckbox
              type="checkbox"
              checked={!!formData.상세정보_입력완료}
              onChange={(e) => handleInputChange({
                target: { name: '상세정보_입력완료', value: e.target.checked }
              })}
              id="detail-info-complete"
            />
            <CompletionLabel htmlFor="detail-info-complete">
              상세 정보 입력 완료
            </CompletionLabel>
          </CompletionRow>
        </ModalBody>

        <ModalFooter>
          <Button type="button" onClick={onClose}>닫기</Button>
          <Button type="button" className="primary" onClick={() => {
            onClose();
            if (onSaveAndUpload) {
              if (window.confirm('상세 과제 정보를 서버에 업로드하시겠습니까?')) {
                onSaveAndUpload();
              }
            }
          }}>확인</Button>
        </ModalFooter>
      </ModalContainer>
    </Overlay>
  );
};

export default DetailInfoModal;
