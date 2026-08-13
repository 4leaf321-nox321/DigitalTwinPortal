import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './MaturityPanel.css';

const MaturityPanel = ({ className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeLevel, setActiveLevel] = useState(null);

  const maturityLevels = [
    {
      id: 'adopt',
      title: 'Adopt',
      subtitle: '즉시 채택 권장',
      color: '#10B981',
      icon: '✅',
      description: '이미 충분히 성숙하고, 여러 사례에서 검증된 기술',
      message: '지금 바로 도입해도 실무/사업에서 효과를 볼 수 있다.'
    },
    {
      id: 'trial',
      title: 'Trial',
      subtitle: '시험 적용 권장',
      color: '#3B82F6',
      icon: '🧪',
      description: '유망하지만, 제한된 PoC나 파일럿 프로젝트에서 활용해보길 권장',
      message: '작은 범위에서 시도해보고, 성공하면 확대 가능.'
    },
    {
      id: 'assess',
      title: 'Assess',
      subtitle: '관찰·검토 필요',
      color: '#F59E0B',
      icon: '🔍',
      description: '기술적 가능성이 있지만 아직 미성숙하거나 표준화·레퍼런스가 부족',
      message: '장기적으로 기회가 될 수 있으므로 트렌드를 팔로업하라.'
    },
    {
      id: 'hold',
      title: 'Hold',
      subtitle: '보류/채택 비권장',
      color: '#EF4444',
      icon: '⚠️',
      description: '현재로서는 실무 적용 가치가 낮거나, 리스크/비용이 큰 경우',
      message: '지금은 도입하지 말고 필요시 재검토.'
    }
  ];

  const togglePanel = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setActiveLevel(null);
    }
  };

  const handleLevelClick = (levelId) => {
    setActiveLevel(activeLevel === levelId ? null : levelId);
  };

  return (
    <div className={`maturity-panel ${className}`}>
      <motion.div 
        className="maturity-panel-trigger"
        onClick={togglePanel}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="trigger-content">
          <span className="trigger-icon">📈</span>
          <span className="trigger-text">기술 성숙도 가이드</span>
          <motion.span 
            className="trigger-arrow"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            ▼
          </motion.span>
        </div>
      </motion.div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="maturity-panel-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="maturity-levels">
              {maturityLevels.map((level, index) => (
                <motion.div
                  key={level.id}
                  className={`maturity-level ${activeLevel === level.id ? 'active' : ''}`}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleLevelClick(level.id)}
                >
                  <div className="level-header">
                    <div className="level-icon" style={{ color: level.color }}>
                      {level.icon}
                    </div>
                    <div className="level-info">
                      <div className="level-title" style={{ color: level.color }}>
                        {level.title}
                      </div>
                      <div className="level-subtitle">
                        {level.subtitle}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {activeLevel === level.id && (
                      <motion.div
                        className="level-details"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="level-description">
                          {level.description}
                        </div>
                        <div className="level-message">
                          💡 {level.message}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            <div className="panel-footer">
              <div className="footer-note">
                💡 각 기술의 성숙도를 고려하여 도입 전략을 수립하세요
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MaturityPanel;
