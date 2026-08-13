import React from 'react';
import styled from 'styled-components';
import Header from './components/Layout/Header';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const Content = styled.main`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const PlaceholderText = styled.div`
  font-size: 2rem;
  color: #64748b;
  font-weight: 500;
`;

const OrganizationChartApp = ({ onGoHome }) => {
  return (
    <Container>
      <Header onGoHome={onGoHome} />
      <Content>
        <PlaceholderText>개발 예정</PlaceholderText>
      </Content>
    </Container>
  );
};

export default OrganizationChartApp;
