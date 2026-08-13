import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, Database, Copy, Info, Box, Download, Upload, Edit2, Check, ChevronDown, ChevronUp, GitBranch, ArrowRight, LayoutGrid, Table2, Search, Filter } from 'lucide-react';
import Header from './components/Layout/Header';
import ServerSyncModal from './components/ServerSyncModal';
import { todayLocalYmd } from '../../shared/utils/localDate';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const Content = styled.main`
  flex: 1;
  padding: 24px;
  overflow: auto;
`;

const ContentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const TableContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
`;

const Thead = styled.thead`
  background: #f1f5f9;
`;

const Th = styled.th`
  padding: 16px 20px;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
`;

const Tbody = styled.tbody``;

const Tr = styled.tr`
  &:hover {
    background: #f8fafc;
  }

  &:not(:last-child) {
    border-bottom: 1px solid #e2e8f0;
  }
`;

const Td = styled.td`
  padding: 16px 20px;
  font-size: 14px;
  color: #334155;
`;

const EmptyMessage = styled.div`
  padding: 60px 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 16px;
`;

// Modal Styles
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 16px;
  width: 80%;
  max-width: 80%;
  height: 80%;
  max-height: 80%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
`;

const ModalCloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #e2e8f0;
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  padding: 24px;
  flex: 1;
  overflow-y: auto;
`;

const ModalBodyTwoColumn = styled.div`
  padding: 24px;
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
`;

const ModalColumn = styled.div`
  display: flex;
  flex-direction: column;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  transition: all 0.2s;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const Button = styled.button`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &.primary {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
    border: none;

    &:hover {
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }

    &:disabled {
      background: #cbd5e1;
      cursor: not-allowed;
      box-shadow: none;
    }
  }

  &.secondary {
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;

    &:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
  }
`;

const LevelBadge = styled.span`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => props.$bgColor || '#f1f5f9'};
  color: ${props => props.$textColor || '#475569'};
`;

// Tag styles for element technologies
const TagContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  min-height: 44px;
  background: white;
  cursor: text;
  transition: all 0.2s;

  &:focus-within {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: #4338ca;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    background: transparent;
    color: #6366f1;
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.2s;

    &:hover {
      background: #a5b4fc;
      color: #3730a3;
    }
  }
`;

const TagInput = styled.input`
  flex: 1;
  min-width: 120px;
  border: none;
  outline: none;
  font-size: 14px;
  padding: 4px 0;
  background: transparent;

  &::placeholder {
    color: #94a3b8;
  }
`;

const TagList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SmallTag = styled.span`
  display: inline-block;
  padding: 2px 8px;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
`;

const ComponentListContainer = styled.div`
  display: flex;
  flex-direction: ${props => props.$expanded ? 'column' : 'row'};
  flex-wrap: ${props => props.$expanded ? 'nowrap' : 'wrap'};
  gap: 4px;
`;

const ComponentListHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  width: 100%;
  flex-shrink: 0;
`;

const ExpandAllButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 11px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #e2e8f0;
    color: #475569;
  }
`;

const ComponentListItem = styled.div`
  background: ${props => props.$expanded ? '#f8fafc' : 'transparent'};
  border-radius: 6px;
  border: ${props => props.$expanded ? '1px solid #e2e8f0' : 'none'};
  padding: ${props => props.$expanded ? '8px' : '0'};
  display: ${props => props.$expanded ? 'block' : 'inline-block'};
`;

const ComponentItemHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ComponentNameTag = styled.span`
  display: inline-block;
  padding: 2px 8px;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
`;

const ComponentDetailInline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
`;

const DetailRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
`;

const DetailLabel = styled.span`
  color: #64748b;
  min-width: 60px;
  flex-shrink: 0;
`;

const DetailValue = styled.span`
  color: #1e293b;
  line-height: 1.4;
`;

const ActionButtonGroup = styled.div`
  display: flex;
  gap: 6px;
  justify-content: center;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &.edit {
    background: #eff6ff;
    color: #3b82f6;

    &:hover {
      background: #dbeafe;
      color: #2563eb;
    }
  }

  &.delete {
    background: #fef2f2;
    color: #ef4444;

    &:hover {
      background: #fee2e2;
      color: #dc2626;
    }
  }
`;

const BulkElementTechContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  min-height: 36px;
  background: white;

  &:focus-within {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

// Settings Modal Styles
const SettingsModalContent = styled.div`
  background: white;
  border-radius: 16px;
  width: 80%;
  max-width: 80%;
  height: 80%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const SettingsModalBody = styled.div`
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
`;

const LevelList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;

const LevelItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
`;

const LevelColorPreview = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: ${props => props.$bgColor};
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const LevelName = styled.span`
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
`;

const DeleteLevelButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
`;

const EditLevelButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #e0e7ff;
    color: #6366f1;
  }
`;

const SaveEditButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: #10b981;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #059669;
  }
`;

const CancelEditButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: #94a3b8;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #64748b;
  }
`;

const EditInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #8b5cf6;
  border-radius: 6px;
  font-size: 14px;
  outline: none;

  &:focus {
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  }
`;

const EditColorInput = styled.input`
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
`;

const AddLevelForm = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
`;

const AddLevelInput = styled.input`
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const ColorInput = styled.input`
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  padding: 0;
  background: none;

  &::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  &::-webkit-color-swatch {
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }
`;

const AddLevelButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
  }

  &:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

// Bulk Add Modal Styles
const BulkAddModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const BulkAddModalContent = styled.div`
  background: white;
  border-radius: 16px;
  width: 80vw;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const BulkAddModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
`;

const BulkAddModalTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BulkAddModalBody = styled.div`
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
`;

const BulkAddInfoBox = styled.div`
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #93c5fd;
  border-radius: 8px;
  padding: 16px;

  h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: #1e40af;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  p {
    margin: 0;
    font-size: 13px;
    color: #1e40af;
    line-height: 1.6;
  }

  code {
    background: #dbeafe;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
  }
`;

const BulkAddTextArea = styled.textarea`
  flex: 1;
  width: 100%;
  padding: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Courier New', monospace;
  resize: none;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const BulkAddModalFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const BulkAddStats = styled.div`
  font-size: 14px;
  color: #64748b;
`;

const BulkAddButtons = styled.div`
  display: flex;
  gap: 12px;
`;

// Bulk Add Table Styles
const BulkAddTableWrapper = styled.div`
  flex: 1;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const BulkAddTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
`;

const BulkAddTableHead = styled.thead`
  background: #f1f5f9;
  position: sticky;
  top: 0;
  z-index: 10;
`;

const BulkAddTableBody = styled.tbody``;

const BulkAddTh = styled.th`
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;

  &.required::after {
    content: '*';
    color: #ef4444;
    margin-left: 4px;
  }
`;

const BulkAddTr = styled.tr`
  &:nth-child(even) {
    background: #f9fafb;
  }

  &:hover {
    background: #f3f4f6;
  }
`;

const BulkAddTd = styled.td`
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
`;

const BulkAddInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const BulkAddSelect = styled.select`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const BulkAddDeleteBtn = styled.button`
  padding: 6px;
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #fecaca;
  }
`;

const BulkAddActionBar = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
`;

const BulkAddActionBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid;

  &.add {
    background: #10b981;
    color: white;
    border-color: #059669;

    &:hover {
      background: #059669;
    }
  }

  &.load {
    background: #f59e0b;
    color: white;
    border-color: #d97706;

    &:hover {
      background: #d97706;
    }
  }

  &.paste {
    background: #3b82f6;
    color: white;
    border-color: #2563eb;

    &:hover {
      background: #2563eb;
    }
  }

  &.export {
    background: #8b5cf6;
    color: white;
    border-color: #7c3aed;

    &:hover {
      background: #7c3aed;
    }
  }

  &.clear {
    background: #ef4444;
    color: white;
    border-color: #dc2626;

    &:hover {
      background: #dc2626;
    }
  }
`;

// Paste Modal Styles
const PasteModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
`;

const PasteModalContent = styled.div`
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const PasteModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-radius: 12px 12px 0 0;
`;

const PasteModalBody = styled.div`
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PasteModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 0 0 12px 12px;
`;

// Tab Styles
const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 20px;
`;

const Tab = styled.button`
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.$active ? '#8b5cf6' : '#64748b'};
  border-bottom: 2px solid ${props => props.$active ? '#8b5cf6' : 'transparent'};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: #8b5cf6;
    background: #f8fafc;
  }
`;

const TabContent = styled.div`
  display: ${props => props.$active ? 'flex' : 'none'};
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

// Tech Radar View Styles
const RadarContainer = styled.div`
  display: flex;
  flex: 1;
  gap: 24px;
  height: calc(100vh - 120px);
`;

const RadarChartWrapper = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 20px;
  position: relative;
  overflow: hidden;
  user-select: none;
`;

const RadarLegend = styled.div`
  width: 280px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 20px;
  overflow-y: auto;
`;

const LegendTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid #e2e8f0;
`;

const LegendSection = styled.div`
  margin-bottom: 20px;
`;

const LegendSectionTitle = styled.h4`
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  margin: 0 0 10px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  transition: background 0.2s;

  &:hover {
    background: #f8fafc;
  }
`;

const LegendColor = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: ${props => props.$color};
  border: 1px solid rgba(0,0,0,0.1);
`;

const LegendRing = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 3px solid ${props => props.$color};
  background: transparent;
`;

const LegendLabel = styled.span`
  font-size: 13px;
  color: #334155;
`;

const RadarEmptyMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  gap: 16px;
  text-align: center;

  svg {
    width: 64px;
    height: 64px;
    color: #cbd5e1;
  }

  span {
    font-size: 16px;
  }
`;

const GoalTooltip = styled.div`
  position: fixed;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 12px 16px;
  z-index: 1000;
  max-width: 300px;
  pointer-events: none;

  .tooltip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .tooltip-title {
    font-weight: 600;
    font-size: 14px;
    color: #1e293b;
  }

  .tooltip-category {
    font-size: 12px;
    color: #8b5cf6;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .tooltip-level {
    display: inline-block;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 500;
  }

  .tooltip-techs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }

  .tooltip-tech {
    font-size: 11px;
    padding: 2px 6px;
    background: #e0e7ff;
    color: #4338ca;
    border-radius: 4px;
  }
`;

// Component View Styles
const ComponentViewContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const ComponentViewHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ComponentViewTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AddComponentButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }
`;

const ComponentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
`;

const ComponentCard = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 20px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #cbd5e1;
  }
`;

const ComponentCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
`;

const ComponentName = styled.h4`
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  word-break: break-word;
  flex: 1;
  min-width: 0;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const ComponentCardActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ComponentCardActionBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
`;

const ComponentCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ComponentField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ComponentFieldLabel = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ComponentFieldValue = styled.span`
  font-size: 14px;
  color: #334155;
`;

const ComponentBadge = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => props.$bgColor || '#f1f5f9'};
  color: ${props => props.$textColor || '#475569'};
`;

// 의존성 그래프 스타일
const DependencyGraphContainer = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin-top: 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const DependencyGraphHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const DependencyGraphTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
`;

const RelationTypeSelector = styled.div`
  display: flex;
  gap: 6px;
`;

const RelationTypeButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid ${props => props.$active ? props.$color : '#e2e8f0'};
  border-radius: 6px;
  background: ${props => props.$active ? props.$color + '15' : 'white'};
  color: ${props => props.$active ? props.$color : '#64748b'};
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: ${props => props.$color};
    background: ${props => props.$color}10;
  }
`;

const GraphCanvas = styled.div`
  position: relative;
  min-height: 180px;
  background: white;
  border-radius: 8px;
  border: 1px dashed #e2e8f0;
  overflow: hidden;
`;

const GraphCanvasLarge = styled.div`
  position: relative;
  min-height: 500px;
  flex: 1;
  background: white;
  border-radius: 8px;
  border: 1px dashed #e2e8f0;
  overflow: hidden;
`;

const GraphSvg = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
`;

const GraphNode = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 100px;
  max-width: 220px;
  padding: 8px 10px;
  background: ${props => props.$selected ? '#3b82f6' : 'white'};
  color: ${props => props.$selected ? 'white' : '#1e293b'};
  border: 2px solid ${props => props.$selected ? '#3b82f6' : '#e2e8f0'};
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: 1;
  text-align: center;
  word-break: break-word;
  overflow-wrap: break-word;
  transform: translate(-50%, -50%);

  &:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.15);
  }
`;

const GraphNodeLabel = styled.span`
  font-size: 9px;
  color: ${props => props.$selected ? 'rgba(255,255,255,0.8)' : '#94a3b8'};
  margin-top: 2px;
`;

const GraphNodeBadges = styled.div`
  display: flex;
  gap: 3px;
  margin-top: 4px;
  flex-wrap: wrap;
  justify-content: center;
`;

const GraphNodeBadge = styled.span`
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 3px;
  background: ${props => props.$bgColor || '#f1f5f9'};
  color: ${props => props.$textColor || '#475569'};
  white-space: nowrap;
`;

const RelationsList = styled.div`
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const RelationsGrid = styled.div`
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
`;

const RelationItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
`;

const RelationItemCompact = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 8px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;

  &:hover {
    border-color: #94a3b8;

    .delete-btn {
      opacity: 1;
    }
  }

  .delete-btn {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    border: none;
    background: #ef4444;
    color: white;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }
`;

const RelationArrow = styled.span`
  color: ${props => props.$color || '#64748b'};
  font-weight: 600;
`;

const RelationDeleteBtn = styled.button`
  margin-left: auto;
  padding: 4px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
`;

const GraphInstruction = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 180px;
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
  line-height: 1.6;
`;

// 카드 뷰 스타일
const SubViewToggle = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 3px;
  margin-bottom: 16px;
`;

const SubViewButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.$active ? 'white' : 'transparent'};
  color: ${props => props.$active ? '#8b5cf6' : '#64748b'};
  box-shadow: ${props => props.$active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'};

  &:hover {
    color: ${props => props.$active ? '#8b5cf6' : '#1e293b'};
  }
`;

// 카드 뷰 필터 스타일
const FilterContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  overflow: hidden;
`;

const FilterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #f8fafc;
  border-bottom: ${props => props.$expanded ? '1px solid #e2e8f0' : 'none'};
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #f1f5f9;
  }
`;

const FilterHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
`;

const FilterHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ActiveFilterCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: #8b5cf6;
  color: white;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
`;

const FilterClearButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #fef2f2;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  color: #ef4444;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #fee2e2;
  }
`;

const FilterBody = styled.div`
  padding: ${props => props.$expanded ? '16px 20px' : '0'};
  max-height: ${props => props.$expanded ? '300px' : '0'};
  overflow: hidden;
  transition: all 0.3s ease;
`;

const FilterGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr;
  gap: 12px;
  align-items: end;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FilterLabel = styled.label`
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FilterInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #1e293b;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #1e293b;
  background: white;
  cursor: pointer;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const FilterResultInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  font-size: 13px;
  color: #64748b;
`;

const FilterResultCount = styled.span`
  font-weight: 600;
  color: #8b5cf6;
`;

const CardViewContainer = styled.div`
  column-count: 2;
  column-gap: 20px;
`;

const MegaTaskCard = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: box-shadow 0.2s;
  break-inside: avoid;
  margin-bottom: 20px;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const CardHeader = styled.div`
  padding: 16px 20px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
`;

const CardTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
`;

const CardMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
`;

const CardMetaBadge = styled.span`
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255,255,255,0.2);
`;

const CardBody = styled.div`
  padding: 16px 20px;
`;

const CardSection = styled.div`
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const CardSectionTitle = styled.h4`
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CardGraphContainer = styled.div`
  position: relative;
  min-height: 150px;
  height: ${props => props.$height ? `${props.$height}px` : '300px'};
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  transition: ${props => props.$isResizing ? 'none' : 'height 0.1s ease'};
`;

const ResizeHandle = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 12px;
  background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.05));
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: linear-gradient(to bottom, transparent, rgba(139, 92, 246, 0.15));
  }

  &::after {
    content: '';
    width: 40px;
    height: 4px;
    background: #cbd5e1;
    border-radius: 2px;
    transition: background 0.2s;
  }

  &:hover::after {
    background: #8b5cf6;
  }
`;

const CardComponentList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const CardComponentBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 12px;
  color: #475569;
`;

const CardFooter = styled.div`
  padding: 12px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CardDate = styled.span`
  font-size: 12px;
  color: #94a3b8;
`;

const CardActions = styled.div`
  display: flex;
  gap: 8px;
`;

const CardActionBtn = styled.button`
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
  }

  &.delete:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
`;

const ComponentEmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  color: #94a3b8;
  gap: 16px;
  text-align: center;

  svg {
    width: 48px;
    height: 48px;
    color: #cbd5e1;
  }
`;

// Component Search Styles
const ComponentSearchContainer = styled.div`
  position: relative;
`;

const ComponentSearchInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  transition: all 0.2s;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const ComponentSearchDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  margin-top: 4px;
`;

const ComponentSearchItem = styled.div`
  padding: 10px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.2s;

  &:hover {
    background: #f8fafc;
  }

  &:not(:last-child) {
    border-bottom: 1px solid #f1f5f9;
  }
`;

const ComponentSearchItemName = styled.span`
  font-size: 14px;
  color: #1e293b;
  font-weight: 500;
