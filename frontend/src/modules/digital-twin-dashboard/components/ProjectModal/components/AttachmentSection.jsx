import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import { Paperclip, Upload, X, Download, File, FileText, FileImage, AlertCircle, Archive } from 'lucide-react';
import JSZip from 'jszip';
import {
  uploadProjectAttachment,
  deleteAttachment,
  getAttachmentBlob,
  getAttachmentBlobRaw
} from '../../../services/settingsApi';

const AttachmentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (max-width: 768px) {
    gap: 0.75rem;
  }
`;

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: 768px) {
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }
`;

const UploadArea = styled.div`
  border: 2px dashed ${props => props.$isDragOver ? '#10b981' : '#e5e7eb'};
  border-radius: 0.5rem;
  padding: 2rem;
  text-align: center;
  background-color: ${props => props.$isDragOver ? 'rgba(16, 185, 129, 0.05)' : '#f9fafb'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #10b981;
    background-color: rgba(16, 185, 129, 0.05);
  }

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const UploadIcon = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
  color: #9ca3af;
`;

const UploadText = styled.p`
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;

  span {
    color: #10b981;
    font-weight: 500;
  }
`;

const UploadSubtext = styled.p`
  margin: 0.25rem 0 0 0;
  color: #9ca3af;
  font-size: 0.75rem;
`;

const FileInput = styled.input`
  display: none;
`;

const FileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;

  @media (max-width: 768px) {
    padding: 0.625rem 0.75rem;
  }
`;

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
`;

const FileIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 0.25rem;
  background-color: ${props => props.$color || '#e5e7eb'};
  color: white;
  flex-shrink: 0;
`;

const FileDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileName = styled.p`
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileSize = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: #9ca3af;
`;

const FileActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  font-weight: 500;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &.download {
    background-color: #e0f2fe;
    color: #0369a1;

    &:hover:not(:disabled) {
      background-color: #bae6fd;
    }
  }

  &.delete {
    background-color: #fee2e2;
    color: #dc2626;

    &:hover:not(:disabled) {
      background-color: #fecaca;
    }
  }
`;

const UploadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #fef3c7;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #92400e;
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #fee2e2;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #dc2626;
`;

const PendingBadge = styled.span`
  background-color: #fef3c7;
  color: #92400e;
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  margin-left: 0.5rem;
`;

const DownloadAllButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 0.5rem;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const DownloadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #dbeafe;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #1d4ed8;
`;

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIconType = (mimeType, filename) => {
  if (mimeType?.startsWith('image/')) {
    return { type: 'image', color: '#10b981' };
  }
  if (mimeType?.includes('pdf')) {
    return { type: 'pdf', color: '#ef4444' };
  }
  if (mimeType?.includes('word') || filename?.endsWith('.doc') || filename?.endsWith('.docx')) {
    return { type: 'word', color: '#3b82f6' };
  }
  if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet') || filename?.endsWith('.xls') || filename?.endsWith('.xlsx')) {
    return { type: 'excel', color: '#22c55e' };
  }
  return { type: 'file', color: '#6b7280' };
};

const FileIconRenderer = ({ type }) => {
  switch (type) {
    case 'image':
      return <FileImage size={16} />;
    case 'pdf':
    case 'word':
    case 'excel':
      return <FileText size={16} />;
    default:
      return <File size={16} />;
  }
};

