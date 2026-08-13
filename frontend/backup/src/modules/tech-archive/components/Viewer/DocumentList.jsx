import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const ListContainer = styled.div`
  background: white;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  
  @media (max-width: 768px) {
    max-height: none;
    height: auto;
    border-radius: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const ListHeader = styled.div`
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
`;

const HeaderTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
`;

const HeaderSubtitle = styled.p`
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
`;

const ListContent = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, 280px);
  gap: 1rem;
  justify-content: center;
  align-content: start;
`;

const DocumentCard = styled(motion.div)`
  width: 280px;
  height: 380px;
  padding: 1.5rem;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e5e7eb'};
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.selected ? '#eff6ff' : 'white'};
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &:hover {
    border-color: #3b82f6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  }
`;

const DocumentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  gap: 1rem;
`;

const DocumentTitleSection = styled.div`
  flex: 1;
  min-width: 0;
`;

const DocumentTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.25rem 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const DocumentMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const MetaItem = styled.span`
  font-size: 0.75rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const DocumentTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const Tag = styled.span`
  background: #f3f4f6;
  color: #374151;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
`;

const StatusTag = styled.span`
  background: ${props => props.color}15;
  color: ${props => props.color};
  border: 1px solid ${props => props.color}30;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
`;

const DocumentDescription = styled.p`
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
  margin: 0 0 1rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  flex: 1;
`;

const DocumentFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid #f3f4f6;
  margin-top: auto;
`;

const AuthorInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
`;

const Stats = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #6b7280;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
  color: #6b7280;
  
  .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }
  
  .description {
    font-size: 0.875rem;
    line-height: 1.6;
  }
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  font-size: 1rem;
  color: #6b7280;
`;

const DocumentList = ({
  documents,
  selectedDocument,
  onDocumentSelect,
  isLoading,
  searchQuery,
  statusOptions
}) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const option = statusOptions.find(s => s.id === status);
    return option ? option.color : '#6b7280';
  };

  const getCategoryName = (category) => {
    const names = {
      gtr: 'GTR',
      mx: 'MX',
      vd: 'VD',
      da: 'DA',
      network: '네트워크',
      'medical-device': '의료기기'
    };
    return names[category] || category;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      gtr: '🎆',
      mx: '📊',
      vd: '📺',
      da: '📈',
      network: '🌐',
      'medical-device': '🏥'
    };
    return icons[category] || '📄';
  };

  const getTypeIcon = (type) => {
    const icons = {
      'new-simulation': '🎆',
      'simulation-automation': '⚙️',
      'ai-model-development': '🤖',
      'platform-development': '🖥️',
      'infrastructure': '🏢',
      'data-acquisition': '📈',
      'process-development': '🔄',
      guide: '📖',
      standard: '📋',
      procedure: '📝',
      security: '🔐',
      reference: '📚'
    };
    return icons[type] || '📄';
  };

  const getTypeLabel = (type) => {
    const labels = {
      'new-simulation': '신규 시뮬레이션 기법 개발',
      'simulation-automation': '시뮬레이션 자동화',
      'ai-model-development': 'AI 모델 개발',
      'platform-development': '플랫폼 개발&도입',
      'infrastructure': '인프라 구축&도입',
      'data-acquisition': '데이터 확보',
      'process-development': '신규 프로세스 구축'
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <ListContainer>
        <ListHeader>
          <HeaderTitle>📋 프로젝트 목록</HeaderTitle>
          <HeaderSubtitle>프로젝트를 불러오는 중...</HeaderSubtitle>
        </ListHeader>
        <LoadingState>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            ⏳
          </motion.div>
          <span style={{ marginLeft: '0.5rem' }}>로딩 중...</span>
        </LoadingState>
      </ListContainer>
    );
  }

  return (
    <ListContainer>
      <ListHeader>
        <HeaderTitle>📋 프로젝트 목록</HeaderTitle>
        <HeaderSubtitle>
          {documents.length > 0 
            ? `${documents.length}개의 프로젝트`
            : searchQuery 
              ? '검색 결과가 없습니다'
              : '표시할 프로젝트가 없습니다'
          }
        </HeaderSubtitle>
      </ListHeader>
      
      <ListContent>
        {documents.length === 0 ? (
          <EmptyState>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="icon">
                {searchQuery ? '🔍' : '📄'}
              </div>
              <div className="title">
                {searchQuery ? '검색 결과 없음' : '프로젝트가 없습니다'}
              </div>
              <div className="description">
                {searchQuery 
                  ? `"${searchQuery}"와 일치하는 프로젝트를 찾을 수 없습니다.`
                  : '아직 등록된 프로젝트가 없습니다. 새 프로젝트를 추가해보세요.'
                }
              </div>
            </motion.div>
          </EmptyState>
        ) : (
          documents.map((doc, index) => (
            <DocumentCard
              key={doc.id}
              selected={selectedDocument?.id === doc.id}
              onClick={() => onDocumentSelect(doc)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <DocumentTitle>{doc.title}</DocumentTitle>
              
              <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'flex-start' }}>
                <StatusTag color={getStatusColor(doc.status)}>
                  {statusOptions.find(s => s.id === doc.status)?.name || doc.status}
                </StatusTag>
              </div>

              <DocumentHeader>
                <DocumentTitleSection>
                  <DocumentMeta>
                    <MetaItem>
                      {getCategoryIcon(doc.category)} {getCategoryName(doc.category)}
                    </MetaItem>
                    <MetaItem>
                      {getTypeIcon(doc.type)} {getTypeLabel(doc.type)}
                    </MetaItem>
                    <MetaItem>
                      📅 {formatDate(doc.updatedAt)}
                    </MetaItem>
                    <MetaItem>
                      📝 v{doc.version}
                    </MetaItem>
                  </DocumentMeta>
                </DocumentTitleSection>
              </DocumentHeader>

              {doc.tags.length > 0 && (
                <DocumentTags>
                  {doc.tags.slice(0, 4).map(tag => (
                    <Tag key={tag}>#{tag}</Tag>
                  ))}
                  {doc.tags.length > 4 && (
                    <Tag>+{doc.tags.length - 4}</Tag>
                  )}
                </DocumentTags>
              )}

              <DocumentDescription>
                {doc.description}
              </DocumentDescription>

              <DocumentFooter>
                <AuthorInfo>
                  <span>👤</span>
                  <span>{doc.author}</span>
                </AuthorInfo>
                <Stats>
                  <StatItem>
                    <span>👁️</span>
                    <span>{doc.readCount}</span>
                  </StatItem>
                  <StatItem>
                    <span>❤️</span>
                    <span>{doc.likes}</span>
                  </StatItem>
                  {doc.attachments.length > 0 && (
                    <StatItem>
                      <span>📎</span>
                      <span>{doc.attachments.length}</span>
                    </StatItem>
                  )}
                </Stats>
              </DocumentFooter>
            </DocumentCard>
          ))
        )}
      </ListContent>
    </ListContainer>
  );
};

export default DocumentList;
