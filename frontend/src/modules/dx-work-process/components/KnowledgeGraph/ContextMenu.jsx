import React, { useEffect, useRef } from 'react';
import { Edit2, Trash2, Copy, Link, Unlink } from 'lucide-react';
import './ContextMenu.css';

const ContextMenu = ({
  visible,
  position,
  type, // 'node' | 'edge' | 'canvas'
  targetId,
  onClose,
  onEdit,
  onDelete,
  onCopy,
  onAddEdge,
  onDisconnect
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  // 메뉴가 화면 밖으로 나가지 않도록 위치 조정
  useEffect(() => {
    if (visible && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = position.x;
      let adjustedY = position.y;

      if (rect.right > viewportWidth) {
        adjustedX = position.x - rect.width;
      }
      if (rect.bottom > viewportHeight) {
        adjustedY = position.y - rect.height;
      }

      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
    }
  }, [visible, position]);

  if (!visible) return null;

  const handleMenuClick = (action) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      {type === 'node' && (
        <>
          <div className="context-menu-header">
            노드
          </div>
          <button
            className="context-menu-item"
            onClick={() => handleMenuClick(onEdit)}
          >
            <Edit2 size={16} />
            <span>편집</span>
            <span className="shortcut">E</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleMenuClick(onAddEdge)}
          >
            <Link size={16} />
            <span>연결 추가</span>
          </button>
          <div className="context-menu-divider" />
          <button
            className="context-menu-item delete"
            onClick={() => handleMenuClick(onDelete)}
          >
            <Trash2 size={16} />
            <span>삭제</span>
            <span className="shortcut">Del</span>
          </button>
        </>
      )}

      {type === 'edge' && (
        <>
          <div className="context-menu-header">
            관계
          </div>
          <button
            className="context-menu-item"
            onClick={() => handleMenuClick(onEdit)}
          >
            <Edit2 size={16} />
            <span>편집</span>
            <span className="shortcut">E</span>
          </button>
          <div className="context-menu-divider" />
          <button
            className="context-menu-item delete"
            onClick={() => handleMenuClick(onDelete)}
          >
            <Trash2 size={16} />
            <span>삭제</span>
            <span className="shortcut">Del</span>
          </button>
        </>
      )}
    </div>
  );
};

export default ContextMenu;
