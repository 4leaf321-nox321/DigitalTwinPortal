import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { X, Heart, Eye, Edit3, Trash2, Share2 } from 'lucide-react';

const SideViewerContainer = styled.div`
  width: 100%;
  height: 100vh;
  background: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SideViewerHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  position: relative;
  flex-shrink: 0;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid #e2e8f0;
  border-radius: 50%;
  background: white;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 1.25rem;
  font-weight: bold;

  &:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #334155;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const DocumentTitleSection = styled.div`
  margin-bottom: 1rem;
  padding-right: 3rem;
`;

const DocumentTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
`;

const DocumentSubtitle = styled.p`
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
`;

const DocumentMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #64748b;
`;

const MetaLabel = styled.span`
  font-weight: 600;
`;

const StatusBadge = styled.span`
  background: ${props => props.color}15;
  color: ${props => props.color};
  border: 1px solid ${props => props.color}30;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
`;

const AssigneesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
`;

const AssigneeTag = styled.span`
  background: #3b82f6;
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 500;
`;

const DocumentActions = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${props => props.variant === 'primary' ? '#3b82f6' : '#e2e8f0'};
  border-radius: 0.375rem;
  background: ${props => props.variant === 'primary' ? '#3b82f6' : 'white'};
  color: ${props => props.variant === 'primary' ? 'white' : '#64748b'};
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.variant === 'primary' ? '#2563eb' : '#f8fafc'};
    border-color: ${props => props.variant === 'primary' ? '#2563eb' : '#cbd5e1'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SideViewerContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 2rem 1.5rem;
`;

const DocumentContent = styled.div`
  max-width: none;
  
  h1, h2, h3, h4, h5, h6 {
    color: #0f172a;
    font-weight: 700;
    margin: 1.5rem 0 0.75rem 0;
    line-height: 1.3;
  }

  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.25rem; }
  h3 { font-size: 1.125rem; }
  h4 { font-size: 1rem; }
  h5 { font-size: 0.875rem; }
  h6 { font-size: 0.75rem; }

  p {
    color: #334155;
    line-height: 1.6;
    margin: 0.75rem 0;
    font-size: 0.875rem;
  }

  ul, ol {
    margin: 0.75rem 0;
    padding-left: 1.25rem;
  }

  li {
    color: #334155;
    line-height: 1.5;
    margin: 0.375rem 0;
    font-size: 0.875rem;
  }

  pre {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    padding: 0.75rem;
    overflow-x: auto;
    margin: 1rem 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.75rem;
    line-height: 1.4;
  }

  code {
    background: #f1f5f9;
    color: #1e293b;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.75rem;
  }

  pre code {
    background: none;
    padding: 0;
    color: #1e293b;
  }

  blockquote {
    border-left: 3px solid #3b82f6;
    background: #eff6ff;
    padding: 0.75rem 1rem;
    margin: 1rem 0;
    color: #1e40af;
    font-style: italic;
    font-size: 0.875rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.75rem;
  }

  th, td {
    border: 1px solid #e5e7eb;
    padding: 0.5rem;
    text-align: left;
  }

  th {
    background: #f8fafc;
    font-weight: 600;
    color: #0f172a;
  }

  td {
    color: #334155;
  }

  hr {
    border: none;
    height: 1px;
    background: #e2e8f0;
    margin: 1.5rem 0;
  }

  a {
    color: #3b82f6;
    text-decoration: underline;
    
    &:hover {
      color: #2563eb;
    }
  }

  img {
    max-width: 100%;
    height: auto;
    border-radius: 0.375rem;
    margin: 0.75rem 0;
  }
`;

const TagsSection = styled.div`
  margin: 1.5rem 0;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
`;

const TagsTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  margin: 0 0 0.75rem 0;
`;

const TagsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
`;

const Tag = styled.span`
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
`;

const RelatedSection = styled.div`
  margin: 1.5rem 0;
  padding: 1rem;
  background: #ecfdf5;
  border-radius: 0.5rem;
  border: 1px solid #d1fae5;
`;

const RelatedTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #065f46;
  margin: 0 0 0.75rem 0;
`;

const RelatedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const RelatedItem = styled.button`
  background: none;
  border: none;
  color: #059669;
  font-size: 0.75rem;
  text-align: left;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;

  &:hover {
    color: #047857;
  }
`;

const EmptyViewer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 3rem 2rem;
  text-align: center;
  color: #64748b;
  
  .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #334155;
  }
  
  .description {
    font-size: 0.875rem;
    line-height: 1.6;
    max-width: 300px;
  }