`;

const ComponentSearchItemInfo = styled.span`
  font-size: 12px;
  color: #64748b;
`;

const ComponentSearchEmpty = styled.div`
  padding: 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
`;

const SelectedComponentsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

// Default level options
const defaultLevelOptions = [
  { id: 1, name: '도입(Adopt)', bgColor: '#dcfce7', textColor: '#166534' },
  { id: 2, name: '시험(Trial)', bgColor: '#dbeafe', textColor: '#1e40af' },
  { id: 3, name: '평가(Assess)', bgColor: '#fef3c7', textColor: '#92400e' },
  { id: 4, name: '보류(Hold)', bgColor: '#f1f5f9', textColor: '#475569' }
];

// Default business unit options
const defaultBusinessUnitOptions = [
  { id: 1, name: 'MX' },
  { id: 2, name: 'VD' },
  { id: 3, name: 'DA' },
  { id: 4, name: 'NW' },
  { id: 5, name: '의료기기' }
];

// Default category options
const defaultCategoryOptions = [
  { id: 1, name: '개발 단계 Shift-Left' },
  { id: 2, name: '시장 불량 반영된 가상 검증 시뮬레이션' }
];

// Default tech type options (기술 구분)
const defaultTechTypeOptions = [
  { id: 1, name: '시뮬레이션 기법 개발', bgColor: '#dbeafe', textColor: '#1e40af' },
  { id: 2, name: '시뮬레이션 자동화 개발', bgColor: '#dcfce7', textColor: '#166534' },
  { id: 3, name: '데이터 기반 AI/ML 개발', bgColor: '#f3e8ff', textColor: '#7c3aed' },
  { id: 4, name: '검증 S/W 개발', bgColor: '#fef3c7', textColor: '#92400e' }
];

// Card Graph View Component with zoom/pan and resize
const CardGraphView = ({ item, itemComponents, nodePositions, componentRelations, maturityLevelOptions, getDefaultNodePosition, getEdgePoint, height, onHeightChange, savedZoomPan, onZoomPanChange }) => {
  const [zoom, setZoom] = useState(savedZoomPan?.zoom || 1);
  const [pan, setPan] = useState(savedZoomPan?.pan || { x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ y: 0, height: 0 });
  const [hasFitted, setHasFitted] = useState(!!savedZoomPan); // 저장된 상태가 있으면 fit하지 않음
  const containerRef = useRef(null);

  // 저장된 상태가 변경되면 적용
  React.useEffect(() => {
    if (savedZoomPan) {
      setZoom(savedZoomPan.zoom);
      setPan(savedZoomPan.pan);
      setHasFitted(true);
    }
  }, [savedZoomPan]);

  // Fit-to-view: 모든 노드가 화면에 들어오도록 초기 zoom/pan 설정 (저장된 상태가 없을 때만)
  React.useEffect(() => {
    if (hasFitted || itemComponents.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // 노드 사이즈 (대략적인 값)
    const nodeWidth = 120;
    const nodeHeight = 60;
    const padding = 30;

    // 모든 노드의 바운딩 박스 계산
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    itemComponents.forEach((comp) => {
      const pos = nodePositions[comp.id] || getDefaultNodePosition(comp.id, item.elementTechnologies || [], 350, 180);
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + nodeWidth);
      maxY = Math.max(maxY, pos.y + nodeHeight);
    });

    if (minX === Infinity) return;

    // 콘텐츠 영역 크기
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    // 줌 레벨 계산 (콘텐츠가 컨테이너에 맞도록)
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const fitZoom = Math.min(scaleX, scaleY, 1); // 최대 1배율로 제한

    // 중앙 정렬을 위한 pan 계산
    const scaledContentWidth = contentWidth * fitZoom;
    const scaledContentHeight = contentHeight * fitZoom;
    const panX = (containerWidth - scaledContentWidth) / 2 - (minX - padding) * fitZoom;
    const panY = (containerHeight - scaledContentHeight) / 2 - (minY - padding) * fitZoom;

    setZoom(fitZoom);
    setPan({ x: panX, y: panY });
    setHasFitted(true);

    // 초기 fit 결과도 저장
    if (onZoomPanChange) {
      onZoomPanChange(item.id, fitZoom, { x: panX, y: panY });
    }
  }, [itemComponents, nodePositions, item.elementTechnologies, getDefaultNodePosition, hasFitted, item.id, onZoomPanChange]);

  // item이 바뀌면 다시 fit (저장된 상태가 없을 때만)
  React.useEffect(() => {
    if (!savedZoomPan) {
      setHasFitted(false);
    }
  }, [item.id, savedZoomPan]);

  const handleWheel = React.useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prevZoom => {
      const newZoom = Math.min(Math.max(prevZoom * delta, 0.3), 3);
      const zoomRatio = newZoom / prevZoom;
      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * zoomRatio,
        y: mouseY - (mouseY - prev.y) * zoomRatio
      }));
      return newZoom;
    });
  }, []);

  // 휠 이벤트를 passive: false로 등록
  React.useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;

    const wheelHandler = (e) => {
      e.preventDefault();
      handleWheel(e);
    };

    canvas.addEventListener('wheel', wheelHandler, { passive: false });
    return () => canvas.removeEventListener('wheel', wheelHandler);
  }, [handleWheel]);

  const handleMouseDown = (e) => {
    if (e.target === containerRef.current || e.target.tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    // 팬 완료 시 상태 저장
    if (onZoomPanChange) {
      onZoomPanChange(item.id, zoom, pan);
    }
  };

  // 줌 변경 시 상태 저장 (휠 줌 후)
  React.useEffect(() => {
    if (hasFitted && onZoomPanChange) {
      // debounce 효과를 위해 타이머 사용
      const timer = setTimeout(() => {
        onZoomPanChange(item.id, zoom, pan);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [zoom, pan, item.id, onZoomPanChange, hasFitted]);

  // Resize handlers
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const currentHeight = height || 300;
    setResizeStart({ y: e.clientY, height: currentHeight });

    const handleResizeMove = (moveE) => {
      const deltaY = moveE.clientY - e.clientY;
      const newHeight = Math.max(150, Math.min(800, currentHeight + deltaY));
      onHeightChange && onHeightChange(item.id, newHeight);
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  return (
    <CardGraphContainer
      ref={containerRef}
      $height={height}
      $isResizing={isResizing}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '3000px',
          height: '3000px',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '3000px',
            height: '3000px',
            overflow: 'visible'
          }}
        >
          <defs>
            <marker
              id={`arrowhead-card-${item.id}`}
              markerWidth="12"
              markerHeight="9"
              refX="11"
              refY="4.5"
              orient="auto"
            >
              <polygon
                points="0 0, 12 4.5, 0 9"
                fill="#475569"
              />
            </marker>
          </defs>
          {componentRelations.map((rel) => {
            const sourceIdx = (item.elementTechnologies || []).indexOf(rel.source);
            const targetIdx = (item.elementTechnologies || []).indexOf(rel.target);
            if (sourceIdx === -1 || targetIdx === -1) return null;

            const sourcePos = nodePositions[rel.source] || getDefaultNodePosition(rel.source, item.elementTechnologies || [], 350, 180);
            const targetPos = nodePositions[rel.target] || getDefaultNodePosition(rel.target, item.elementTechnologies || [], 350, 180);

            const sourceEdge = getEdgePoint(sourcePos, targetPos);
            const targetEdge = getEdgePoint(targetPos, sourcePos);

            return (
              <line
                key={rel.id}
                x1={sourceEdge.x}
                y1={sourceEdge.y}
                x2={targetEdge.x}
                y2={targetEdge.y}
                stroke="#475569"
                strokeWidth="2.5"
                markerEnd={`url(#arrowhead-card-${item.id})`}
              />
            );
          })}
        </svg>
        {itemComponents.map((comp) => {
          const pos = nodePositions[comp.id] || getDefaultNodePosition(comp.id, item.elementTechnologies || [], 350, 180);
          const maturityOption = maturityLevelOptions.find(m => m.value === comp.maturityLevel);
          return (
            <div
              key={comp.id}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '100px',
                maxWidth: '220px',
                padding: '8px 10px',
                background: 'white',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 600,
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                zIndex: 1,
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }}
            >
              {comp.name}
              <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                {comp.techType}
              </div>
              <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: '#e0e7ff', color: '#3730a3' }}>
                  {comp.department}
                </span>
                {comp.maturityLevel && (
                  <span style={{
                    fontSize: '8px',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    background: maturityOption?.bgColor || '#f1f5f9',
                    color: maturityOption?.textColor || '#475569'
                  }}>
                    {comp.maturityLevel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {componentRelations.length === 0 && itemComponents.length >= 2 && (
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '11px',
          color: '#94a3b8',
          zIndex: 2
        }}>
          관계가 설정되지 않았습니다
        </div>
      )}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        right: '8px',
        fontSize: '10px',
        color: '#94a3b8',
        background: 'rgba(255,255,255,0.8)',
        padding: '2px 6px',
        borderRadius: '4px',
        zIndex: 2
      }}>
        {Math.round(zoom * 100)}%
      </div>
      <ResizeHandle onMouseDown={handleResizeStart} title="드래그하여 높이 조절" />
    </CardGraphContainer>
  );
};

