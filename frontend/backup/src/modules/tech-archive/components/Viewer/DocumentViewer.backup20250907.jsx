import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const ViewerContainer = styled.div`
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    max-height: none;
    height: auto;
  }
`;

const ViewerHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 1rem 1rem 0 0;
`;

const DocumentTitleSection = styled.div`
  margin-bottom: 1rem;
`;

const DocumentTitle = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
`;

const DocumentSubtitle = styled.p`
  font-size: 1rem;
  color: #6b7280;
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
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
`;

const MetaLabel = styled.span`
  font-weight: 600;
`;

const DocumentActions = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 2px solid ${props => props.variant === 'primary' ? '#3b82f6' : '#e5e7eb'};
  border-radius: 0.5rem;
  background: ${props => props.variant === 'primary' ? '#3b82f6' : 'white'};
  color: ${props => props.variant === 'primary' ? 'white' : '#6b7280'};
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.variant === 'primary' ? '#2563eb' : '#f3f4f6'};
    border-color: ${props => props.variant === 'primary' ? '#2563eb' : '#3b82f6'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusBadge = styled.span`
  background: ${props => props.color}15;
  color: ${props => props.color};
  border: 1px solid ${props => props.color}30;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
`;

const ViewerContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  min-height: 0;
`;

const DocumentContent = styled.div`
  max-width: none;
  
  h1, h2, h3, h4, h5, h6 {
    color: #111827;
    font-weight: 700;
    margin: 2rem 0 1rem 0;
    line-height: 1.3;
  }

  h1 { font-size: 2rem; }
  h2 { font-size: 1.5rem; }
  h3 { font-size: 1.25rem; }
  h4 { font-size: 1.125rem; }
  h5 { font-size: 1rem; }
  h6 { font-size: 0.875rem; }

  p {
    color: #374151;
    line-height: 1.7;
    margin: 1rem 0;
    font-size: 1rem;
  }

  ul, ol {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }

  li {
    color: #374151;
    line-height: 1.6;
    margin: 0.5rem 0;
  }

  pre {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    overflow-x: auto;
    margin: 1.5rem 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  code {
    background: #f1f5f9;
    color: #1e293b;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
  }

  pre code {
    background: none;
    padding: 0;
    color: #1e293b;
  }

  blockquote {
    border-left: 4px solid #3b82f6;
    background: #eff6ff;
    padding: 1rem 1.5rem;
    margin: 1.5rem 0;
    color: #1e40af;
    font-style: italic;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
    font-size: 0.875rem;
  }

  th, td {
    border: 1px solid #e5e7eb;
    padding: 0.75rem;
    text-align: left;
  }

  th {
    background: #f9fafb;
    font-weight: 600;
    color: #111827;
  }

  td {
    color: #374151;
  }

  hr {
    border: none;
    height: 1px;
    background: #e5e7eb;
    margin: 2rem 0;
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
    border-radius: 0.5rem;
    margin: 1rem 0;
  }
`;

const TagsSection = styled.div`
  margin: 2rem 0;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
`;

const TagsTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem 0;
`;

const TagsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const Tag = styled.span`
  background: #3b82f6;
  color: white;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
`;

const RelatedSection = styled.div`
  margin: 2rem 0;
  padding: 1.5rem;
  background: #f0f9ff;
  border-radius: 0.75rem;
  border: 1px solid #bae6fd;
`;

const RelatedTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #0c4a6e;
  margin: 0 0 1rem 0;
`;

const RelatedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const RelatedItem = styled.button`
  background: none;
  border: none;
  color: #0369a1;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;

  &:hover {
    color: #0284c7;
  }
`;

const EmptyViewer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 3rem;
  text-align: center;
  color: #6b7280;
  
  .icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }
  
  .description {
    font-size: 1rem;
    line-height: 1.6;
    max-width: 400px;
  }
`;

const DocumentViewer = ({
  document,
  onLike,
  onEdit,
  onDelete,
  statusOptions
}) => {
  const [isLiked, setIsLiked] = useState(false);

  if (!document) {
    return (
      <ViewerContainer>
        <EmptyViewer>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="icon">📖</div>
            <div className="title">문서를 선택하세요</div>
            <div className="description">
              좌측 목록에서 문서를 선택하면 여기에 내용이 표시됩니다.
            </div>
          </motion.div>
        </EmptyViewer>
      </ViewerContainer>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const option = statusOptions.find(s => s.id === status);
    return option ? option.color : '#6b7280';
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
    <ViewerContainer>
      <ViewerHeader>
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
          <MetaItem>
            <span>📅</span>
            <MetaLabel>생성일:</MetaLabel>
            <span>{formatDate(document.createdAt)}</span>
          </MetaItem>
          <MetaItem>
            <span>🔄</span>
            <MetaLabel>수정일:</MetaLabel>
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
            <span>{isLiked ? '❤️' : '🤍'}</span>
            <span>좋아요 ({document.likes})</span>
          </ActionButton>
          <ActionButton>
            <span>👁️</span>
            <span>조회수 {document.readCount}</span>
          </ActionButton>
          <ActionButton onClick={() => onEdit(document)}>
            <span>✏️</span>
            <span>편집</span>
          </ActionButton>
          <ActionButton onClick={() => onDelete(document.id)}>
            <span>🗑️</span>
            <span>삭제</span>
          </ActionButton>
          <ActionButton variant="primary">
            <span>📤</span>
            <span>공유</span>
          </ActionButton>
        </DocumentActions>
      </ViewerHeader>

      <ViewerContent>
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
      </ViewerContent>
    </ViewerContainer>
  );
};

export default DocumentViewer;