`;

const DocumentViewer = ({
  document,
  onClose,
  onLike,
  onEdit,
  onDelete,
  statusOptions
}) => {
  const [isLiked, setIsLiked] = useState(false);

  if (!document) {
    return (
      <SideViewerContainer>
        <EmptyViewer>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="icon">📖</div>
            <div className="title">문서를 선택하세요</div>
            <div className="description">
              목록에서 문서를 선택하면 여기에 내용이 표시됩니다.
            </div>
          </motion.div>
        </EmptyViewer>
      </SideViewerContainer>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const option = statusOptions.find(s => s.id === status);
    return option ? option.color : '#64748b';
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike(document.id);
  };

  const renderContent = (content) => {
    // 간단한 마크다운 렌더링
    return content
      .split('\n')
      .map((line, index) => {
        // 헤딩 처리
        if (line.startsWith('# ')) {
          return <h1 key={index}>{line.substring(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index}>{line.substring(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={index}>{line.substring(4)}</h3>;
        }
        
        // 코드 블록 처리
        if (line.startsWith('```')) {
          const nextEndIndex = content.indexOf('```', content.indexOf(line) + 3);
          if (nextEndIndex !== -1) {
            const codeContent = content.substring(
              content.indexOf(line) + line.length + 1,
              nextEndIndex
            );
            return <pre key={index}><code>{codeContent}</code></pre>;
          }
        }
        
        // 일반 텍스트 (빈 줄 처리)
        if (line.trim() === '') {
          return <br key={index} />;
        }
        
        return <p key={index}>{line}</p>;
      });
  };

  return (
    <SideViewerContainer>
      <SideViewerHeader>
        <CloseButton onClick={onClose}>
          ✕
        </CloseButton>
        
        <DocumentTitleSection>
          <DocumentTitle>{document.title}</DocumentTitle>
          <DocumentSubtitle>{document.description}</DocumentSubtitle>
        </DocumentTitleSection>

        <DocumentMeta>
          <MetaItem>
            <span>👤</span>
            <MetaLabel>작성자:</MetaLabel>
            <span>{document.author}</span>
          </MetaItem>
          {document.assignees && document.assignees.length > 0 && (
            <MetaItem>
              <span>👥</span>
              <MetaLabel>담당자:</MetaLabel>
              <AssigneesContainer>
                {document.assignees.map((assignee, index) => (
                  <AssigneeTag key={index}>{assignee}</AssigneeTag>
                ))}
              </AssigneesContainer>
            </MetaItem>
          )}
          <MetaItem>
            <span>📅</span>
            <MetaLabel>생성:</MetaLabel>
            <span>{formatDate(document.createdAt)}</span>
          </MetaItem>
          <MetaItem>
            <span>🔄</span>
            <MetaLabel>수정:</MetaLabel>
            <span>{formatDate(document.updatedAt)}</span>
          </MetaItem>
          <MetaItem>
            <span>📝</span>
            <MetaLabel>버전:</MetaLabel>
            <span>v{document.version}</span>
          </MetaItem>
          <StatusBadge color={getStatusColor(document.status)}>
            {statusOptions.find(s => s.id === document.status)?.name || document.status}
          </StatusBadge>
        </DocumentMeta>

        <DocumentActions>
          <ActionButton onClick={handleLike}>
            <Heart size={14} strokeWidth={2} fill={isLiked ? 'currentColor' : 'none'} />
            <span>{document.likes}</span>
          </ActionButton>
          <ActionButton>
            <Eye size={14} strokeWidth={2} />
            <span>{document.readCount}</span>
          </ActionButton>
          <ActionButton onClick={() => onEdit(document)}>
            <Edit3 size={14} strokeWidth={2} />
            <span>편집</span>
          </ActionButton>
          <ActionButton onClick={() => onDelete(document.id)}>
            <Trash2 size={14} strokeWidth={2} />
            <span>삭제</span>
          </ActionButton>
          <ActionButton variant="primary">
            <Share2 size={14} strokeWidth={2} />
            <span>공유</span>
          </ActionButton>
        </DocumentActions>
      </SideViewerHeader>

      <SideViewerContent>
        <DocumentContent>
          {renderContent(document.content)}
        </DocumentContent>

        {document.tags && document.tags.length > 0 && (
          <TagsSection>
            <TagsTitle>🏷️ 태그</TagsTitle>
            <TagsList>
              {document.tags.map(tag => (
                <Tag key={tag}>#{tag}</Tag>
              ))}
            </TagsList>
          </TagsSection>
        )}

        {document.relatedDocs && document.relatedDocs.length > 0 && (
          <RelatedSection>
            <RelatedTitle>🔗 관련 문서</RelatedTitle>
            <RelatedList>
              {document.relatedDocs.map(relatedId => (
                <RelatedItem key={relatedId}>
                  {relatedId}
                </RelatedItem>
              ))}
            </RelatedList>
          </RelatedSection>
        )}
      </SideViewerContent>
    </SideViewerContainer>
  );
};

export default DocumentViewer;