const DigitalTwinTechLevelApp = ({ onGoHome }) => {
  const [data, setData] = useState([]);
  const [viewMode, setViewMode] = useState('table');
  const [tableSubView, setTableSubView] = useState('card'); // 'table' or 'card'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [levelOptions, setLevelOptions] = useState(defaultLevelOptions);
  const [businessUnitOptions, setBusinessUnitOptions] = useState(defaultBusinessUnitOptions);
  const [categoryOptions, setCategoryOptions] = useState(defaultCategoryOptions);
  const [newLevelName, setNewLevelName] = useState('');
  const [newLevelColor, setNewLevelColor] = useState('#8b5cf6');
  const [hoveredGoal, setHoveredGoal] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const radarSvgRef = useRef(null);
  const radarContainerRef = useRef(null);
  const [radarScale, setRadarScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [newBusinessUnitName, setNewBusinessUnitName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newTechTypeName, setNewTechTypeName] = useState('');
  const [newTechTypeColor, setNewTechTypeColor] = useState('#8b5cf6');
  const [activeSettingsTab, setActiveSettingsTab] = useState('level');

  // 카드 뷰 필터 관련 상태
  const [cardFilters, setCardFilters] = useState({
    searchText: '',
    category: '',
    level: '',
    businessUnit: '',
    component: ''
  });
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [graphHeights, setGraphHeights] = useState({}); // { itemId: height }
  const [cardGraphZoomPan, setCardGraphZoomPan] = useState({}); // { itemId: { zoom, pan: { x, y } } }

  // 그래프 높이 변경 핸들러
  const handleGraphHeightChange = (itemId, newHeight) => {
    setGraphHeights(prev => ({ ...prev, [itemId]: newHeight }));
  };

  // 카드 그래프 줌/팬 변경 핸들러
  const handleCardGraphZoomPanChange = (itemId, zoom, pan) => {
    setCardGraphZoomPan(prev => ({ ...prev, [itemId]: { zoom, pan } }));
  };

  // 설정 수정 관련 상태
  const [editingLevelId, setEditingLevelId] = useState(null);
  const [editingLevelName, setEditingLevelName] = useState('');
  const [editingLevelColor, setEditingLevelColor] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingBusinessUnitId, setEditingBusinessUnitId] = useState(null);
  const [editingBusinessUnitName, setEditingBusinessUnitName] = useState('');
  const [editingTechTypeId, setEditingTechTypeId] = useState(null);
  const [editingTechTypeName, setEditingTechTypeName] = useState('');
  const [editingTechTypeColor, setEditingTechTypeColor] = useState('');

  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [bulkAddText, setBulkAddText] = useState('');
  const [bulkTableData, setBulkTableData] = useState([{ goal: '', abbreviation: '', category: '', level: '', businessUnit: '', registrationDate: '' }]);
  const bulkAddTextAreaRef = useRef(null);
  const [formData, setFormData] = useState({
    goal: '',
    abbreviation: '',
    category: '',
    level: '',
    businessUnit: '',
    elementTechnologies: [],
    componentRelations: [],
    nodePositions: {},
    registrationDate: todayLocalYmd()
  });

  // 관계 편집 상태
  const [selectedSourceNode, setSelectedSourceNode] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [graphZoom, setGraphZoom] = useState(1);
  const [editGraphZoom, setEditGraphZoom] = useState(1);
  const [hoveredRelation, setHoveredRelation] = useState(null);
  // 그래프 PAN 관련 상태
  const [graphPan, setGraphPan] = useState({ x: 0, y: 0 });
  const [editGraphPan, setEditGraphPan] = useState({ x: 0, y: 0 });
  const [isGraphPanning, setIsGraphPanning] = useState(false);
  const [graphPanStart, setGraphPanStart] = useState({ x: 0, y: 0 });
  const graphCanvasRef = useRef(null);
  const [elementTechInput, setElementTechInput] = useState('');
  const elementTechInputRef = useRef(null);

  // 구성 요소 검색 관련 상태
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [isComponentSearchOpen, setIsComponentSearchOpen] = useState(false);

  // 구성 요소 관련 상태
  const [components, setComponents] = useState([]);
  const [techTypeOptions, setTechTypeOptions] = useState(defaultTechTypeOptions);
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [componentFormData, setComponentFormData] = useState({
    name: '',
    department: '',
    techType: '',
    maturityLevel: '',
    description: ''
  });

  // 역량 성숙도 옵션
  const maturityLevelOptions = [
    { value: '사용 중', bgColor: '#dcfce7', textColor: '#166534' },
    { value: '검증 중', bgColor: '#dbeafe', textColor: '#1e40af' },
    { value: '준비 중', bgColor: '#fef3c7', textColor: '#92400e' },
    { value: '계획 중', bgColor: '#f3e8ff', textColor: '#7c3aed' },
    { value: '불가', bgColor: '#fee2e2', textColor: '#991b1b' }
  ];
  const [expandedRowIds, setExpandedRowIds] = useState(new Set());

  // 수정 관련 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [isEditComponentModalOpen, setIsEditComponentModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);
  const [editComponentFormData, setEditComponentFormData] = useState(null);

  // 서버 저장/불러오기 모달 상태
  const [isServerSyncModalOpen, setIsServerSyncModalOpen] = useState(false);

  // 현재 데이터 가져오기
  const getCurrentData = () => {
    return {
      goals: data,
      components: components,
      levelOptions: levelOptions,
      categoryOptions: categoryOptions,
      businessUnitOptions: businessUnitOptions,
      techTypeOptions: techTypeOptions,
      graphHeights: graphHeights,
      cardGraphZoomPan: cardGraphZoomPan,
      graphViewState: {
        zoom: editGraphZoom,
        pan: editGraphPan
      }
    };
  };

  // 서버에서 데이터 불러오기
  const handleLoadFromServer = (loadedData) => {
    if (loadedData.goals) {
      setData(loadedData.goals);
    }
    if (loadedData.components) {
      setComponents(loadedData.components);
    }
    if (loadedData.levelOptions) {
      setLevelOptions(loadedData.levelOptions);
    }
    if (loadedData.categoryOptions) {
      setCategoryOptions(loadedData.categoryOptions);
    }
    if (loadedData.businessUnitOptions) {
      setBusinessUnitOptions(loadedData.businessUnitOptions);
    }
    if (loadedData.techTypeOptions) {
      setTechTypeOptions(loadedData.techTypeOptions);
    }
    if (loadedData.graphHeights) {
      setGraphHeights(loadedData.graphHeights);
    }
    // 카드 그래프 줌/팬 상태 복원
    if (loadedData.cardGraphZoomPan) {
      setCardGraphZoomPan(loadedData.cardGraphZoomPan);
    }
    // 그래프 뷰 상태 복원 (줌/팬)
    if (loadedData.graphViewState) {
      if (loadedData.graphViewState.zoom !== undefined) {
        setEditGraphZoom(loadedData.graphViewState.zoom);
      }
      if (loadedData.graphViewState.pan) {
        setEditGraphPan(loadedData.graphViewState.pan);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handlers for element technologies (tag input)
  const handleAddElementTech = (e) => {
    if (e.key === 'Enter' && elementTechInput.trim()) {
      e.preventDefault();
      const newTech = elementTechInput.trim();
      if (!formData.elementTechnologies.includes(newTech)) {
        setFormData(prev => ({
          ...prev,
          elementTechnologies: [...prev.elementTechnologies, newTech]
        }));
      }
      setElementTechInput('');
    }
  };

  const handleRemoveElementTech = (techIdToRemove) => {
    setFormData(prev => ({
      ...prev,
      elementTechnologies: prev.elementTechnologies.filter(id => id !== techIdToRemove),
      // 해당 구성요소와 관련된 관계도 함께 삭제
      componentRelations: prev.componentRelations.filter(
        rel => rel.source !== techIdToRemove && rel.target !== techIdToRemove
      )
    }));
    // 선택된 소스 노드가 삭제된 노드면 초기화
    if (selectedSourceNode === techIdToRemove) {
      setSelectedSourceNode(null);
    }
  };

  // 구성 요소 관계 핸들러
  const handleNodeClick = (compId, e) => {
    // 드래그 중이면 클릭 이벤트 무시
    if (draggingNode) return;

    if (!selectedSourceNode) {
      // 첫 번째 노드 선택 (소스)
      setSelectedSourceNode(compId);
    } else if (selectedSourceNode === compId) {
      // 같은 노드 다시 클릭하면 선택 해제
      setSelectedSourceNode(null);
    } else {
      // 두 번째 노드 선택 (타겟) - 관계 추가
      const newRelation = {
        id: Date.now(),
        source: selectedSourceNode,
        target: compId
      };

      // 중복 관계 체크
      const isDuplicate = formData.componentRelations.some(
        rel => rel.source === newRelation.source && rel.target === newRelation.target
      );

      if (!isDuplicate) {
        setFormData(prev => ({
          ...prev,
          componentRelations: [...prev.componentRelations, newRelation]
        }));
      }
      setSelectedSourceNode(null);
    }
  };

  // 노드 드래그 핸들러
  const handleNodeMouseDown = (compId, e) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = graphCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const nodePos = formData.nodePositions[compId] || getDefaultNodePosition(compId, formData.elementTechnologies);

    setDraggingNode(compId);
    // 줌/팬을 고려한 offset 계산
    setDragOffset({
      x: e.clientX - rect.left - graphPan.x - nodePos.x * graphZoom,
      y: e.clientY - rect.top - graphPan.y - nodePos.y * graphZoom
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (!draggingNode) return;
    const canvas = graphCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // 줌/팬 기능이 있으므로 넓은 가상 공간에서 자유롭게 배치 가능
    const newX = (e.clientX - rect.left - dragOffset.x - graphPan.x) / graphZoom;
    const newY = (e.clientY - rect.top - dragOffset.y - graphPan.y) / graphZoom;

    setFormData(prev => ({
      ...prev,
      nodePositions: {
        ...prev.nodePositions,
        [draggingNode]: { x: newX, y: newY }
      }
    }));
  };

  const handleCanvasMouseUp = () => {
    setDraggingNode(null);
  };

  const handleCanvasMouseLeave = () => {
    setDraggingNode(null);
  };

  // 기본 노드 위치 계산 (노드가 중앙 정렬되므로 위치가 곧 중심점)
  const getDefaultNodePosition = (nodeId, nodeIds, containerWidth = 400, containerHeight = 250) => {
    const index = nodeIds.indexOf(nodeId);
    const count = nodeIds.length;

    if (count === 1) {
      return { x: containerWidth / 2, y: containerHeight / 2 };
    } else if (count === 2) {
      return index === 0
        ? { x: containerWidth * 0.3, y: containerHeight / 2 }
        : { x: containerWidth * 0.7, y: containerHeight / 2 };
    } else {
      const centerX = containerWidth / 2;
      const centerY = containerHeight / 2;
      const radius = Math.min(containerWidth, containerHeight) * 0.35;
      const angle = (2 * Math.PI * index) / count - Math.PI / 2;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    }
  };

  // 노드 위치 가져오기 (저장된 위치 또는 기본 위치)
  const getNodePosition = (nodeId, nodePositions, nodeIds) => {
    if (nodePositions && nodePositions[nodeId]) {
      return nodePositions[nodeId];
    }
    return getDefaultNodePosition(nodeId, nodeIds);
  };

  // 노드 크기 상수 (GraphNode는 transform: translate(-50%, -50%)로 중앙 정렬됨)
  // 위치값이 곧 노드의 중심점임. max-width: 220px 기준으로 설정
  const NODE_HALF_WIDTH = 115;  // 노드 최대 너비의 절반 (220/2 + 여유)
  const NODE_HALF_HEIGHT = 55;  // 노드 높이의 절반 (배지 포함, 여러 줄 고려)
  const ARROW_MARGIN = 5;       // 화살표가 노드에서 떨어지는 거리

  // 박스 끝에서 선이 연결되도록 교차점 계산 (노드가 중앙 정렬되어 있으므로 pos가 곧 중심)
  const getEdgePoint = (fromPos, toPos) => {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;

    if (dx === 0 && dy === 0) {
      return { x: fromPos.x, y: fromPos.y };
    }

    // 박스 경계까지의 거리 계산 (마진 포함)
    const halfWidth = NODE_HALF_WIDTH + ARROW_MARGIN;
    const halfHeight = NODE_HALF_HEIGHT + ARROW_MARGIN;

    let t;
    if (Math.abs(dx) * halfHeight > Math.abs(dy) * halfWidth) {
      // 좌우 변과 교차
      t = halfWidth / Math.abs(dx);
    } else {
      // 상하 변과 교차
      t = halfHeight / Math.abs(dy);
    }

    return {
      x: fromPos.x + dx * t,
      y: fromPos.y + dy * t
    };
  };

  // 휠 줌 핸들러 (마우스 위치 중심)
  const handleGraphWheel = (e, isEditModal = false) => {
    const canvas = isEditModal ? editGraphCanvasRef.current : graphCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentZoom = isEditModal ? editGraphZoom : graphZoom;
    const currentPan = isEditModal ? editGraphPan : graphPan;

    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.3, Math.min(3, currentZoom + delta));
    const zoomRatio = newZoom / currentZoom;

    // 마우스 위치를 중심으로 줌
    const newPanX = mouseX - (mouseX - currentPan.x) * zoomRatio;
    const newPanY = mouseY - (mouseY - currentPan.y) * zoomRatio;

    if (isEditModal) {
      setEditGraphZoom(newZoom);
      setEditGraphPan({ x: newPanX, y: newPanY });
    } else {
      setGraphZoom(newZoom);
      setGraphPan({ x: newPanX, y: newPanY });
    }
  };

  // 휠 이벤트를 passive: false로 등록 (데이터 추가 모달)
  React.useEffect(() => {
    const canvas = graphCanvasRef.current;
    if (!canvas) return;

    const wheelHandler = (e) => {
      e.preventDefault();
      handleGraphWheel(e, false);
    };

    canvas.addEventListener('wheel', wheelHandler, { passive: false });
    return () => canvas.removeEventListener('wheel', wheelHandler);
  });

  // 휠 이벤트를 passive: false로 등록 (데이터 수정 모달)
  React.useEffect(() => {
    const canvas = editGraphCanvasRef.current;
    if (!canvas) return;

    const wheelHandler = (e) => {
      e.preventDefault();
      handleGraphWheel(e, true);
    };

    canvas.addEventListener('wheel', wheelHandler, { passive: false });
    return () => canvas.removeEventListener('wheel', wheelHandler);
  });

  // 휠 이벤트를 passive: false로 등록 (레이더 뷰)
  React.useEffect(() => {
    const container = radarContainerRef.current;
    if (!container) return;

    const wheelHandler = (e) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const containerCenterX = rect.width / 2;
      const containerCenterY = rect.height / 2;

      setPanOffset(currentPan => {
        setRadarScale(currentScale => {
          const svgCenterX = containerCenterX + currentPan.x;
          const svgCenterY = containerCenterY + currentPan.y;
          const distX = mouseX - svgCenterX;
          const distY = mouseY - svgCenterY;

          const delta = e.deltaY > 0 ? -0.15 : 0.15;
          const newScale = Math.min(Math.max(currentScale + delta, 0.2), 10);
          const scaleFactor = newScale / currentScale;

          const newPanX = currentPan.x - distX * (scaleFactor - 1);
          const newPanY = currentPan.y - distY * (scaleFactor - 1);

          // panOffset 업데이트는 별도로 처리
          setTimeout(() => setPanOffset({ x: newPanX, y: newPanY }), 0);
          return newScale;
        });
        return currentPan; // 현재 값 유지 (setTimeout에서 업데이트)
      });
    };

    container.addEventListener('wheel', wheelHandler, { passive: false });
    return () => container.removeEventListener('wheel', wheelHandler);
  });

  // PAN 핸들러 (빈 공간 드래그)
  const handleGraphPanStart = (e, isEditModal = false) => {
    // 노드나 다른 요소를 클릭한 경우 무시
    if (e.target !== e.currentTarget && !e.target.closest('svg')) return;
    if (draggingNode) return;

    setIsGraphPanning(true);
    const currentPan = isEditModal ? editGraphPan : graphPan;
    setGraphPanStart({
      x: e.clientX - currentPan.x,
      y: e.clientY - currentPan.y
    });
  };

  const handleGraphPanMove = (e, isEditModal = false) => {
    if (!isGraphPanning) return;
    if (draggingNode) return;

    const newPan = {
      x: e.clientX - graphPanStart.x,
      y: e.clientY - graphPanStart.y
    };

    if (isEditModal) {
      setEditGraphPan(newPan);
    } else {
      setGraphPan(newPan);
    }
  };

  const handleGraphPanEnd = () => {
    setIsGraphPanning(false);
  };

  const handleRemoveRelation = (relationId) => {
    setFormData(prev => ({
      ...prev,
      componentRelations: prev.componentRelations.filter(rel => rel.id !== relationId)
    }));
  };


  // 구성 요소 검색 필터링
  const filteredComponents = components.filter(comp =>
    comp.name.toLowerCase().includes(componentSearchQuery.toLowerCase()) ||
    comp.department.toLowerCase().includes(componentSearchQuery.toLowerCase()) ||
    comp.techType.toLowerCase().includes(componentSearchQuery.toLowerCase())
  );

  // 구성 요소 선택
  const handleSelectComponent = (componentId) => {
    if (!formData.elementTechnologies.includes(componentId)) {
      setFormData(prev => ({
        ...prev,
        elementTechnologies: [...prev.elementTechnologies, componentId]
      }));
    }
    setComponentSearchQuery('');
    setIsComponentSearchOpen(false);
  };

  // 선택된 구성 요소 정보 가져오기
  const getComponentById = (id) => {
    return components.find(c => c.id === id);
  };

  // Helper function to get contrasting text color
  const getContrastColor = (hexColor) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1e293b' : '#ffffff';
  };

  // Helper function to create lighter background color
  const getLighterColor = (hexColor) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const lighterR = Math.round(r + (255 - r) * 0.7);
    const lighterG = Math.round(g + (255 - g) * 0.7);
    const lighterB = Math.round(b + (255 - b) * 0.7);
    return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
  };

  const handleAddLevel = () => {
    if (!newLevelName.trim()) return;

    const bgColor = getLighterColor(newLevelColor);
    const textColor = getContrastColor(bgColor);

    const newLevel = {
      id: Date.now(),
      name: newLevelName.trim(),
      bgColor: bgColor,
      textColor: newLevelColor
    };

    setLevelOptions(prev => [...prev, newLevel]);
    setNewLevelName('');
    setNewLevelColor('#8b5cf6');
  };

  const handleDeleteLevel = (id) => {
    setLevelOptions(prev => prev.filter(level => level.id !== id));
  };

  const handleAddBusinessUnit = () => {
    if (!newBusinessUnitName.trim()) return;

    const newUnit = {
      id: Date.now(),
      name: newBusinessUnitName.trim()
    };

    setBusinessUnitOptions(prev => [...prev, newUnit]);
    setNewBusinessUnitName('');
  };

  const handleDeleteBusinessUnit = (id) => {
    setBusinessUnitOptions(prev => prev.filter(unit => unit.id !== id));
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;

    const newCategory = {
      id: Date.now(),
      name: newCategoryName.trim()
    };

    setCategoryOptions(prev => [...prev, newCategory]);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (id) => {
    setCategoryOptions(prev => prev.filter(cat => cat.id !== id));
  };

  const handleAddTechType = () => {
    if (!newTechTypeName.trim()) return;

    const bgColor = getLighterColor(newTechTypeColor);

    const newTechType = {
      id: Date.now(),
      name: newTechTypeName.trim(),
      bgColor: bgColor,
      textColor: newTechTypeColor
    };

    setTechTypeOptions(prev => [...prev, newTechType]);
    setNewTechTypeName('');
    setNewTechTypeColor('#8b5cf6');
  };

  const handleDeleteTechType = (id) => {
    setTechTypeOptions(prev => prev.filter(type => type.id !== id));
  };

  // 수준 수정 핸들러
  const handleStartEditLevel = (level) => {
    setEditingLevelId(level.id);
    setEditingLevelName(level.name);
    setEditingLevelColor(level.textColor || level.bgColor);
  };

  const handleSaveEditLevel = () => {
    if (!editingLevelName.trim()) return;

    const bgColor = getLighterColor(editingLevelColor);
    setLevelOptions(prev => prev.map(level =>
      level.id === editingLevelId
        ? { ...level, name: editingLevelName.trim(), bgColor: bgColor, textColor: editingLevelColor }
        : level
    ));
    setEditingLevelId(null);
    setEditingLevelName('');
    setEditingLevelColor('');
  };

  const handleCancelEditLevel = () => {
    setEditingLevelId(null);
    setEditingLevelName('');
    setEditingLevelColor('');
  };

  // 카테고리 수정 핸들러
  const handleStartEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const handleSaveEditCategory = () => {
    if (!editingCategoryName.trim()) return;

    setCategoryOptions(prev => prev.map(cat =>
      cat.id === editingCategoryId
        ? { ...cat, name: editingCategoryName.trim() }
        : cat
    ));
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  // 사업부 수정 핸들러
  const handleStartEditBusinessUnit = (unit) => {
    setEditingBusinessUnitId(unit.id);
    setEditingBusinessUnitName(unit.name);
  };

  const handleSaveEditBusinessUnit = () => {
    if (!editingBusinessUnitName.trim()) return;

    setBusinessUnitOptions(prev => prev.map(unit =>
      unit.id === editingBusinessUnitId
        ? { ...unit, name: editingBusinessUnitName.trim() }
        : unit
    ));
    setEditingBusinessUnitId(null);
    setEditingBusinessUnitName('');
  };

  const handleCancelEditBusinessUnit = () => {
    setEditingBusinessUnitId(null);
    setEditingBusinessUnitName('');
  };

  // 기술 구분 수정 핸들러
  const handleStartEditTechType = (techType) => {
    setEditingTechTypeId(techType.id);
    setEditingTechTypeName(techType.name);
    setEditingTechTypeColor(techType.textColor || techType.bgColor);
  };

  const handleSaveEditTechType = () => {
    if (!editingTechTypeName.trim()) return;

    const bgColor = getLighterColor(editingTechTypeColor);
    setTechTypeOptions(prev => prev.map(type =>
      type.id === editingTechTypeId
        ? { ...type, name: editingTechTypeName.trim(), bgColor: bgColor, textColor: editingTechTypeColor }
        : type
    ));
    setEditingTechTypeId(null);
    setEditingTechTypeName('');
    setEditingTechTypeColor('');
  };

  const handleCancelEditTechType = () => {
    setEditingTechTypeId(null);
    setEditingTechTypeName('');
    setEditingTechTypeColor('');
  };

  const handleOpenBulkAdd = () => {
    setIsBulkAddOpen(true);
    setBulkTableData([{ goal: '', abbreviation: '', category: '', level: '', businessUnit: '', elementTechnologies: [], registrationDate: '' }]);
  };

  const handleCloseBulkAdd = () => {
    setIsBulkAddOpen(false);
    setBulkTableData([{ goal: '', abbreviation: '', category: '', level: '', businessUnit: '', elementTechnologies: [], registrationDate: '' }]);
  };

  // 기존 데이터 불러오기 함수
  const handleLoadExistingData = () => {
    if (data.length === 0) {
      alert('불러올 데이터가 없습니다.');
      return;
    }

    const loadedData = data.map(item => ({
      goal: item.goal || '',
      abbreviation: item.abbreviation || '',
      category: item.category || '',
      level: item.level || '',
      businessUnit: item.businessUnit || '',
      registrationDate: item.registrationDate || ''
    }));

    setBulkTableData(loadedData);
    alert(`${loadedData.length}개의 데이터를 불러왔습니다.`);
  };

  // CSV Export 함수
  const handleExportCSV = () => {
    const headers = ['메가 과제', '라벨명', '카테고리', '수준', '사업부', '등록 날짜'];

    const rows = bulkTableData.map(row => [
      row.goal || '',
      row.abbreviation || '',
      row.category || '',
      row.level || '',
      row.businessUnit || '',
      row.registrationDate || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tech_level_data_${todayLocalYmd()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenPasteModal = () => {
    setIsPasteModalOpen(true);
    setBulkAddText('');
    setTimeout(() => {
      if (bulkAddTextAreaRef.current) {
        bulkAddTextAreaRef.current.focus();
      }
    }, 100);
  };

  const handleClosePasteModal = () => {
    setIsPasteModalOpen(false);
    setBulkAddText('');
  };

  const handlePasteSubmit = () => {
    if (!bulkAddText.trim()) {
      alert('데이터를 입력해주세요.');
      return;
    }

    try {
      const rows = bulkAddText.trim().split('\n');
      const newRows = [];

      rows.forEach((row) => {
        const cells = row.split('\t');
        if (cells.length === 0 || cells.every(cell => !cell.trim())) {
          return;
        }

        // 컬럼 순서: 메가 과제, 라벨명, 카테고리, 수준, 사업부, 등록 날짜
        newRows.push({
          goal: cells[0]?.trim() || '',
          abbreviation: cells[1]?.trim() || '',
          category: cells[2]?.trim() || '',
          level: cells[3]?.trim() || '',
          businessUnit: cells[4]?.trim() || '',
          registrationDate: cells[5]?.trim() || ''
        });
      });

      if (newRows.length > 0) {
        setBulkTableData(prev => {
          const hasEmptyFirst = prev.length === 1 && !prev[0].goal;
          return hasEmptyFirst ? newRows : [...prev, ...newRows];
        });
        alert(`${newRows.length}개의 행이 테이블에 추가되었습니다.`);
        handleClosePasteModal();
      } else {
        alert('유효한 데이터가 없습니다.');
      }
    } catch (error) {
      console.error('붙여넣기 실패:', error);
      alert('데이터 처리 중 오류가 발생했습니다.');
    }
  };

  const handleBulkTableChange = (index, field, value) => {
    setBulkTableData(prev => {
      const newData = [...prev];
      newData[index] = { ...newData[index], [field]: value };
      return newData;
    });
  };

  const handleAddBulkRow = () => {
    setBulkTableData(prev => [...prev, { goal: '', abbreviation: '', category: '', level: '', businessUnit: '', registrationDate: '' }]);
  };

  const handleDeleteBulkRow = (index) => {
    if (bulkTableData.length <= 1) return;
    setBulkTableData(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearBulkTable = () => {
    if (window.confirm('모든 데이터를 삭제하시겠습니까?')) {
      setBulkTableData([{ goal: '', abbreviation: '', category: '', level: '', businessUnit: '', registrationDate: '' }]);
    }
  };

  const handleBulkAddSubmit = () => {
    const validRows = bulkTableData.filter(row => row.goal.trim());

    if (validRows.length === 0) {
      alert('유효한 데이터가 없습니다. 메가 과제는 필수입니다.');
      return;
    }

    const newEntries = validRows.map((row, index) => ({
      id: Date.now() + index,
      goal: row.goal.trim(),
      abbreviation: (row.abbreviation || '').trim(),
      category: row.category.trim(),
      level: row.level.trim(),
      businessUnit: row.businessUnit.trim(),
      elementTechnologies: [],  // 구성 요소는 데이터 수정에서 추가
      registrationDate: row.registrationDate.trim() || todayLocalYmd()
    }));

    setData(prev => [...prev, ...newEntries]);
    alert(`${newEntries.length}개의 데이터가 추가되었습니다.`);
    handleCloseBulkAdd();
  };

  const countValidBulkRows = () => {
    return bulkTableData.filter(row => row.goal.trim()).length;
  };

  const getLevelColors = (levelName) => {
    const level = levelOptions.find(l => l.name === levelName);
    return level ? { bgColor: level.bgColor, textColor: level.textColor } : { bgColor: '#f1f5f9', textColor: '#475569' };
  };

  const handleSubmit = () => {
    if (!formData.goal || !formData.category || !formData.level || !formData.businessUnit) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    const newEntry = {
      id: Date.now(),
      ...formData
    };

    setData(prev => [...prev, newEntry]);
    setIsModalOpen(false);
    setFormData({
      goal: '',
      abbreviation: '',
      category: '',
      level: '',
      businessUnit: '',
      elementTechnologies: [],
      componentRelations: [],
      nodePositions: {},
      registrationDate: todayLocalYmd()
    });
    setElementTechInput('');
    setComponentSearchQuery('');
    setIsComponentSearchOpen(false);
    setSelectedSourceNode(null);
    setDraggingNode(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 카테고리별 색상
  const categoryColors = [
    '#8b5cf6', // purple
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ];

  const getCategoryColor = (categoryName) => {
    const index = categoryOptions.findIndex(c => c.name === categoryName);
    return categoryColors[index % categoryColors.length] || '#8b5cf6';
  };

  // 사업부별 색상
  const businessUnitColors = [
    '#ef4444', // red - MX
    '#3b82f6', // blue - VD
    '#10b981', // green - DA
    '#f59e0b', // amber - NW
    '#ec4899', // pink - 의료기기
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#84cc16', // lime
  ];

  const getBusinessUnitColor = (businessUnitName) => {
    const index = businessUnitOptions.findIndex(b => b.name === businessUnitName);
    return businessUnitColors[index % businessUnitColors.length] || '#8b5cf6';
  };

  // 구성 요소 관련 함수
  const handleComponentInputChange = (e) => {
    const { name, value } = e.target;
    setComponentFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddComponent = () => {
    if (!componentFormData.name || !componentFormData.department || !componentFormData.techType) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    const newComponent = {
      id: Date.now(),
      ...componentFormData
    };

    setComponents(prev => [...prev, newComponent]);
    setIsComponentModalOpen(false);
    setComponentFormData({
      name: '',
      department: '',
      techType: '',
      maturityLevel: '',
      description: ''
    });
  };

  const handleDeleteComponent = (id) => {
    if (window.confirm('이 구성 요소를 삭제하시겠습니까?')) {
      setComponents(prev => prev.filter(c => c.id !== id));
    }
  };

  // 데이터 수정 관련 함수
  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditFormData({
      ...item,
      componentRelations: item.componentRelations || [],
      nodePositions: item.nodePositions || {}
    });
    setIsEditModalOpen(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRemoveEditElementTech = (techIdToRemove) => {
    setEditFormData(prev => ({
      ...prev,
      elementTechnologies: prev.elementTechnologies.filter(id => id !== techIdToRemove),
      componentRelations: (prev.componentRelations || []).filter(
        rel => rel.source !== techIdToRemove && rel.target !== techIdToRemove
      )
    }));
    if (selectedSourceNode === techIdToRemove) {
      setSelectedSourceNode(null);
    }
  };

  const handleSelectEditComponent = (componentId) => {
    if (!editFormData.elementTechnologies.includes(componentId)) {
      setEditFormData(prev => ({
        ...prev,
        elementTechnologies: [...prev.elementTechnologies, componentId]
      }));
    }
    setComponentSearchQuery('');
    setIsComponentSearchOpen(false);
  };

  // 수정 모달용 관계 핸들러
  const handleEditNodeClick = (compId, e) => {
    if (draggingNode) return;

    if (!selectedSourceNode) {
      setSelectedSourceNode(compId);
    } else if (selectedSourceNode === compId) {
      setSelectedSourceNode(null);
    } else {
      const newRelation = {
        id: Date.now(),
        source: selectedSourceNode,
        target: compId
      };

      const isDuplicate = (editFormData.componentRelations || []).some(
        rel => rel.source === newRelation.source && rel.target === newRelation.target
      );

      if (!isDuplicate) {
        setEditFormData(prev => ({
          ...prev,
          componentRelations: [...(prev.componentRelations || []), newRelation]
        }));
      }
      setSelectedSourceNode(null);
    }
  };

  const handleRemoveEditRelation = (relationId) => {
    setEditFormData(prev => ({
      ...prev,
      componentRelations: (prev.componentRelations || []).filter(rel => rel.id !== relationId)
    }));
  };

  // 수정 모달용 드래그 핸들러
  const editGraphCanvasRef = useRef(null);

  const handleEditNodeMouseDown = (compId, e) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = editGraphCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const nodePos = editFormData.nodePositions?.[compId] || getDefaultNodePosition(compId, editFormData.elementTechnologies);

    setDraggingNode(compId);
    // 줌/팬을 고려한 offset 계산
    setDragOffset({
      x: e.clientX - rect.left - editGraphPan.x - nodePos.x * editGraphZoom,
      y: e.clientY - rect.top - editGraphPan.y - nodePos.y * editGraphZoom
    });
  };

  const handleEditCanvasMouseMove = (e) => {
    if (!draggingNode) return;
    const canvas = editGraphCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // 줌/팬 기능이 있으므로 넓은 가상 공간에서 자유롭게 배치 가능
    const newX = (e.clientX - rect.left - dragOffset.x - editGraphPan.x) / editGraphZoom;
    const newY = (e.clientY - rect.top - dragOffset.y - editGraphPan.y) / editGraphZoom;

    setEditFormData(prev => ({
      ...prev,
      nodePositions: {
        ...(prev.nodePositions || {}),
        [draggingNode]: { x: newX, y: newY }
      }
    }));
  };

  const handleEditCanvasMouseUp = () => {
    setDraggingNode(null);
  };

  const handleEditCanvasMouseLeave = () => {
    setDraggingNode(null);
  };

  const handleUpdateItem = () => {
    if (!editFormData.goal || !editFormData.category || !editFormData.level || !editFormData.businessUnit) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    setData(prev => prev.map(item =>
      item.id === editingItem.id ? { ...editFormData } : item
    ));
    setIsEditModalOpen(false);
    setEditingItem(null);
    setEditFormData(null);
    setComponentSearchQuery('');
    setIsComponentSearchOpen(false);
    setSelectedSourceNode(null);
    setDraggingNode(null);
  };

  const handleDeleteItem = (id) => {
    if (window.confirm('이 데이터를 삭제하시겠습니까?')) {
      setData(prev => prev.filter(item => item.id !== id));
    }
  };

  // 구성 요소 수정 관련 함수
  const handleEditComponent = (component) => {
    setEditingComponent(component);
    setEditComponentFormData({ ...component });
    setIsEditComponentModalOpen(true);
  };

  const handleEditComponentFormChange = (e) => {
    const { name, value } = e.target;
    setEditComponentFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateComponent = () => {
    if (!editComponentFormData.name || !editComponentFormData.department || !editComponentFormData.techType) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    setComponents(prev => prev.map(comp =>
      comp.id === editingComponent.id ? { ...editComponentFormData } : comp
    ));
    setIsEditComponentModalOpen(false);
    setEditingComponent(null);
    setEditComponentFormData(null);
  };

  const getTechTypeColors = (techTypeName) => {
    const techType = techTypeOptions.find(t => t.name === techTypeName);
    return techType ? { bgColor: techType.bgColor, textColor: techType.textColor } : { bgColor: '#f1f5f9', textColor: '#475569' };
  };

  // 구성 요소 뷰 렌더링
  const renderComponentView = () => {
    return (
      <ComponentViewContainer>
        <ComponentViewHeader>
          <ComponentViewTitle>
            <Box size={20} />
            구성 요소 목록
          </ComponentViewTitle>
          <AddComponentButton onClick={() => setIsComponentModalOpen(true)}>
            <Plus size={16} />
            구성 요소 추가
          </AddComponentButton>
        </ComponentViewHeader>

        {components.length === 0 ? (
          <ComponentEmptyState>
            <Box size={48} />
            <span>등록된 구성 요소가 없습니다.<br/>"구성 요소 추가" 버튼을 클릭하여 새 구성 요소를 추가하세요.</span>
          </ComponentEmptyState>
        ) : (
          <ComponentGrid>
            {components.map((component) => (
              <ComponentCard key={component.id}>
                <ComponentCardHeader>
                  <ComponentName>
                    <Box size={18} color="#8b5cf6" />
                    {component.name}
                  </ComponentName>
                  <ComponentCardActions>
                    <ComponentCardActionBtn
                      onClick={() => handleEditComponent(component)}
                      title="수정"
                      style={{ background: '#eff6ff', color: '#3b82f6' }}
                    >
                      <Edit2 size={16} />
                    </ComponentCardActionBtn>
                    <ComponentCardActionBtn
                      onClick={() => handleDeleteComponent(component.id)}
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </ComponentCardActionBtn>
                  </ComponentCardActions>
                </ComponentCardHeader>
                <ComponentCardBody>
                  <ComponentField>
                    <ComponentFieldLabel>담당 부서</ComponentFieldLabel>
                    <ComponentFieldValue>{component.department}</ComponentFieldValue>
                  </ComponentField>
                  <ComponentField>
                    <ComponentFieldLabel>기술 구분</ComponentFieldLabel>
                    <ComponentBadge
                      $bgColor={getTechTypeColors(component.techType).bgColor}
                      $textColor={getTechTypeColors(component.techType).textColor}
                    >
                      {component.techType}
                    </ComponentBadge>
                  </ComponentField>
                  {component.maturityLevel && (
                    <ComponentField>
                      <ComponentFieldLabel>역량 성숙도</ComponentFieldLabel>
                      <ComponentBadge
                        $bgColor={maturityLevelOptions.find(m => m.value === component.maturityLevel)?.bgColor || '#f1f5f9'}
                        $textColor={maturityLevelOptions.find(m => m.value === component.maturityLevel)?.textColor || '#475569'}
                      >
                        {component.maturityLevel}
                      </ComponentBadge>
                    </ComponentField>
                  )}
                  {component.description && (
                    <ComponentField>
                      <ComponentFieldLabel>상세 사항</ComponentFieldLabel>
                      <ComponentFieldValue style={{ whiteSpace: 'pre-wrap' }}>{component.description}</ComponentFieldValue>
                    </ComponentField>
                  )}
                </ComponentCardBody>
              </ComponentCard>
            ))}
          </ComponentGrid>
        )}
      </ComponentViewContainer>
    );
  };

  // 수준별 링 반경 계산
  const getLevelRingRadius = (levelName, maxRadius) => {
    const index = levelOptions.findIndex(l => l.name === levelName);
    const totalLevels = levelOptions.length;
    if (index === -1) return maxRadius * 0.5;
    // 첫 번째 수준(도입)이 가장 안쪽, 마지막 수준(보류)이 가장 바깥쪽
    return maxRadius * ((index + 1) / totalLevels);
  };

  // 레이더 차트에서 목표의 위치 계산
  const getGoalPosition = (goal, index, goalsInSameSectorAndLevel, center, maxRadius) => {
    const categoryIndex = categoryOptions.findIndex(c => c.name === goal.category);
    const totalCategories = categoryOptions.length || 1;

    // 섹터 각도 계산
    const sectorAngle = (2 * Math.PI) / totalCategories;
    const startAngle = categoryIndex * sectorAngle - Math.PI / 2;

    // 같은 섹터 & 링에 있는 목표들을 분산 배치
    const totalInRing = goalsInSameSectorAndLevel.length;
    const spreadAngle = sectorAngle * 0.7; // 섹터 내 70% 사용
    const angleOffset = totalInRing > 1
      ? (spreadAngle / (totalInRing - 1)) * index - spreadAngle / 2
      : 0;

    let finalAngle = startAngle + sectorAngle / 2 + angleOffset;
    const radius = getLevelRingRadius(goal.level, maxRadius);

    // 링 라벨 영역 피하기 (오른쪽 방향, -20도 ~ 20도 범위)
    // 각도를 0 ~ 2PI 범위로 정규화
    const normalizedAngle = ((finalAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const labelAvoidanceZone = Math.PI / 9; // 약 20도

    // 오른쪽 방향 (0도 근처)을 피함
    const isInLabelZone = normalizedAngle < labelAvoidanceZone || normalizedAngle > (2 * Math.PI - labelAvoidanceZone);

    // 링 내에서 약간의 반경 변화
    const radiusVariation = totalInRing > 1 ? (maxRadius * 0.05) * ((index % 3) - 1) : 0;
    let finalRadius = radius * 0.85 + radiusVariation;

    // 라벨 영역에 있으면 반경을 줄여서 라벨 안쪽에 배치
    if (isInLabelZone) {
      finalRadius = radius * 0.65 + radiusVariation;
    }

    return {
      x: center.x + finalRadius * Math.cos(finalAngle),
      y: center.y + finalRadius * Math.sin(finalAngle)
    };
  };

  // 레이더 차트 렌더링
  const renderTechRadarView = () => {
    const size = 1000;
    const center = { x: size / 2, y: size / 2 };
    const maxRadius = size * 0.42;
    const totalCategories = categoryOptions.length || 1;
    const sectorAngle = (2 * Math.PI) / totalCategories;

    // 데이터를 섹터와 링 별로 그룹화
    const groupedData = {};
    data.forEach(goal => {
      const key = `${goal.category}-${goal.level}`;
      if (!groupedData[key]) groupedData[key] = [];
      groupedData[key].push(goal);
    });

    // 휠 이벤트 핸들러 (마우스 위치 기준 줌) - useEffect에서 처리됨
    const handleWheel = (e) => {
      const container = radarContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      // 컨테이너 내 마우스 위치
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // 컨테이너 중앙 좌표
      const containerCenterX = rect.width / 2;
      const containerCenterY = rect.height / 2;

      // 현재 SVG 중앙 위치 (panOffset 적용 전 기준점은 컨테이너 중앙)
      const svgCenterX = containerCenterX + panOffset.x;
      const svgCenterY = containerCenterY + panOffset.y;

      // 마우스 위치에서 SVG 중앙까지의 거리
      const distX = mouseX - svgCenterX;
      const distY = mouseY - svgCenterY;

      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      const newScale = Math.min(Math.max(radarScale + delta, 0.2), 10);
      const scaleFactor = newScale / radarScale;

      // 마우스 위치를 기준으로 pan offset 조정
      // 스케일 변경 후에도 마우스 아래 같은 지점이 유지되도록
      const newPanX = panOffset.x - distX * (scaleFactor - 1);
      const newPanY = panOffset.y - distY * (scaleFactor - 1);

      setRadarScale(newScale);
      setPanOffset({ x: newPanX, y: newPanY });
    };

    // Pan 시작
    const handleMouseDown = (e) => {
      if (e.button !== 0) return; // 좌클릭만
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    };

    // Pan 중
    const handleMouseMove = (e) => {
      if (!isPanning) return;
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    };

    // Pan 종료
    const handleMouseUp = () => {
      setIsPanning(false);
    };

    // 줌 리셋
    const handleResetZoom = () => {
      setRadarScale(1);
      setPanOffset({ x: 0, y: 0 });
    };

    return (
      <RadarContainer>
        <RadarChartWrapper
          ref={radarContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isPanning ? 'grabbing' : 'grab', overflow: 'hidden' }}
        >
          {data.length === 0 ? (
            <RadarEmptyMessage>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>데이터가 없습니다.<br/>테이블 뷰에서 데이터를 추가해주세요.</span>
            </RadarEmptyMessage>
          ) : (
            <div
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${radarScale})`,
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              <svg
                ref={radarSvgRef}
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                style={{ overflow: 'visible' }}
              >
              <defs>
                <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" style={{ stopColor: '#f8fafc', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#e2e8f0', stopOpacity: 1 }} />
                </radialGradient>
                {categoryOptions.map((cat, idx) => (
                  <radialGradient key={`grad-${idx}`} id={`sector-grad-${idx}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style={{ stopColor: categoryColors[idx % categoryColors.length], stopOpacity: 0.1 }} />
                    <stop offset="100%" style={{ stopColor: categoryColors[idx % categoryColors.length], stopOpacity: 0.05 }} />
                  </radialGradient>
                ))}
              </defs>

              {/* 배경 원 */}
              <circle
                cx={center.x}
                cy={center.y}
                r={maxRadius}
                fill="url(#radarBg)"
                stroke="#cbd5e1"
                strokeWidth="1"
              />

              {/* 섹터 영역 */}
              {categoryOptions.map((cat, idx) => {
                const startAngle = idx * sectorAngle - Math.PI / 2;
                const endAngle = (idx + 1) * sectorAngle - Math.PI / 2;

                const x1 = center.x + maxRadius * Math.cos(startAngle);
                const y1 = center.y + maxRadius * Math.sin(startAngle);
                const x2 = center.x + maxRadius * Math.cos(endAngle);
                const y2 = center.y + maxRadius * Math.sin(endAngle);

                const largeArcFlag = sectorAngle > Math.PI ? 1 : 0;
                const pathData = `M ${center.x} ${center.y} L ${x1} ${y1} A ${maxRadius} ${maxRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

                return (
                  <path
                    key={cat.id}
                    d={pathData}
                    fill={`url(#sector-grad-${idx})`}
                    stroke={categoryColors[idx % categoryColors.length]}
                    strokeWidth="1"
                    strokeOpacity="0.3"
                  />
                );
              })}

              {/* 링 (수준별) */}
              {levelOptions.map((level, idx) => {
                const radius = getLevelRingRadius(level.name, maxRadius);
                return (
                  <circle
                    key={level.id}
                    cx={center.x}
                    cy={center.y}
                    r={radius}
                    fill="none"
                    stroke={level.textColor}
                    strokeWidth="2"
                    strokeOpacity="0.5"
                    strokeDasharray={idx === levelOptions.length - 1 ? '5,5' : 'none'}
                  />
                );
              })}

              {/* 섹터 구분선 */}
              {categoryOptions.map((_, idx) => {
                const angle = idx * sectorAngle - Math.PI / 2;
                const x = center.x + maxRadius * Math.cos(angle);
                const y = center.y + maxRadius * Math.sin(angle);

                return (
                  <line
                    key={idx}
                    x1={center.x}
                    y1={center.y}
                    x2={x}
                    y2={y}
                    stroke="#64748b"
                    strokeWidth="1"
                    strokeOpacity="0.5"
                  />
                );
              })}

              {/* 목표 점들 */}
              {data.map((goal) => {
                const key = `${goal.category}-${goal.level}`;
                const goalsInSameSectorAndLevel = groupedData[key] || [];
                const indexInGroup = goalsInSameSectorAndLevel.findIndex(g => g.id === goal.id);
                const position = getGoalPosition(goal, indexInGroup, goalsInSameSectorAndLevel, center, maxRadius);
                const color = getBusinessUnitColor(goal.businessUnit);
                const isHovered = hoveredGoal?.id === goal.id;
                const inverseScale = 1 / radarScale;

                return (
                  <g
                    key={goal.id}
                    transform={`translate(${position.x}, ${position.y}) scale(${inverseScale})`}
                  >
                    {isHovered && (
                      <>
                        <circle
                          cx={0}
                          cy={0}
                          r="18"
                          fill="none"
                          stroke={color}
                          strokeWidth="2"
                          strokeOpacity="0.8"
                        />
                        <circle
                          cx={0}
                          cy={0}
                          r="14"
                          fill={color}
                          fillOpacity="0.15"
                        />
                      </>
                    )}
                    <circle
                      cx={0}
                      cy={0}
                      r="8"
                      fill={color}
                      stroke="white"
                      strokeWidth="2"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => {
                        setHoveredGoal(goal);
                        setTooltipPosition({ x: e.pageX, y: e.pageY });
                      }}
                      onMouseMove={(e) => {
                        setTooltipPosition({ x: e.pageX, y: e.pageY });
                      }}
                      onMouseLeave={() => setHoveredGoal(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHoveredGoal(null);
                        handleEditItem(goal);
                      }}
                    />
                    {goal.abbreviation && (
                      <text
                        x={0}
                        y={-14}
                        textAnchor="middle"
                        fill="#1e293b"
                        fontSize="12"
                        fontWeight="600"
                        style={{ pointerEvents: 'none' }}
                      >
                        {goal.abbreviation}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* 링 라벨 */}
              {levelOptions.map((level, idx) => {
                const radius = getLevelRingRadius(level.name, maxRadius);
                const labelX = center.x + radius - 10;
                const labelY = center.y - 5;
                const inverseScale = 1 / radarScale;
                return (
                  <g
                    key={`label-${level.id}`}
                    transform={`translate(${labelX}, ${labelY}) scale(${inverseScale})`}
                  >
                    <text
                      x={0}
                      y={0}
                      textAnchor="end"
                      fill={level.textColor}
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {level.name.split('(')[0]}
                    </text>
                  </g>
                );
              })}

              {/* 섹터 라벨 */}
              {categoryOptions.map((cat, idx) => {
                const midAngle = idx * sectorAngle + sectorAngle / 2 - Math.PI / 2;
                const labelRadius = maxRadius + 40;
                const x = center.x + labelRadius * Math.cos(midAngle);
                const y = center.y + labelRadius * Math.sin(midAngle);
                const inverseScale = 1 / radarScale;

                // 텍스트 앵커 결정 (위치에 따라)
                let textAnchor = 'middle';
                const angleDeg = ((midAngle * 180 / Math.PI) + 360) % 360;
                if (angleDeg > 45 && angleDeg < 135) textAnchor = 'middle';
                else if (angleDeg >= 135 && angleDeg <= 225) textAnchor = 'end';
                else if (angleDeg > 225 && angleDeg < 315) textAnchor = 'middle';
                else textAnchor = 'start';

                return (
                  <g
                    key={`sector-label-${cat.id}`}
                    transform={`translate(${x}, ${y}) scale(${inverseScale})`}
                  >
                    <text
                      x={0}
                      y={0}
                      textAnchor={textAnchor}
                      dominantBaseline="middle"
                      fill={categoryColors[idx % categoryColors.length]}
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {cat.name}
                    </text>
                  </g>
                );
              })}
            </svg>
            </div>
          )}

          {/* 줌 컨트롤 버튼 */}
          {data.length > 0 && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              zIndex: 10
            }}>
              <button
                onClick={() => {
                  const newScale = Math.min(radarScale + 0.5, 10);
                  setRadarScale(newScale);
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: '#64748b',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                title="확대"
              >
                +
              </button>
              <button
                onClick={() => {
                  const newScale = Math.max(radarScale - 0.5, 0.2);
                  setRadarScale(newScale);
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: '#64748b',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                title="축소"
              >
                −
              </button>
              <button
                onClick={handleResetZoom}
                style={{
                  width: '32px',
                  height: '32px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#64748b',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                title="초기화"
              >
                1:1
              </button>
            </div>
          )}
        </RadarChartWrapper>

        <RadarLegend>
          <LegendTitle>범례</LegendTitle>

          <LegendSection>
            <LegendSectionTitle>사업부 (포인트 색상)</LegendSectionTitle>
            {businessUnitOptions.map((unit, idx) => (
              <LegendItem key={unit.id}>
                <LegendColor $color={businessUnitColors[idx % businessUnitColors.length]} />
                <LegendLabel>{unit.name}</LegendLabel>
              </LegendItem>
            ))}
          </LegendSection>

          <LegendSection>
            <LegendSectionTitle>카테고리 (섹터)</LegendSectionTitle>
            {categoryOptions.map((cat, idx) => (
              <LegendItem key={cat.id}>
                <LegendColor $color={categoryColors[idx % categoryColors.length]} />
                <LegendLabel>{cat.name}</LegendLabel>
              </LegendItem>
            ))}
          </LegendSection>

          <LegendSection>
            <LegendSectionTitle>수준 (링)</LegendSectionTitle>
            {levelOptions.map((level) => (
              <LegendItem key={level.id}>
                <LegendRing $color={level.textColor} />
                <LegendLabel>{level.name}</LegendLabel>
              </LegendItem>
            ))}
          </LegendSection>

          <LegendSection>
            <LegendSectionTitle>통계</LegendSectionTitle>
            <LegendItem>
              <LegendLabel>총 목표 수: <strong>{data.length}</strong>개</LegendLabel>
            </LegendItem>
            {businessUnitOptions.map((unit, idx) => {
              const count = data.filter(d => d.businessUnit === unit.name).length;
              if (count === 0) return null;
              return (
                <LegendItem key={`stat-${unit.id}`}>
                  <LegendColor $color={businessUnitColors[idx % businessUnitColors.length]} />
                  <LegendLabel>{unit.name}: {count}개</LegendLabel>
                </LegendItem>
              );
            })}
          </LegendSection>
        </RadarLegend>

        {/* 툴팁 */}
        {hoveredGoal && (
          <GoalTooltip
            style={{
              left: tooltipPosition.x + 15,
              top: tooltipPosition.y - 10
            }}
          >
            <div className="tooltip-header">
              <span className="tooltip-title">{hoveredGoal.goal}</span>
            </div>
            <div className="tooltip-category">{hoveredGoal.category}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: getBusinessUnitColor(hoveredGoal.businessUnit)
                }}
              />
              <span style={{ fontSize: '12px', color: '#64748b' }}>{hoveredGoal.businessUnit}</span>
            </div>
            <span
              className="tooltip-level"
              style={{
                backgroundColor: getLevelColors(hoveredGoal.level).bgColor,
                color: getLevelColors(hoveredGoal.level).textColor
              }}
            >
              {hoveredGoal.level}
            </span>
            {hoveredGoal.elementTechnologies && hoveredGoal.elementTechnologies.length > 0 && (
              <div className="tooltip-techs">
                {hoveredGoal.elementTechnologies.map((compId, idx) => {
                  const comp = getComponentById(compId);
                  return comp ? <span key={idx} className="tooltip-tech">{comp.name}</span> : null;
                })}
              </div>
            )}
          </GoalTooltip>
        )}
      </RadarContainer>
    );
  };

  return (
    <Container>
      <Header onGoHome={onGoHome} onAddData={() => setIsModalOpen(true)} onBulkAdd={handleOpenBulkAdd} onOpenSettings={() => setIsSettingsOpen(true)} onServerSync={() => setIsServerSyncModalOpen(true)} viewMode={viewMode} onViewModeChange={setViewMode} />
      <Content>
        {viewMode === 'table' ? (
          <>
            <SubViewToggle>
              <SubViewButton
                $active={tableSubView === 'card'}
                onClick={() => setTableSubView('card')}
              >
                <LayoutGrid size={14} />
                카드 뷰
              </SubViewButton>
              <SubViewButton
                $active={tableSubView === 'table'}
                onClick={() => setTableSubView('table')}
              >
                <Table2 size={14} />
                테이블 뷰
              </SubViewButton>
            </SubViewToggle>

            {tableSubView === 'card' ? (
              <>
                {/* 필터 UI */}
                <FilterContainer>
                  <FilterHeader
                    $expanded={isFilterExpanded}
                    onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  >
                    <FilterHeaderLeft>
                      <Filter size={16} />
                      필터
                      {(() => {
                        const activeCount = Object.values(cardFilters).filter(v => v !== '').length;
                        return activeCount > 0 ? (
                          <ActiveFilterCount>{activeCount}</ActiveFilterCount>
                        ) : null;
                      })()}
                    </FilterHeaderLeft>
                    <FilterHeaderRight>
                      {Object.values(cardFilters).some(v => v !== '') && (
                        <FilterClearButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardFilters({
                              searchText: '',
                              category: '',
                              level: '',
                              businessUnit: '',
                              component: ''
                            });
                          }}
                        >
                          <X size={12} />
                          초기화
                        </FilterClearButton>
                      )}
                      {isFilterExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </FilterHeaderRight>
                  </FilterHeader>
                  <FilterBody $expanded={isFilterExpanded}>
                    <FilterGrid>
                      <FilterGroup>
                        <FilterLabel>검색어 (메가과제/라벨명)</FilterLabel>
                        <FilterInput
                          type="text"
                          placeholder="검색어를 입력하세요..."
                          value={cardFilters.searchText}
                          onChange={(e) => setCardFilters(prev => ({ ...prev, searchText: e.target.value }))}
                        />
                      </FilterGroup>
                      <FilterGroup>
                        <FilterLabel>카테고리</FilterLabel>
                        <FilterSelect
                          value={cardFilters.category}
                          onChange={(e) => setCardFilters(prev => ({ ...prev, category: e.target.value }))}
                        >
                          <option value="">전체</option>
                          {categoryOptions.map((cat) => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </FilterSelect>
                      </FilterGroup>
                      <FilterGroup>
                        <FilterLabel>수준</FilterLabel>
                        <FilterSelect
                          value={cardFilters.level}
                          onChange={(e) => setCardFilters(prev => ({ ...prev, level: e.target.value }))}
                        >
                          <option value="">전체</option>
                          {levelOptions.map((level) => (
                            <option key={level.id} value={level.name}>{level.name}</option>
                          ))}
                        </FilterSelect>
                      </FilterGroup>
                      <FilterGroup>
                        <FilterLabel>사업부</FilterLabel>
                        <FilterSelect
                          value={cardFilters.businessUnit}
                          onChange={(e) => setCardFilters(prev => ({ ...prev, businessUnit: e.target.value }))}
                        >
                          <option value="">전체</option>
                          {businessUnitOptions.map((unit) => (
                            <option key={unit.id} value={unit.name}>{unit.name}</option>
                          ))}
                        </FilterSelect>
                      </FilterGroup>
                      <FilterGroup>
                        <FilterLabel>구성 요소</FilterLabel>
                        <FilterSelect
                          value={cardFilters.component}
                          onChange={(e) => setCardFilters(prev => ({ ...prev, component: e.target.value }))}
                        >
                          <option value="">전체</option>
                          {components.map((comp) => (
                            <option key={comp.id} value={comp.id}>{comp.name}</option>
                          ))}
                        </FilterSelect>
                      </FilterGroup>
                    </FilterGrid>
                  </FilterBody>
                  {Object.values(cardFilters).some(v => v !== '') && (
                    <FilterResultInfo>
                      <Search size={14} />
                      총 {data.length}개 중
                      <FilterResultCount>
                        {data.filter(item => {
                          const searchLower = cardFilters.searchText.toLowerCase();
                          const matchesSearch = !cardFilters.searchText ||
                            item.goal.toLowerCase().includes(searchLower) ||
                            (item.abbreviation && item.abbreviation.toLowerCase().includes(searchLower));
                          const matchesCategory = !cardFilters.category || item.category === cardFilters.category;
                          const matchesLevel = !cardFilters.level || item.level === cardFilters.level;
                          const matchesBusinessUnit = !cardFilters.businessUnit || item.businessUnit === cardFilters.businessUnit;
                          const matchesComponent = !cardFilters.component ||
                            (item.elementTechnologies && item.elementTechnologies.includes(cardFilters.component));
                          return matchesSearch && matchesCategory && matchesLevel && matchesBusinessUnit && matchesComponent;
                        }).length}개
                      </FilterResultCount>
                      결과
                    </FilterResultInfo>
                  )}
                </FilterContainer>

                <CardViewContainer>
                  {(() => {
                    // 필터 적용
                    const filteredData = data.filter(item => {
                      const searchLower = cardFilters.searchText.toLowerCase();
                      const matchesSearch = !cardFilters.searchText ||
                        item.goal.toLowerCase().includes(searchLower) ||
                        (item.abbreviation && item.abbreviation.toLowerCase().includes(searchLower));
                      const matchesCategory = !cardFilters.category || item.category === cardFilters.category;
                      const matchesLevel = !cardFilters.level || item.level === cardFilters.level;
                      const matchesBusinessUnit = !cardFilters.businessUnit || item.businessUnit === cardFilters.businessUnit;
                      const matchesComponent = !cardFilters.component ||
                        (item.elementTechnologies && item.elementTechnologies.includes(cardFilters.component));
                      return matchesSearch && matchesCategory && matchesLevel && matchesBusinessUnit && matchesComponent;
                    });

                    if (filteredData.length > 0) {
                      return filteredData.map((item) => {
                        const itemComponents = (item.elementTechnologies || []).map(id => getComponentById(id)).filter(Boolean);
                        const nodePositions = item.nodePositions || {};
                        const componentRelations = item.componentRelations || [];

                        return (
                          <MegaTaskCard key={item.id}>
                            <CardHeader>
                              <CardTitle>{item.goal}</CardTitle>
                              <CardMeta>
                                <CardMetaBadge>{item.category}</CardMetaBadge>
                                <CardMetaBadge>{item.level}</CardMetaBadge>
                                <CardMetaBadge>{item.businessUnit}</CardMetaBadge>
                                {item.abbreviation && <CardMetaBadge>라벨: {item.abbreviation}</CardMetaBadge>}
                              </CardMeta>
                            </CardHeader>
                            <CardBody>
                              {itemComponents.length > 0 && (
                                <CardSection>
                                  <CardSectionTitle>구성 요소 ({itemComponents.length}개)</CardSectionTitle>
                                  <CardComponentList>
                                    {itemComponents.map((comp) => {
                                      const maturityOption = maturityLevelOptions.find(m => m.value === comp.maturityLevel);
                                      return (
                                        <CardComponentBadge key={comp.id}>
                                          {comp.name}
                                          {comp.maturityLevel && (
                                            <span style={{
                                              fontSize: '10px',
                                              padding: '1px 4px',
                                              borderRadius: '3px',
                                              background: maturityOption?.bgColor || '#f1f5f9',
                                              color: maturityOption?.textColor || '#475569',
                                              marginLeft: '4px'
                                            }}>
                                              {comp.maturityLevel}
                                            </span>
                                          )}
                                        </CardComponentBadge>
                                      );
                                    })}
                                  </CardComponentList>
                                </CardSection>
                              )}
                              {itemComponents.length >= 2 && (
                                <CardSection>
                                  <CardSectionTitle>구성 요소 관계</CardSectionTitle>
                                  <CardGraphView
                                    item={item}
                                    itemComponents={itemComponents}
                                    nodePositions={nodePositions}
                                    componentRelations={componentRelations}
                                    maturityLevelOptions={maturityLevelOptions}
                                    getDefaultNodePosition={getDefaultNodePosition}
                                    getEdgePoint={getEdgePoint}
                                    height={graphHeights[item.id]}
                                    onHeightChange={handleGraphHeightChange}
                                    savedZoomPan={cardGraphZoomPan[item.id]}
                                    onZoomPanChange={handleCardGraphZoomPanChange}
                                  />
                                </CardSection>
                              )}
                            </CardBody>
                            <CardFooter>
                              <CardDate>등록일: {item.registrationDate}</CardDate>
                              <CardActions>
                                <CardActionBtn onClick={() => handleEditItem(item)}>
                                  수정
                                </CardActionBtn>
                                <CardActionBtn className="delete" onClick={() => handleDeleteItem(item.id)}>
                                  삭제
                                </CardActionBtn>
                              </CardActions>
                            </CardFooter>
                          </MegaTaskCard>
                        );
                      });
                    } else if (data.length > 0) {
                      // 필터 결과가 없는 경우
                      return (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                          <Search size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                          <div style={{ fontSize: '16px', marginBottom: '8px' }}>필터 조건에 맞는 결과가 없습니다.</div>
                          <div style={{ fontSize: '14px' }}>필터 조건을 변경하거나 초기화해 주세요.</div>
                        </div>
                      );
                    } else {
                      return (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                          등록된 메가 과제가 없습니다. "데이터 추가" 버튼을 클릭하여 새 데이터를 추가하세요.
                        </div>
                      );
                    }
                  })()}
                </CardViewContainer>
              </>
            ) : (
              <TableContainer>
                <Table>
              <Thead>
                <tr>
                  <Th style={{ width: '18%' }}>메가 과제</Th>
                  <Th style={{ width: '70px' }}>라벨명</Th>
                  <Th style={{ width: '12%' }}>카테고리</Th>
                  <Th style={{ width: '55px' }}>수준</Th>
                  <Th style={{ width: '55px' }}>사업부</Th>
                  <Th style={{ width: '35%' }}>구성 요소</Th>
                  <Th style={{ width: '75px' }}>등록 날짜</Th>
                  <Th style={{ width: '60px' }}>관리</Th>
                </tr>
              </Thead>
              <Tbody>
                {data.length > 0 ? (
                  data.map((item) => (
                    <Tr key={item.id}>
                      <Td>{item.goal}</Td>
                      <Td>{item.abbreviation || '-'}</Td>
                      <Td>{item.category}</Td>
                      <Td>
                        <LevelBadge
                          $bgColor={getLevelColors(item.level).bgColor}
                          $textColor={getLevelColors(item.level).textColor}
                        >
                          {item.level}
                        </LevelBadge>
                      </Td>
                      <Td>{item.businessUnit}</Td>
                      <Td>
                        {(item.elementTechnologies || []).length > 0 ? (
                          <ComponentListContainer $expanded={expandedRowIds.has(item.id)}>
                            <ComponentListHeader>
                              <ExpandAllButton
                                onClick={() => {
                                  setExpandedRowIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) {
                                      next.delete(item.id);
                                    } else {
                                      next.add(item.id);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                {expandedRowIds.has(item.id) ? (
                                  <>
                                    <ChevronUp size={12} />
                                    접기
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={12} />
                                    상세보기
                                  </>
                                )}
                              </ExpandAllButton>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                ({(item.elementTechnologies || []).length}개)
                              </span>
                            </ComponentListHeader>
                            {(item.elementTechnologies || []).map((compId, idx) => {
                              const comp = getComponentById(compId);
                              if (!comp) return null;
                              const isExpanded = expandedRowIds.has(item.id);
                              return (
                                <ComponentListItem key={idx} $expanded={isExpanded}>
                                  <ComponentItemHeader>
                                    <ComponentNameTag>{comp.name}</ComponentNameTag>
                                  </ComponentItemHeader>
                                  {isExpanded && (
                                    <ComponentDetailInline>
                                      <DetailRow>
                                        <DetailLabel>담당 부서</DetailLabel>
                                        <DetailValue>{comp.department || '-'}</DetailValue>
                                      </DetailRow>
                                      <DetailRow>
                                        <DetailLabel>기술 구분</DetailLabel>
                                        <ComponentBadge
                                          $bgColor={getTechTypeColors(comp.techType).bgColor}
                                          $textColor={getTechTypeColors(comp.techType).textColor}
                                        >
                                          {comp.techType || '-'}
                                        </ComponentBadge>
                                      </DetailRow>
                                      {comp.maturityLevel && (
                                        <DetailRow>
                                          <DetailLabel>역량 성숙도</DetailLabel>
                                          <ComponentBadge
                                            $bgColor={maturityLevelOptions.find(m => m.value === comp.maturityLevel)?.bgColor || '#f1f5f9'}
                                            $textColor={maturityLevelOptions.find(m => m.value === comp.maturityLevel)?.textColor || '#475569'}
                                          >
                                            {comp.maturityLevel}
                                          </ComponentBadge>
                                        </DetailRow>
                                      )}
                                      {comp.description && (
                                        <DetailRow>
                                          <DetailLabel>상세 사항</DetailLabel>
                                          <DetailValue style={{ whiteSpace: 'pre-wrap' }}>{comp.description}</DetailValue>
                                        </DetailRow>
                                      )}
                                    </ComponentDetailInline>
                                  )}
                                </ComponentListItem>
                              );
                            })}
                            {/* 관계 표시 */}
                            {expandedRowIds.has(item.id) && (item.componentRelations || []).length > 0 && (
                              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <GitBranch size={12} />
                                  관계
                                </div>
                                {(item.componentRelations || []).map((rel) => {
                                  const sourceComp = getComponentById(rel.source);
                                  const targetComp = getComponentById(rel.target);
                                  if (!sourceComp || !targetComp) return null;
                                  return (
                                    <div key={rel.id} style={{
                                      fontSize: '11px',
                                      color: '#475569',
                                      padding: '4px 8px',
                                      background: '#f8fafc',
                                      borderRadius: '4px',
                                      marginBottom: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      flexWrap: 'wrap'
                                    }}>
                                      <span style={{ wordBreak: 'break-word' }}>{sourceComp.name}</span>
                                      <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0 }}>
                                        →
                                      </span>
                                      <span style={{ wordBreak: 'break-word' }}>{targetComp.name}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </ComponentListContainer>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>
                        )}
                      </Td>
                      <Td>{formatDate(item.registrationDate)}</Td>
                      <Td>
                        <ActionButtonGroup>
                          <ActionButton className="edit" onClick={() => handleEditItem(item)} title="수정">
                            <Edit2 size={16} />
                          </ActionButton>
                          <ActionButton className="delete" onClick={() => handleDeleteItem(item.id)} title="삭제">
                            <Trash2 size={16} />
                          </ActionButton>
                        </ActionButtonGroup>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <tr>
                    <Td colSpan={8}>
                      <EmptyMessage>
                        등록된 데이터가 없습니다. "데이터 추가" 버튼을 클릭하여 새 데이터를 추가하세요.
                      </EmptyMessage>
                    </Td>
                  </tr>
                )}
              </Tbody>
            </Table>
          </TableContainer>
            )}
          </>
        ) : viewMode === 'radar' ? (
          renderTechRadarView()
        ) : (
          renderComponentView()
        )}
      </Content>

      {/* Add Component Modal */}
      {isComponentModalOpen && (
        <ModalOverlay onClick={() => setIsComponentModalOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>구성 요소 추가</ModalTitle>
              <ModalCloseButton onClick={() => setIsComponentModalOpen(false)}>
                <X size={20} />
              </ModalCloseButton>
            </ModalHeader>
            <ModalBody>
              <FormGroup>
                <Label>구성 요소명</Label>
                <Input
                  type="text"
                  name="name"
                  value={componentFormData.name}
                  onChange={handleComponentInputChange}
                  placeholder="구성 요소명을 입력하세요"
                />
              </FormGroup>
              <FormGroup>
                <Label>담당 부서</Label>
                <Input
                  type="text"
                  name="department"
                  value={componentFormData.department}
                  onChange={handleComponentInputChange}
                  placeholder="담당 부서명을 입력하세요"
                />
              </FormGroup>
              <FormGroup>
                <Label>기술 구분</Label>
                <Select
                  name="techType"
                  value={componentFormData.techType}
                  onChange={handleComponentInputChange}
                >
                  <option value="">기술 구분을 선택하세요</option>
                  {techTypeOptions.map((type) => (
                    <option key={type.id} value={type.name}>{type.name}</option>
                  ))}
                </Select>
              </FormGroup>
              <FormGroup>
                <Label>역량 성숙도</Label>
                <Select
                  name="maturityLevel"
                  value={componentFormData.maturityLevel}
                  onChange={handleComponentInputChange}
                >
                  <option value="">역량 성숙도를 선택하세요</option>
                  {maturityLevelOptions.map((level) => (
                    <option key={level.value} value={level.value}>{level.value}</option>
                  ))}
                </Select>
              </FormGroup>
              <FormGroup>
                <Label>상세 사항 <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>(선택)</span></Label>
                <textarea
                  name="description"
                  value={componentFormData.description}
                  onChange={handleComponentInputChange}
                  placeholder="상세 사항을 입력하세요"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b',
                    resize: 'vertical',
                    minHeight: '80px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </FormGroup>
            </ModalBody>
            <ModalFooter>
              <Button className="secondary" onClick={() => setIsComponentModalOpen(false)}>
                취소
              </Button>
              <Button className="primary" onClick={handleAddComponent}>
                추가
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Add Data Modal */}
      {isModalOpen && (
        <ModalOverlay onClick={() => setIsModalOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>데이터 추가</ModalTitle>
              <ModalCloseButton onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </ModalCloseButton>
            </ModalHeader>
            <ModalBodyTwoColumn>
              {/* 왼쪽 열: 기본 정보 */}
              <ModalColumn>
                <FormGroup>
                  <Label>메가 과제</Label>
                  <Input
                    type="text"
                    name="goal"
                    value={formData.goal}
                    onChange={handleInputChange}
                    placeholder="메가 과제를 입력하세요"
                  />
                </FormGroup>
                <FormGroup>
                  <Label>라벨명 <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>(10글자 미만, 레이더에 표시)</span></Label>
                  <Input
                    type="text"
                    name="abbreviation"
                    value={formData.abbreviation}
                    onChange={(e) => {
                      if (e.target.value.length < 10) {
                        handleInputChange(e);
                      }
                    }}
                    placeholder="라벨명을 입력하세요"
                    maxLength={9}
                  />
                </FormGroup>
                <FormGroup>
                  <Label>카테고리</Label>
                  <Select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                  >
                    <option value="">카테고리를 선택하세요</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>수준</Label>
                  <Select
                    name="level"
                    value={formData.level}
                    onChange={handleInputChange}
                  >
                    <option value="">수준을 선택하세요</option>
                    {levelOptions.map((level) => (
                      <option key={level.id} value={level.name}>{level.name}</option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>사업부</Label>
                  <Select
                    name="businessUnit"
                    value={formData.businessUnit}
                    onChange={handleInputChange}
                  >
                    <option value="">사업부를 선택하세요</option>
                    {businessUnitOptions.map((unit) => (
                      <option key={unit.id} value={unit.name}>{unit.name}</option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>등록 날짜</Label>
                  <Input
                    type="date"
                    name="registrationDate"
                    value={formData.registrationDate}
                    onChange={handleInputChange}
                  />
                </FormGroup>
              </ModalColumn>

              {/* 오른쪽 열: 구성 요소 및 관계 */}
              <ModalColumn>
                <FormGroup style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Label>구성 요소 <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>(클릭하여 선택 또는 검색)</span></Label>
                  <ComponentSearchContainer>
                    <ComponentSearchInput
                      type="text"
                      value={componentSearchQuery}
                      onChange={(e) => {
                        setComponentSearchQuery(e.target.value);
                        setIsComponentSearchOpen(true);
                      }}
                      onFocus={() => setIsComponentSearchOpen(true)}
                      placeholder="클릭하여 목록 보기 또는 검색어 입력..."
                    />
                    {isComponentSearchOpen && (
                      <ComponentSearchDropdown>
                        {filteredComponents.length > 0 ? (
                          filteredComponents
                            .filter(comp => !formData.elementTechnologies.includes(comp.id))
                            .map((comp) => (
                              <ComponentSearchItem
                                key={comp.id}
                                onClick={() => handleSelectComponent(comp.id)}
                              >
                                <ComponentSearchItemName>{comp.name}</ComponentSearchItemName>
                                <ComponentSearchItemInfo>{comp.department} · {comp.techType}</ComponentSearchItemInfo>
                              </ComponentSearchItem>
                            ))
                        ) : (
                          <ComponentSearchEmpty>
                            {components.length === 0 ? (
                              <>등록된 구성 요소가 없습니다.<br/><span style={{ fontSize: '12px' }}>구성 요소 뷰에서 먼저 등록해주세요.</span></>
                            ) : (
                              <>검색 결과가 없습니다.</>
                            )}
                          </ComponentSearchEmpty>
                        )}
                        {filteredComponents.length > 0 && filteredComponents.filter(comp => !formData.elementTechnologies.includes(comp.id)).length === 0 && (
                          <ComponentSearchEmpty>
                            모든 구성 요소가 이미 선택되었습니다.
                          </ComponentSearchEmpty>
                        )}
                      </ComponentSearchDropdown>
                    )}
                  </ComponentSearchContainer>
                  {formData.elementTechnologies.length > 0 && (
                    <SelectedComponentsContainer>
                      {formData.elementTechnologies.map((compId) => {
                        const comp = getComponentById(compId);
                        if (!comp) return null;
                        return (
                          <Tag key={compId}>
                            {comp.name}
                            <button type="button" onClick={() => handleRemoveElementTech(compId)}>
                              <X size={12} />
                            </button>
                          </Tag>
                        );
                      })}
                    </SelectedComponentsContainer>
                  )}
                  {/* 의존성 그래프 편집 UI */}
                  {formData.elementTechnologies.length >= 2 && (
                    <DependencyGraphContainer>
                      <DependencyGraphHeader>
                        <DependencyGraphTitle>
                          <GitBranch size={14} />
                          구성 요소 관계 설정
                        </DependencyGraphTitle>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          빈 공간 드래그: 이동 | 휠: 확대/축소
                        </span>
                      </DependencyGraphHeader>
                      <GraphCanvasLarge
                        ref={graphCanvasRef}
                        onMouseDown={(e) => handleGraphPanStart(e, false)}
                        onMouseMove={(e) => {
                          handleCanvasMouseMove(e);
                          handleGraphPanMove(e, false);
                        }}
                        onMouseUp={() => {
                          handleCanvasMouseUp();
                          handleGraphPanEnd();
                        }}
                        onMouseLeave={() => {
                          handleCanvasMouseLeave();
                          handleGraphPanEnd();
                        }}
                        style={{ cursor: isGraphPanning ? 'grabbing' : 'default' }}
                      >
                        <div style={{
                          transform: `translate(${graphPan.x}px, ${graphPan.y}px) scale(${graphZoom})`,
                          transformOrigin: '0 0',
                          width: '3000px',
                          height: '3000px',
                          position: 'absolute',
                          top: 0,
                          left: 0
                        }}>
                          <GraphSvg>
                            <defs>
                              <marker
                                id="arrowhead-add"
                                markerWidth="12"
                                markerHeight="9"
                                refX="11"
                                refY="4.5"
                                orient="auto"
                              >
                                <polygon
                                  points="0 0, 12 4.5, 0 9"
                                  fill="#475569"
                                />
                              </marker>
                            </defs>
                            {formData.componentRelations.map((rel) => {
                              const sourcePos = getNodePosition(rel.source, formData.nodePositions, formData.elementTechnologies);
                              const targetPos = getNodePosition(rel.target, formData.nodePositions, formData.elementTechnologies);
                              if (!sourcePos || !targetPos) return null;
                              const sourceEdge = getEdgePoint(sourcePos, targetPos);
                              const targetEdge = getEdgePoint(targetPos, sourcePos);
                              const midX = (sourceEdge.x + targetEdge.x) / 2;
                              const midY = (sourceEdge.y + targetEdge.y) / 2;
                              const isHovered = hoveredRelation === rel.id;
                              return (
                                <g key={rel.id}>
                                  {/* 투명한 넓은 영역 - 호버 감지용 */}
                                  <line
                                    x1={sourceEdge.x}
                                    y1={sourceEdge.y}
                                    x2={targetEdge.x}
                                    y2={targetEdge.y}
                                    stroke="transparent"
                                    strokeWidth="20"
                                    style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                                    onMouseEnter={() => setHoveredRelation(rel.id)}
                                    onMouseLeave={() => setHoveredRelation(null)}
                                  />
                                  {/* 실제 보이는 선 */}
                                  <line
                                    x1={sourceEdge.x}
                                    y1={sourceEdge.y}
                                    x2={targetEdge.x}
                                    y2={targetEdge.y}
                                    stroke={isHovered ? '#ef4444' : '#475569'}
                                    strokeWidth={isHovered ? 4 : 2.5}
                                    markerEnd="url(#arrowhead-add)"
                                    style={{ pointerEvents: 'none', transition: 'stroke 0.2s, stroke-width 0.2s' }}
                                  />
                                  {/* 삭제 버튼 */}
                                  {isHovered && (
                                    <foreignObject
                                      x={midX - 10}
                                      y={midY - 10}
                                      width="20"
                                      height="20"
                                      style={{ overflow: 'visible' }}
                                    >
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveRelation(rel.id);
                                          setHoveredRelation(null);
                                        }}
                                        onMouseEnter={() => setHoveredRelation(rel.id)}
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          background: '#ef4444',
                                          borderRadius: '50%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer',
                                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }}
                                        title="관계 삭제"
                                      >
                                        <X size={12} color="white" />
                                      </div>
                                    </foreignObject>
                                  )}
                                </g>
                              );
                            })}
                          </GraphSvg>
                          {formData.elementTechnologies.map((compId) => {
                            const comp = getComponentById(compId);
                            const pos = getNodePosition(compId, formData.nodePositions, formData.elementTechnologies);
                            if (!comp || !pos) return null;
                            const maturityOption = maturityLevelOptions.find(m => m.value === comp.maturityLevel);
                            return (
                              <GraphNode
                                key={compId}
                                $selected={selectedSourceNode === compId}
                                style={{
                                  left: pos.x,
                                  top: pos.y,
                                  cursor: draggingNode === compId ? 'grabbing' : 'grab'
                                }}
                                onMouseDown={(e) => handleNodeMouseDown(compId, e)}
                                onClick={(e) => handleNodeClick(compId, e)}
                              >
                                {comp.name}
                                <GraphNodeLabel $selected={selectedSourceNode === compId}>
                                  {comp.techType}
                                </GraphNodeLabel>
                                <GraphNodeBadges>
                                  <GraphNodeBadge $bgColor="#e0e7ff" $textColor="#3730a3">
                                    {comp.department}
                                  </GraphNodeBadge>
                                  {comp.maturityLevel && (
                                    <GraphNodeBadge
                                      $bgColor={maturityOption?.bgColor}
                                      $textColor={maturityOption?.textColor}
                                    >
                                      {comp.maturityLevel}
                                    </GraphNodeBadge>
                                  )}
                                </GraphNodeBadges>
                              </GraphNode>
                            );
                          })}
                        </div>
                        <div style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          fontSize: '10px',
                          color: '#94a3b8',
                          background: 'rgba(255,255,255,0.8)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {Math.round(graphZoom * 100)}%
                        </div>
                      </GraphCanvasLarge>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
                        {selectedSourceNode ? (
                          <span style={{ color: '#3b82f6' }}>
                            "{getComponentById(selectedSourceNode)?.name}" 에서 연결할 대상을 클릭하세요 (취소: 같은 노드 클릭)
                          </span>
                        ) : (
                          '클릭: 관계 추가 | 화살표 hover: 삭제'
                        )}
                      </div>
                    </DependencyGraphContainer>
                  )}
                </FormGroup>
              </ModalColumn>
            </ModalBodyTwoColumn>
            <ModalFooter>
              <Button className="secondary" onClick={() => setIsModalOpen(false)}>
                취소
              </Button>
              <Button className="primary" onClick={handleSubmit}>
                추가
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Edit Data Modal */}
      {isEditModalOpen && editFormData && (
        <ModalOverlay onClick={() => setIsEditModalOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>데이터 수정</ModalTitle>
              <ModalCloseButton onClick={() => setIsEditModalOpen(false)}>
                <X size={20} />
              </ModalCloseButton>
            </ModalHeader>
            <ModalBodyTwoColumn>
              {/* 왼쪽 열: 기본 정보 */}
              <ModalColumn>
                <FormGroup>
                  <Label>메가 과제</Label>
                  <Input
                    type="text"
                    name="goal"
                    value={editFormData.goal}
                    onChange={handleEditFormChange}
                    placeholder="메가 과제를 입력하세요"
                  />
                </FormGroup>
                <FormGroup>
                  <Label>라벨명 <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>(10글자 미만, 레이더에 표시)</span></Label>
                  <Input
                    type="text"
                    name="abbreviation"
                    value={editFormData.abbreviation || ''}
                    onChange={(e) => {
                      if (e.target.value.length < 10) {
                        handleEditFormChange(e);
                      }
                    }}
                    placeholder="라벨명을 입력하세요"
                    maxLength={9}
                  />
                </FormGroup>
                <FormGroup>
                  <Label>카테고리</Label>
                  <Select
                    name="category"
                    value={editFormData.category}
                    onChange={handleEditFormChange}
                  >
                    <option value="">카테고리를 선택하세요</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>수준</Label>
                  <Select
                    name="level"
                    value={editFormData.level}
                    onChange={handleEditFormChange}
                  >
                    <option value="">수준을 선택하세요</option>
                    {levelOptions.map((level) => (
                      <option key={level.id} value={level.name}>{level.name}</option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>사업부</Label>
                  <Select
                    name="businessUnit"
                    value={editFormData.businessUnit}
                    onChange={handleEditFormChange}
                  >
                    <option value="">사업부를 선택하세요</option>
                    {businessUnitOptions.map((unit) => (
                      <option key={unit.id} value={unit.name}>{unit.name}</option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>등록 날짜</Label>
                  <Input
                    type="date"
                    name="registrationDate"
                    value={editFormData.registrationDate}
                    onChange={handleEditFormChange}
                  />
                </FormGroup>
              </ModalColumn>

              {/* 오른쪽 열: 구성 요소 및 관계 */}
              <ModalColumn>
                <FormGroup style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Label>구성 요소 <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>(클릭하여 선택 또는 검색)</span></Label>
                <ComponentSearchContainer>
                  <ComponentSearchInput
                    type="text"
                    value={componentSearchQuery}
                    onChange={(e) => {
                      setComponentSearchQuery(e.target.value);
                      setIsComponentSearchOpen(true);
                    }}
                    onFocus={() => setIsComponentSearchOpen(true)}
                    placeholder="클릭하여 목록 보기 또는 검색어 입력..."
                  />
                  {isComponentSearchOpen && (
                    <ComponentSearchDropdown>
                      {filteredComponents.length > 0 ? (
                        filteredComponents
                          .filter(comp => !editFormData.elementTechnologies.includes(comp.id))
                          .map((comp) => (
                            <ComponentSearchItem
                              key={comp.id}
                              onClick={() => handleSelectEditComponent(comp.id)}
                            >
                              <ComponentSearchItemName>{comp.name}</ComponentSearchItemName>
                              <ComponentSearchItemInfo>{comp.department} · {comp.techType}</ComponentSearchItemInfo>
                            </ComponentSearchItem>
                          ))
                      ) : (
                        <ComponentSearchEmpty>
                          {components.length === 0 ? (
                            <>등록된 구성 요소가 없습니다.<br/><span style={{ fontSize: '12px' }}>구성 요소 뷰에서 먼저 등록해주세요.</span></>
                          ) : (
                            <>검색 결과가 없습니다.</>
                          )}
                        </ComponentSearchEmpty>
                      )}
                      {filteredComponents.length > 0 && filteredComponents.filter(comp => !editFormData.elementTechnologies.includes(comp.id)).length === 0 && (
                        <ComponentSearchEmpty>
                          모든 구성 요소가 이미 선택되었습니다.
                        </ComponentSearchEmpty>
                      )}
                    </ComponentSearchDropdown>
                  )}
                </ComponentSearchContainer>
                {editFormData.elementTechnologies && editFormData.elementTechnologies.length > 0 && (
                  <SelectedComponentsContainer>
                    {editFormData.elementTechnologies.map((compId) => {
                      const comp = getComponentById(compId);
                      if (!comp) return null;
                      return (
                        <Tag key={compId}>
                          {comp.name}
                          <button type="button" onClick={() => handleRemoveEditElementTech(compId)}>
                            <X size={12} />
                          </button>
                        </Tag>
                      );
                    })}
                  </SelectedComponentsContainer>
                )}
                {/* 의존성 그래프 편집 UI (수정 모달) */}
                {editFormData.elementTechnologies && editFormData.elementTechnologies.length >= 2 && (
                  <DependencyGraphContainer>
                    <DependencyGraphHeader>
                      <DependencyGraphTitle>
                        <GitBranch size={14} />
                        구성 요소 관계 설정
                      </DependencyGraphTitle>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        빈 공간 드래그: 이동 | 휠: 확대/축소
                      </span>
                    </DependencyGraphHeader>
                    <GraphCanvasLarge
                      ref={editGraphCanvasRef}
                      onMouseDown={(e) => handleGraphPanStart(e, true)}
                      onMouseMove={(e) => {
                        handleEditCanvasMouseMove(e);
                        handleGraphPanMove(e, true);
                      }}
                      onMouseUp={() => {
                        handleEditCanvasMouseUp();
                        handleGraphPanEnd();
                      }}
                      onMouseLeave={() => {
                        handleEditCanvasMouseLeave();
                        handleGraphPanEnd();
                      }}
                      style={{ cursor: isGraphPanning ? 'grabbing' : 'default' }}
                    >
                      <div style={{
                        transform: `translate(${editGraphPan.x}px, ${editGraphPan.y}px) scale(${editGraphZoom})`,
                        transformOrigin: '0 0',
                        width: '3000px',
                        height: '3000px',
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }}>
                        <GraphSvg>
                          <defs>
                            <marker
                              id="arrowhead-edit"
                              markerWidth="12"
                              markerHeight="9"
                              refX="11"
                              refY="4.5"
                              orient="auto"
                            >
                              <polygon
                                points="0 0, 12 4.5, 0 9"
                                fill="#475569"
                              />
                            </marker>
                          </defs>
                          {(editFormData.componentRelations || []).map((rel) => {
                            const sourcePos = getNodePosition(rel.source, editFormData.nodePositions, editFormData.elementTechnologies);
                            const targetPos = getNodePosition(rel.target, editFormData.nodePositions, editFormData.elementTechnologies);
                            if (!sourcePos || !targetPos) return null;
                            const sourceEdge = getEdgePoint(sourcePos, targetPos);
                            const targetEdge = getEdgePoint(targetPos, sourcePos);
                            const midX = (sourceEdge.x + targetEdge.x) / 2;
                            const midY = (sourceEdge.y + targetEdge.y) / 2;
                            const isHovered = hoveredRelation === rel.id;
                            return (
                              <g key={rel.id}>
                                {/* 투명한 넓은 영역 - 호버 감지용 */}
                                <line
                                  x1={sourceEdge.x}
                                  y1={sourceEdge.y}
                                  x2={targetEdge.x}
                                  y2={targetEdge.y}
                                  stroke="transparent"
                                  strokeWidth="20"
                                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                                  onMouseEnter={() => setHoveredRelation(rel.id)}
                                  onMouseLeave={() => setHoveredRelation(null)}
                                />
                                {/* 실제 보이는 선 */}
                                <line
                                  x1={sourceEdge.x}
                                  y1={sourceEdge.y}
                                  x2={targetEdge.x}
                                  y2={targetEdge.y}
                                  stroke={isHovered ? '#ef4444' : '#475569'}
                                  strokeWidth={isHovered ? 4 : 2.5}
                                  markerEnd="url(#arrowhead-edit)"
                                  style={{ pointerEvents: 'none', transition: 'stroke 0.2s, stroke-width 0.2s' }}
                                />
                                {/* 삭제 버튼 */}
                                {isHovered && (
                                  <foreignObject
                                    x={midX - 10}
                                    y={midY - 10}
                                    width="20"
                                    height="20"
                                    style={{ overflow: 'visible' }}
                                  >
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveEditRelation(rel.id);
                                        setHoveredRelation(null);
                                      }}
                                      onMouseEnter={() => setHoveredRelation(rel.id)}
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        background: '#ef4444',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                      }}
                                      title="관계 삭제"
                                    >
                                      <X size={12} color="white" />
                                    </div>
                                  </foreignObject>
                                )}
                              </g>
                            );
                          })}
                        </GraphSvg>
                        {editFormData.elementTechnologies.map((compId) => {
                          const comp = getComponentById(compId);
                          const pos = getNodePosition(compId, editFormData.nodePositions, editFormData.elementTechnologies);
                          if (!comp || !pos) return null;
                          const maturityOption = maturityLevelOptions.find(m => m.value === comp.maturityLevel);
                          return (
                            <GraphNode
                              key={compId}
                              $selected={selectedSourceNode === compId}
                              style={{
                                left: pos.x,
                                top: pos.y,
                                cursor: draggingNode === compId ? 'grabbing' : 'grab'
                              }}
                              onMouseDown={(e) => handleEditNodeMouseDown(compId, e)}
                              onClick={(e) => handleEditNodeClick(compId, e)}
                            >
                              {comp.name}
                              <GraphNodeLabel $selected={selectedSourceNode === compId}>
                                {comp.techType}
                              </GraphNodeLabel>
                              <GraphNodeBadges>
                                <GraphNodeBadge $bgColor="#e0e7ff" $textColor="#3730a3">
                                  {comp.department}
                                </GraphNodeBadge>
                                {comp.maturityLevel && (
                                  <GraphNodeBadge
                                    $bgColor={maturityOption?.bgColor}
                                    $textColor={maturityOption?.textColor}
                                  >
                                    {comp.maturityLevel}
                                  </GraphNodeBadge>
                                )}
                              </GraphNodeBadges>
                            </GraphNode>
                          );
                        })}
                      </div>
                      <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        fontSize: '10px',
                        color: '#94a3b8',
                        background: 'rgba(255,255,255,0.8)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {Math.round(editGraphZoom * 100)}%
                      </div>
                    </GraphCanvasLarge>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
                      {selectedSourceNode ? (
                        <span style={{ color: '#3b82f6' }}>
                          "{getComponentById(selectedSourceNode)?.name}" 에서 연결할 대상을 클릭하세요 (취소: 같은 노드 클릭)
                        </span>
                      ) : (
                        '클릭: 관계 추가 | 화살표 hover: 삭제'
                      )}
                    </div>
                  </DependencyGraphContainer>
                )}
                </FormGroup>
              </ModalColumn>
            </ModalBodyTwoColumn>
            <ModalFooter>
              <Button className="secondary" onClick={() => setIsEditModalOpen(false)}>
                취소
              </Button>
              <Button className="primary" onClick={handleUpdateItem}>
                저장
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Edit Component Modal */}
      {isEditComponentModalOpen && editComponentFormData && (
        <ModalOverlay onClick={() => setIsEditComponentModalOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>구성 요소 수정</ModalTitle>
              <ModalCloseButton onClick={() => setIsEditComponentModalOpen(false)}>
                <X size={20} />
              </ModalCloseButton>
            </ModalHeader>
            <ModalBody>
              <FormGroup>
                <Label>구성 요소명</Label>
                <Input
                  type="text"
                  name="name"
                  value={editComponentFormData.name}
                  onChange={handleEditComponentFormChange}
                  placeholder="구성 요소명을 입력하세요"
                />
              </FormGroup>
              <FormGroup>
                <Label>담당 부서</Label>
                <Input
                  type="text"
                  name="department"
                  value={editComponentFormData.department}
                  onChange={handleEditComponentFormChange}
                  placeholder="담당 부서명을 입력하세요"
                />
              </FormGroup>
              <FormGroup>
                <Label>기술 구분</Label>
                <Select
                  name="techType"
                  value={editComponentFormData.techType}
                  onChange={handleEditComponentFormChange}
                >
                  <option value="">기술 구분을 선택하세요</option>
                  {techTypeOptions.map((type) => (
                    <option key={type.id} value={type.name}>{type.name}</option>
                  ))}
                </Select>
              </FormGroup>
              <FormGroup>
                <Label>역량 성숙도</Label>
                <Select
                  name="maturityLevel"
                  value={editComponentFormData.maturityLevel || ''}
                  onChange={handleEditComponentFormChange}
                >
                  <option value="">역량 성숙도를 선택하세요</option>
                  {maturityLevelOptions.map((level) => (
                    <option key={level.value} value={level.value}>{level.value}</option>
                  ))}
                </Select>
              </FormGroup>
              <FormGroup>
                <Label>상세 사항 <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>(선택)</span></Label>
                <textarea
                  name="description"
                  value={editComponentFormData.description || ''}
                  onChange={handleEditComponentFormChange}
                  placeholder="상세 사항을 입력하세요"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b',
                    resize: 'vertical',
                    minHeight: '80px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </FormGroup>
            </ModalBody>
            <ModalFooter>
              <Button className="secondary" onClick={() => setIsEditComponentModalOpen(false)}>
                취소
              </Button>
              <Button className="primary" onClick={handleUpdateComponent}>
                저장
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <ModalOverlay onClick={() => setIsSettingsOpen(false)}>
          <SettingsModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>설정</ModalTitle>
              <ModalCloseButton onClick={() => setIsSettingsOpen(false)}>
                <X size={20} />
              </ModalCloseButton>
            </ModalHeader>
            <SettingsModalBody>
              <TabContainer>
                <Tab
                  $active={activeSettingsTab === 'level'}
                  onClick={() => setActiveSettingsTab('level')}
                >
                  수준
                </Tab>
                <Tab
                  $active={activeSettingsTab === 'category'}
                  onClick={() => setActiveSettingsTab('category')}
                >
                  카테고리
                </Tab>
                <Tab
                  $active={activeSettingsTab === 'businessUnit'}
                  onClick={() => setActiveSettingsTab('businessUnit')}
                >
                  사업부
                </Tab>
                <Tab
                  $active={activeSettingsTab === 'techType'}
                  onClick={() => setActiveSettingsTab('techType')}
                >
                  기술 구분
                </Tab>
              </TabContainer>

              <TabContent $active={activeSettingsTab === 'level'}>
                <LevelList>
                  {levelOptions.map((level) => (
                    <LevelItem key={level.id}>
                      {editingLevelId === level.id ? (
                        <>
                          <EditColorInput
                            type="color"
                            value={editingLevelColor}
                            onChange={(e) => setEditingLevelColor(e.target.value)}
                            title="색상 선택"
                          />
                          <EditInput
                            type="text"
                            value={editingLevelName}
                            onChange={(e) => setEditingLevelName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSaveEditLevel()}
                            autoFocus
                          />
                          <SaveEditButton onClick={handleSaveEditLevel} title="저장">
                            <Check size={16} />
                          </SaveEditButton>
                          <CancelEditButton onClick={handleCancelEditLevel} title="취소">
                            <X size={16} />
                          </CancelEditButton>
                        </>
                      ) : (
                        <>
                          <LevelColorPreview $bgColor={level.bgColor} />
                          <LevelName>{level.name}</LevelName>
                          <EditLevelButton
                            onClick={() => handleStartEditLevel(level)}
                            title="수정"
                          >
                            <Edit2 size={16} />
                          </EditLevelButton>
                          <DeleteLevelButton
                            onClick={() => handleDeleteLevel(level.id)}
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </DeleteLevelButton>
                        </>
                      )}
                    </LevelItem>
                  ))}
                </LevelList>
                <AddLevelForm>
                  <AddLevelInput
                    type="text"
                    value={newLevelName}
                    onChange={(e) => setNewLevelName(e.target.value)}
                    placeholder="새 수준 이름"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddLevel()}
                  />
                  <ColorInput
                    type="color"
                    value={newLevelColor}
                    onChange={(e) => setNewLevelColor(e.target.value)}
                    title="색상 선택"
                  />
                  <AddLevelButton
                    onClick={handleAddLevel}
                    disabled={!newLevelName.trim()}
                    title="추가"
                  >
                    <Plus size={18} />
                  </AddLevelButton>
                </AddLevelForm>
              </TabContent>

              <TabContent $active={activeSettingsTab === 'category'}>
                <LevelList>
                  {categoryOptions.map((cat) => (
                    <LevelItem key={cat.id}>
                      {editingCategoryId === cat.id ? (
                        <>
                          <EditInput
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSaveEditCategory()}
                            autoFocus
                          />
                          <SaveEditButton onClick={handleSaveEditCategory} title="저장">
                            <Check size={16} />
                          </SaveEditButton>
                          <CancelEditButton onClick={handleCancelEditCategory} title="취소">
                            <X size={16} />
                          </CancelEditButton>
                        </>
                      ) : (
                        <>
                          <LevelName>{cat.name}</LevelName>
                          <EditLevelButton
                            onClick={() => handleStartEditCategory(cat)}
                            title="수정"
                          >
                            <Edit2 size={16} />
                          </EditLevelButton>
                          <DeleteLevelButton
                            onClick={() => handleDeleteCategory(cat.id)}
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </DeleteLevelButton>
                        </>
                      )}
                    </LevelItem>
                  ))}
                </LevelList>
                <AddLevelForm>
                  <AddLevelInput
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="새 카테고리 이름"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                    style={{ flex: 1 }}
                  />
                  <AddLevelButton
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim()}
                    title="추가"
                  >
                    <Plus size={18} />
                  </AddLevelButton>
                </AddLevelForm>
              </TabContent>

              <TabContent $active={activeSettingsTab === 'businessUnit'}>
                <LevelList>
                  {businessUnitOptions.map((unit) => (
                    <LevelItem key={unit.id}>
                      {editingBusinessUnitId === unit.id ? (
                        <>
                          <EditInput
                            type="text"
                            value={editingBusinessUnitName}
                            onChange={(e) => setEditingBusinessUnitName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSaveEditBusinessUnit()}
                            autoFocus
                          />
                          <SaveEditButton onClick={handleSaveEditBusinessUnit} title="저장">
                            <Check size={16} />
                          </SaveEditButton>
                          <CancelEditButton onClick={handleCancelEditBusinessUnit} title="취소">
                            <X size={16} />
                          </CancelEditButton>
                        </>
                      ) : (
                        <>
                          <LevelName>{unit.name}</LevelName>
                          <EditLevelButton
                            onClick={() => handleStartEditBusinessUnit(unit)}
                            title="수정"
                          >
                            <Edit2 size={16} />
                          </EditLevelButton>
                          <DeleteLevelButton
                            onClick={() => handleDeleteBusinessUnit(unit.id)}
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </DeleteLevelButton>
                        </>
                      )}
                    </LevelItem>
                  ))}
                </LevelList>
                <AddLevelForm>
                  <AddLevelInput
                    type="text"
                    value={newBusinessUnitName}
                    onChange={(e) => setNewBusinessUnitName(e.target.value)}
                    placeholder="새 사업부 이름"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddBusinessUnit()}
                    style={{ flex: 1 }}
                  />
                  <AddLevelButton
                    onClick={handleAddBusinessUnit}
                    disabled={!newBusinessUnitName.trim()}
                    title="추가"
                  >
                    <Plus size={18} />
                  </AddLevelButton>
                </AddLevelForm>
              </TabContent>

              <TabContent $active={activeSettingsTab === 'techType'}>
                <LevelList>
                  {techTypeOptions.map((type) => (
                    <LevelItem key={type.id}>
                      {editingTechTypeId === type.id ? (
                        <>
                          <EditColorInput
                            type="color"
                            value={editingTechTypeColor}
                            onChange={(e) => setEditingTechTypeColor(e.target.value)}
                            title="색상 선택"
                          />
                          <EditInput
                            type="text"
                            value={editingTechTypeName}
                            onChange={(e) => setEditingTechTypeName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSaveEditTechType()}
                            autoFocus
                          />
                          <SaveEditButton onClick={handleSaveEditTechType} title="저장">
                            <Check size={16} />
                          </SaveEditButton>
                          <CancelEditButton onClick={handleCancelEditTechType} title="취소">
                            <X size={16} />
                          </CancelEditButton>
                        </>
                      ) : (
                        <>
                          <LevelColorPreview $bgColor={type.bgColor} />
                          <LevelName>{type.name}</LevelName>
                          <EditLevelButton
                            onClick={() => handleStartEditTechType(type)}
                            title="수정"
                          >
                            <Edit2 size={16} />
                          </EditLevelButton>
                          <DeleteLevelButton
                            onClick={() => handleDeleteTechType(type.id)}
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </DeleteLevelButton>
                        </>
                      )}
                    </LevelItem>
                  ))}
                </LevelList>
                <AddLevelForm>
                  <AddLevelInput
                    type="text"
                    value={newTechTypeName}
                    onChange={(e) => setNewTechTypeName(e.target.value)}
                    placeholder="새 기술 구분 이름"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTechType()}
                  />
                  <ColorInput
                    type="color"
                    value={newTechTypeColor}
                    onChange={(e) => setNewTechTypeColor(e.target.value)}
                    title="색상 선택"
                  />
                  <AddLevelButton
                    onClick={handleAddTechType}
                    disabled={!newTechTypeName.trim()}
                    title="추가"
                  >
                    <Plus size={18} />
                  </AddLevelButton>
                </AddLevelForm>
              </TabContent>
            </SettingsModalBody>
            <ModalFooter>
              <Button className="primary" onClick={() => setIsSettingsOpen(false)}>
                완료
              </Button>
            </ModalFooter>
          </SettingsModalContent>
        </ModalOverlay>
      )}

      {/* Bulk Add Modal */}
      {isBulkAddOpen && (
        <BulkAddModalOverlay onClick={(e) => e.target === e.currentTarget && handleCloseBulkAdd()}>
          <BulkAddModalContent onClick={(e) => e.stopPropagation()}>
            <BulkAddModalHeader>
              <BulkAddModalTitle>
                <Database size={20} />
                데이터 일괄 추가
              </BulkAddModalTitle>
              <ModalCloseButton onClick={handleCloseBulkAdd} style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                <X size={20} />
              </ModalCloseButton>
            </BulkAddModalHeader>
            <BulkAddModalBody>
              <BulkAddActionBar>
                <BulkAddActionBtn className="add" onClick={handleAddBulkRow}>
                  <Plus size={14} />
                  행 추가
                </BulkAddActionBtn>
                <BulkAddActionBtn className="load" onClick={handleLoadExistingData}>
                  <Upload size={14} />
                  리스트 불러오기
                </BulkAddActionBtn>
                <BulkAddActionBtn className="paste" onClick={handleOpenPasteModal}>
                  <Copy size={14} />
                  엑셀 붙여넣기
                </BulkAddActionBtn>
                <BulkAddActionBtn className="export" onClick={handleExportCSV}>
                  <Download size={14} />
                  CSV 내보내기
                </BulkAddActionBtn>
                <BulkAddActionBtn className="clear" onClick={handleClearBulkTable}>
                  <Trash2 size={14} />
                  전체 삭제
                </BulkAddActionBtn>
              </BulkAddActionBar>
              <BulkAddTableWrapper>
                <BulkAddTable>
                  <BulkAddTableHead>
                    <tr>
                      <BulkAddTh style={{ width: '50px' }}>#</BulkAddTh>
                      <BulkAddTh className="required" style={{ minWidth: '200px' }}>메가 과제</BulkAddTh>
                      <BulkAddTh style={{ minWidth: '100px' }}>라벨명</BulkAddTh>
                      <BulkAddTh style={{ minWidth: '200px' }}>카테고리</BulkAddTh>
                      <BulkAddTh style={{ minWidth: '150px' }}>수준</BulkAddTh>
                      <BulkAddTh style={{ minWidth: '120px' }}>사업부</BulkAddTh>
                      <BulkAddTh style={{ minWidth: '150px' }}>등록 날짜</BulkAddTh>
                      <BulkAddTh style={{ width: '60px' }}>삭제</BulkAddTh>
                    </tr>
                  </BulkAddTableHead>
                  <BulkAddTableBody>
                    {bulkTableData.map((row, index) => (
                      <BulkAddTr key={index}>
                        <BulkAddTd style={{ textAlign: 'center', color: '#64748b' }}>{index + 1}</BulkAddTd>
                        <BulkAddTd>
                          <BulkAddInput
                            type="text"
                            value={row.goal}
                            onChange={(e) => handleBulkTableChange(index, 'goal', e.target.value)}
                            placeholder="메가 과제 (필수)"
                          />
                        </BulkAddTd>
                        <BulkAddTd>
                          <BulkAddInput
                            type="text"
                            value={row.abbreviation || ''}
                            onChange={(e) => {
                              if (e.target.value.length < 10) {
                                handleBulkTableChange(index, 'abbreviation', e.target.value);
                              }
                            }}
                            placeholder="라벨명"
                            maxLength={9}
                          />
                        </BulkAddTd>
                        <BulkAddTd>
                          <BulkAddSelect
                            value={row.category}
                            onChange={(e) => handleBulkTableChange(index, 'category', e.target.value)}
                          >
                            <option value="">선택</option>
                            {categoryOptions.map((cat) => (
                              <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                          </BulkAddSelect>
                        </BulkAddTd>
                        <BulkAddTd>
                          <BulkAddSelect
                            value={row.level}
                            onChange={(e) => handleBulkTableChange(index, 'level', e.target.value)}
                          >
                            <option value="">선택</option>
                            {levelOptions.map((level) => (
                              <option key={level.id} value={level.name}>{level.name}</option>
                            ))}
                          </BulkAddSelect>
                        </BulkAddTd>
                        <BulkAddTd>
                          <BulkAddSelect
                            value={row.businessUnit}
                            onChange={(e) => handleBulkTableChange(index, 'businessUnit', e.target.value)}
                          >
                            <option value="">선택</option>
                            {businessUnitOptions.map((unit) => (
                              <option key={unit.id} value={unit.name}>{unit.name}</option>
                            ))}
                          </BulkAddSelect>
                        </BulkAddTd>
                        <BulkAddTd>
                          <BulkAddInput
                            type="date"
                            value={row.registrationDate}
                            onChange={(e) => handleBulkTableChange(index, 'registrationDate', e.target.value)}
                          />
                        </BulkAddTd>
                        <BulkAddTd style={{ textAlign: 'center' }}>
                          {bulkTableData.length > 1 && (
                            <BulkAddDeleteBtn onClick={() => handleDeleteBulkRow(index)}>
                              <Trash2 size={14} />
                            </BulkAddDeleteBtn>
                          )}
                        </BulkAddTd>
                      </BulkAddTr>
                    ))}
                  </BulkAddTableBody>
                </BulkAddTable>
              </BulkAddTableWrapper>
            </BulkAddModalBody>
            <BulkAddModalFooter>
              <BulkAddStats>
                유효한 데이터: <strong>{countValidBulkRows()}개</strong> 행 (메가 과제가 입력된 행)
              </BulkAddStats>
              <BulkAddButtons>
                <Button className="secondary" onClick={handleCloseBulkAdd}>
                  취소
                </Button>
                <Button className="primary" onClick={handleBulkAddSubmit} disabled={countValidBulkRows() === 0}>
                  <Database size={16} />
                  {countValidBulkRows()}개 데이터 추가
                </Button>
              </BulkAddButtons>
            </BulkAddModalFooter>
          </BulkAddModalContent>
        </BulkAddModalOverlay>
      )}

      {/* Paste Modal */}
      {isPasteModalOpen && (
        <PasteModalOverlay onClick={(e) => e.target === e.currentTarget && handleClosePasteModal()}>
          <PasteModalContent onClick={(e) => e.stopPropagation()}>
            <PasteModalHeader>
              <BulkAddModalTitle>
                <Copy size={18} />
                엑셀 데이터 붙여넣기
              </BulkAddModalTitle>
              <ModalCloseButton onClick={handleClosePasteModal} style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                <X size={20} />
              </ModalCloseButton>
            </PasteModalHeader>
            <PasteModalBody>
              <BulkAddInfoBox>
                <h4>
                  <Info size={16} />
                  사용 방법
                </h4>
                <p>
                  엑셀에서 데이터를 복사(<code>Ctrl+C</code>)하여 아래 입력창에 붙여넣기(<code>Ctrl+V</code>)하세요.<br/>
                  <strong>열 순서:</strong> 메가 과제 | 라벨명 | 카테고리 | 수준 | 사업부 | 등록 날짜 (YYYY-MM-DD)
                </p>
              </BulkAddInfoBox>
              <BulkAddTextArea
                ref={bulkAddTextAreaRef}
                value={bulkAddText}
                onChange={(e) => setBulkAddText(e.target.value)}
                placeholder="여기에 엑셀 데이터를 붙여넣으세요..."
                style={{ minHeight: '200px' }}
              />
            </PasteModalBody>
            <PasteModalFooter>
              <Button className="secondary" onClick={handleClosePasteModal}>
                취소
              </Button>
              <Button className="primary" onClick={handlePasteSubmit} disabled={!bulkAddText.trim()}>
                <Copy size={16} />
                테이블에 추가
              </Button>
            </PasteModalFooter>
          </PasteModalContent>
        </PasteModalOverlay>
      )}

      {/* Server Sync Modal */}
      <ServerSyncModal
        isOpen={isServerSyncModalOpen}
        onClose={() => setIsServerSyncModalOpen(false)}
        currentData={getCurrentData()}
        onLoad={handleLoadFromServer}
      />
    </Container>
  );
};

export default DigitalTwinTechLevelApp;