const AttachmentSection = ({
  projectId,
  attachments = [],
  pendingFiles = [],
  onAttachmentsChange,
  onPendingFilesChange,
  isEditMode = false
}) => {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;

    setError('');
    const fileArray = Array.from(files);

    // 프로젝트가 저장되지 않은 경우 (새 과제 추가 모드)
    if (!projectId) {
      // pendingFiles에 추가
      const newPendingFiles = fileArray.map(file => ({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        tempId: Date.now() + Math.random()
      }));

      if (onPendingFilesChange) {
        onPendingFilesChange([...pendingFiles, ...newPendingFiles]);
      }
      return;
    }

    // 프로젝트가 저장된 경우 (수정 모드) - 서버에 바로 업로드
    setUploading(true);

    try {
      for (const file of fileArray) {
        const result = await uploadProjectAttachment(projectId, file);
        if (result.attachment && onAttachmentsChange) {
          onAttachmentsChange(prev => [...prev, result.attachment]);
        }
      }
    } catch (err) {
      setError(err.message || '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleInputChange = (e) => {
    handleFileSelect(e.target.files);
    e.target.value = ''; // 같은 파일 다시 선택 가능하도록
  };

  // 단일 파일 다운로드 (서버에서 이미 ZIP으로 변환하여 DRM 우회)
  const handleDownload = async (attachment) => {
    try {
      setDownloadingId(attachment.id);
      setError('');

      // 서버에서 이미 ZIP으로 변환된 blob 가져오기
      const blob = await getAttachmentBlob(attachment.id);

      // 바로 다운로드 (서버에서 이미 ZIP 처리됨)
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // 파일명에서 확장자 제거 후 .zip 추가
      const baseFilename = attachment.original_filename.replace(/\.[^/.]+$/, '');
      a.download = `${baseFilename}.zip`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('파일 다운로드에 실패했습니다.');
    } finally {
      setDownloadingId(null);
    }
  };

  // 모든 파일 ZIP 다운로드 (원본 파일 사용)
  const handleDownloadAll = async () => {
    if (attachments.length === 0) return;

    try {
      setDownloading(true);
      setError('');

      const zip = new JSZip();

      // 모든 첨부파일 원본 다운로드 및 ZIP에 추가
      for (const attachment of attachments) {
        try {
          // 원본 파일 가져오기 (ZIP 변환 없이)
          const blob = await getAttachmentBlobRaw(attachment.id);
          zip.file(attachment.original_filename, blob);
        } catch (err) {
          console.error(`파일 다운로드 실패: ${attachment.original_filename}`, err);
        }
      }

      // ZIP 파일 생성 및 다운로드
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `첨부파일_${attachments.length}개.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('파일 다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (attachment) => {
    if (!window.confirm(`"${attachment.original_filename}" 파일을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteAttachment(attachment.id);
      if (onAttachmentsChange) {
        onAttachmentsChange(prev => prev.filter(a => a.id !== attachment.id));
      }
    } catch (err) {
      setError('파일 삭제에 실패했습니다.');
    }
  };

  const handleRemovePending = (tempId) => {
    if (onPendingFilesChange) {
      onPendingFilesChange(pendingFiles.filter(f => f.tempId !== tempId));
    }
  };

  return (
    <AttachmentContainer>
      <SectionTitle>
        <Paperclip size={16} />
        첨부 파일
      </SectionTitle>

      <UploadArea
        $isDragOver={isDragOver}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <UploadIcon>
          <Upload size={32} />
        </UploadIcon>
        <UploadText>
          <span>클릭</span>하거나 파일을 드래그하여 업로드
        </UploadText>
        <UploadSubtext>
          모든 파일 형식 지원
        </UploadSubtext>
      </UploadArea>

      <FileInput
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleInputChange}
      />

      {uploading && (
        <UploadingIndicator>
          <Upload size={16} />
          파일 업로드 중...
        </UploadingIndicator>
      )}

      {downloading && (
        <DownloadingIndicator>
          <Archive size={16} />
          ZIP 파일 생성 중...
        </DownloadingIndicator>
      )}

      {error && (
        <ErrorMessage>
          <AlertCircle size={16} />
          {error}
        </ErrorMessage>
      )}

      {(pendingFiles.length > 0 || attachments.length > 0) && (
        <FileList>
          {/* 대기 중인 파일 (새 과제에서 아직 업로드되지 않은 파일) */}
          {pendingFiles.map((file) => {
            const { type, color } = getFileIconType(file.type, file.name);
            return (
              <FileItem key={file.tempId}>
                <FileInfo>
                  <FileIconWrapper $color={color}>
                    <FileIconRenderer type={type} />
                  </FileIconWrapper>
                  <FileDetails>
                    <FileName>
                      {file.name}
                      <PendingBadge>저장 후 업로드</PendingBadge>
                    </FileName>
                    <FileSize>{formatFileSize(file.size)}</FileSize>
                  </FileDetails>
                </FileInfo>
                <FileActions>
                  <ActionButton
                    type="button"
                    className="delete"
                    onClick={() => handleRemovePending(file.tempId)}
                    title="제거"
                  >
                    <X size={14} />
                    제거
                  </ActionButton>
                </FileActions>
              </FileItem>
            );
          })}

          {/* 이미 업로드된 첨부파일 */}
          {attachments.map((attachment) => {
            const { type, color } = getFileIconType(attachment.mime_type, attachment.original_filename);
            const isDownloading = downloadingId === attachment.id;
            return (
              <FileItem key={attachment.id}>
                <FileInfo>
                  <FileIconWrapper $color={color}>
                    <FileIconRenderer type={type} />
                  </FileIconWrapper>
                  <FileDetails>
                    <FileName>{attachment.original_filename}</FileName>
                    <FileSize>{formatFileSize(attachment.file_size)}</FileSize>
                  </FileDetails>
                </FileInfo>
                <FileActions>
                  <ActionButton
                    type="button"
                    className="download"
                    onClick={() => handleDownload(attachment)}
                    title="ZIP으로 다운로드"
                    disabled={isDownloading}
                  >
                    <Archive size={14} />
                    {isDownloading ? 'ZIP 생성...' : 'ZIP 다운로드'}
                  </ActionButton>
                  <ActionButton
                    type="button"
                    className="delete"
                    onClick={() => handleDelete(attachment)}
                    title="삭제"
                    disabled={isDownloading}
                  >
                    <X size={14} />
                    삭제
                  </ActionButton>
                </FileActions>
              </FileItem>
            );
          })}
        </FileList>
      )}

      {/* 모든 파일 ZIP 다운로드 버튼 */}
      {attachments.length > 1 && (
        <DownloadAllButton
          type="button"
          onClick={handleDownloadAll}
          disabled={downloading}
        >
          <Archive size={18} />
          {downloading ? 'ZIP 파일 생성 중...' : `모든 파일 ZIP 다운로드 (${attachments.length}개)`}
        </DownloadAllButton>
      )}
    </AttachmentContainer>
  );
};

export default AttachmentSection;
