import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import Header from './components/Layout/Header';
import AddDataModal from './components/Modal/AddDataModal';
import BulkAddMaterialModal from './components/Modal/BulkAddMaterialModal';
import BulkAddTestModal from './components/Modal/BulkAddTestModal';
import SettingsModal from './components/Modal/SettingsModal';
import TestMethodModal from './components/Modal/TestMethodModal';
import MaterialListPanel from './components/Panel/MaterialListPanel';
import MaterialDetailPanel from './components/Panel/MaterialDetailPanel';
import { MaterialDashboard } from './components/Dashboard';
import { TestMethodsView } from './components/TestMethods';
import { parseTraFile } from './utils/traFileParser';
import { parseStrainSweepFile } from './utils/strainSweepFileParser';
import { parseFreqTempFile } from './utils/freqTempFileParser';
import { materialCouncilApi } from './services/materialCouncilApi';
import { todayLocalYmd } from '../../shared/utils/localDate';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const Content = styled.main`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const ListPanelWrapper = styled.div`
  width: 300px;
  flex-shrink: 0;
`;

const DetailPanelWrapper = styled.div`
  flex: 1;
  min-width: 0;
`;

const DEFAULT_TABS_DATA = {
  'technical-data': {
    id: 'technical-data',
    label: 'Technical Data',
    groups: [
      {
        id: 'group_material_info',
        title: 'Material Information',
        fields: [
          { id: 'field_family', name: 'family', label: 'Family', type: 'combobox', required: false, placeholder: 'ex) Metal', options: ['Metal', 'Plastic'] },
          { id: 'field_category', name: 'category', label: 'Category', type: 'combobox', required: false, placeholder: 'ex) Steel', options: ['Steel', 'Aluminum', 'Copper'] },
          { id: 'field_grade', name: 'grade', label: 'Grade', type: 'textbox', required: false, placeholder: 'ex) EGI-SECC', options: [] },
          { id: 'field_details', name: 'details', label: 'Details', type: 'textbox', required: false, placeholder: 'ex) M-DOI', options: [] },
          { id: 'field_spec_thickness', name: 'specThickness', label: 'Spec Thickness (mm)', type: 'textbox', required: false, placeholder: 'ex) 0.45', options: [] },
          { id: 'field_orientation', name: 'orientation', label: 'Orientation', type: 'combobox', required: false, placeholder: 'ex) MD', options: ['Unknown', 'MD', 'TD', 'DD'] },
        ],
      },
      {
        id: 'group_sample_info',
        title: 'Sample Information',
        fields: [
          { id: 'field_sample_type_id', name: 'sampleTypeId', label: 'Sample Type ID', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_density', name: 'density', label: 'Density (tonne/mm3)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_poisson_ratio', name: 'poissonRatio', label: 'Poisson Ratio', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_sales_type', name: 'salesType', label: 'Sales Type', type: 'combobox', required: false, placeholder: 'ex) Wholesale', options: ['Wholesale', 'Retail'] },
          { id: 'field_manufacturer', name: 'manufacturer', label: 'Manufacturer', type: 'combobox', required: false, placeholder: 'ex) POSCO', options: ['POSCO'] },
          { id: 'field_distributor', name: 'distributor', label: 'Distributor', type: 'combobox', required: false, placeholder: 'ex) Ajoo Steel', options: ['Ajoo Steel'] },
          { id: 'field_primary_vendor', name: 'primaryVendor', label: 'Primary Vendor', type: 'combobox', required: false, placeholder: 'ex) Sinheung', options: ['Sinheung'] },
          { id: 'field_applied_product', name: 'appliedProduct', label: 'Applied Product', type: 'combobox', required: false, placeholder: 'ex) DA_CMP', options: ['DA_CMP'] },
          { id: 'field_applied_part', name: 'appliedPart', label: 'Applied Part', type: 'combobox', required: false, placeholder: 'ex) Chassis', options: ['Chassis Rear'] },
          { id: 'field_production_date', name: 'productionDate', label: 'Production Date', type: 'datepicker', required: false, placeholder: 'ex) Select', options: [] },
        ],
      },
      {
        id: 'group_data_info',
        title: 'Data Information',
        fields: [
          { id: 'field_record_name', name: 'technicalDataRecordName', label: 'Technical Data Record Name', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_data_id', name: 'technicalDataId', label: 'Technical Data ID', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
        ],
      },
    ],
  },
  'tensile-test': {
    id: 'tensile-test',
    label: 'Tensile Test',
    groups: [
      {
        id: 'group_test_condition',
        title: 'Test Condition',
        fields: [
          { id: 'field_test_instance_name', name: 'testInstanceName', label: 'Test Instance Name', type: 'textbox', required: true, placeholder: 'ex) Tensile Test #1', options: [] },
          { id: 'field_specimen_number', name: 'specimenNumber', label: 'Specimen Number', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_testing_group', name: 'testingGroup', label: 'Testing Group', type: 'combobox', required: false, placeholder: '', options: ['MechaGroup(VD)'] },
          { id: 'field_rundate', name: 'rundate', label: 'rundate', type: 'datepicker', required: false, placeholder: '', options: [] },
          { id: 'field_instrument_name', name: 'instrumentName', label: 'Instrument name', type: 'combobox', required: false, placeholder: 'ex) ZWICK 250kN', options: ['ZWICK 250kN'] },
          { id: 'field_operator', name: 'operator', label: 'Operator', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_sensor_type', name: 'sensorType', label: 'Sensor Type', type: 'combobox', required: false, placeholder: 'ex) 50kN', options: ['50kN'] },
          { id: 'field_specimen_standard', name: 'specimenStandard', label: 'Specimen Standard', type: 'combobox', required: false, placeholder: 'ex) ASTM D638 Type1', options: ['ASTM D638 Type1'] },
          { id: 'field_tensile_speed_elastic', name: 'tensileSpeedElastic', label: 'Tensile Speed for Elastic Region (mm/min)', type: 'textbox', required: false, placeholder: 'ex) 1.0', options: [] },
          { id: 'field_tensile_speed_plastic', name: 'tensileSpeedPlastic', label: 'Tensile Speed for Plastic Region (mm/min)', type: 'textbox', required: false, placeholder: 'ex) 2.0', options: [] },
          { id: 'field_preload', name: 'preload', label: 'Preload (N)', type: 'textbox', required: false, placeholder: 'ex) 2.0', options: [] },
          { id: 'field_specimen_real_thickness', name: 'specimenRealThickness', label: 'Specimen Real Thickness (mm)', type: 'textbox', required: false, placeholder: 'ex) 0.448', options: [] },
          { id: 'field_specimen_real_width', name: 'specimenRealWidth', label: 'Specimen Real Width (mm)', type: 'textbox', required: false, placeholder: 'ex) 24.998', options: [] },
          { id: 'field_gauge_length', name: 'gaugeLength', label: 'Gauge Length (mm)', type: 'textbox', required: false, placeholder: 'ex) 50.000', options: [] },
        ],
      },
      {
        id: 'group_test_result',
        title: 'Test Result',
        fields: [
          { id: 'field_strain_at_break', name: 'strainAtBreak', label: 'Strain (plastic) at break (%)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_yield_strain', name: 'yieldStrain', label: 'Yield strain', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_strain_at_fmax', name: 'strainAtFmax', label: 'Strain (plastic) at Fmax (%)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_work_hardening_k', name: 'workHardeningK', label: 'Work hardening coefficient k (MPa)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_work_hardening_n', name: 'workHardeningN', label: 'Work hardening exponent n', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_vertical_anisotropy', name: 'verticalAnisotropy', label: 'Vertical anisotropy r', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_upper_yield_point', name: 'upperYieldPoint', label: 'Upper yield point', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_lower_yield_point', name: 'lowerYieldPoint', label: 'Lower yield point', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_force_maximum', name: 'forceMaximum', label: 'Force maximum (MPa)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_force_proof_stress', name: 'forceProofStress', label: 'Force at proof stress 0.2% (MPa)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_specimen_thickness_a0', name: 'specimenThicknessA0', label: 'Specimen thickness a0 (mm)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_specimen_width_b0', name: 'specimenWidthB0', label: 'Specimen width b0 (mm)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
        ],
      },
      {
        id: 'group_tensile_data_info',
        title: 'Data Information',
        fields: [
          { id: 'field_tensile_sample_type_id', name: 'tensileSampleTypeId', label: 'Sample Type ID', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_tensile_record_name', name: 'tensileTestDataRecordName', label: 'Tensile Test Data Record Name', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_tensile_data_id', name: 'tensileDataId', label: 'Tensile Data ID', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
        ],
      },
    ],
  },
  'dma-strain-sweep': {
    id: 'dma-strain-sweep',
    label: 'DMA Test (Strain Sweep)',
    groups: [
      {
        id: 'group_dma_ss_test_condition',
        title: 'Test Condition',
        fields: [
          { id: 'field_dma_ss_instance_name', name: 'testInstanceName', label: 'Test Instance Name', type: 'textbox', required: true, placeholder: 'ex) DMA Strain Sweep #1', options: [] },
          { id: 'field_dma_ss_specimen_number', name: 'dmaSSSpecimenNumber', label: 'Specimen Number', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_preload_force', name: 'dmaSSPreloadForce', label: 'Initial/preload force (N)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_force_track', name: 'dmaSSForceTrack', label: 'Use Force Track (%)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_cond_temp_method', name: 'dmaSSCondTempMethod', label: 'Conditioning Temperature Method', type: 'combobox', required: false, placeholder: 'Select Method', options: ['Equilibrium', 'Initial', 'Jump'] },
          { id: 'field_dma_ss_cond_temp', name: 'dmaSSCondTemp', label: 'Conditioning Temperature (°C)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_cond_soak_time', name: 'dmaSSCondSoakTime', label: 'Conditioning Temperature Soak time (s)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_osc_frequency', name: 'dmaSSoscFrequency', label: 'Oscillation Frequency (Hz)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_sweep_mode', name: 'dmaSSSweepMode', label: 'Oscillation Sweep Mode', type: 'combobox', required: false, placeholder: 'Select Sweep Mode', options: ['Logarithmic', 'Linear', 'Discrete'] },
          { id: 'field_dma_ss_initial_strain', name: 'dmaSSInitialStrain', label: 'Oscillation Sweep Initial Strain (%)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_end_strain', name: 'dmaSSEndStrain', label: 'Oscillation Sweep End Strain (%)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_strain_increment', name: 'dmaSSStrainIncrement', label: 'Oscillation Sweep Strain Increment (%)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_num_sweeps', name: 'dmaSSNumSweeps', label: 'Oscillation Sweep Number of Sweeps', type: 'textbox', required: false, placeholder: '', options: [] },
        ],
      },
      {
        id: 'group_dma_ss_test_result',
        title: 'Test Result',
        fields: [
          { id: 'field_dma_ss_rundate', name: 'dmaSSRundate', label: 'rundate', type: 'datepicker', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ss_instrument', name: 'dmaSSInstrument', label: 'Instrument name', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ss_instrument_location', name: 'dmaSSInstrumentLocation', label: 'Instrument location', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ss_operator', name: 'dmaSSOperator', label: 'Operator', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ss_sample_name', name: 'dmaSSSampleName', label: 'Sample name', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ss_geometry', name: 'dmaSSGeometry', label: 'Geometry name', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ss_procedure', name: 'dmaSSProcedure', label: 'Procedure name', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ss_segments', name: 'dmaSSSegments', label: 'proceduresegments', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ss_length', name: 'dmaSSLength', label: 'Length (mm)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ss_width', name: 'dmaSSWidth', label: 'Width (mm)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ss_thickness', name: 'dmaSSThickness', label: 'Thickness (mm)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
        ],
      },
      {
        id: 'group_dma_ss_data_info',
        title: 'Data Information',
        fields: [
          { id: 'field_dma_ss_tech_record_name', name: 'dmaSSTechRecordName', label: 'Technical Data Record Name', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_tech_data_id', name: 'dmaSSTechDataId', label: 'Technical Data ID', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_sample_type_id', name: 'dmaSSSampleTypeId', label: 'Sample Type ID', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_record_name', name: 'dmaSSRecordName', label: 'DMA Strain Sweep Data Record Name', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ss_data_id', name: 'dmaSSDataId', label: 'DMA Strain Sweep Data ID', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
        ],
      },
    ],
  },
  'dma-freq-temp-sweep': {
    id: 'dma-freq-temp-sweep',
    label: 'DMA Test (Frequency-Temperature Sweep)',
    groups: [
      {
        id: 'group_dma_ft_test_condition',
        title: 'Test Condition',
        fields: [
          { id: 'field_dma_ft_instance_name', name: 'testInstanceName', label: 'Test Instance Name', type: 'textbox', required: true, placeholder: 'ex) DMA Freq-Temp #1', options: [] },
          { id: 'field_dma_ft_specimen_number', name: 'dmaFTSpecimenNumber', label: 'Specimen Number', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_preload_force', name: 'dmaFTPreloadForce', label: 'Initial/preload force (N)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_force_track', name: 'dmaFTForceTrack', label: 'Use Force Track (%)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_temp_sweep_strain', name: 'dmaFTTempSweepStrain', label: 'Oscillation Temperature Sweep, Strain (%)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_temp_sweep_from', name: 'dmaFTTempSweepFrom', label: 'Oscillation Temperature Sweep, Sweep from (°C)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_temp_sweep_to', name: 'dmaFTTempSweepTo', label: 'Oscillation Temperature Sweep, Sweep to (°C)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_temp_increment', name: 'dmaFTTempIncrement', label: 'Oscillation Temperature Sweep, Temperature increment (°C)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_soak_time', name: 'dmaFTSoakTime', label: 'Oscillation Temperature Sweep, Soak time (s)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_sweep_mode', name: 'dmaFTSweepMode', label: 'Oscillation Temperature Sweep Mode', type: 'combobox', required: false, placeholder: 'Select Sweep Mode', options: ['Logarithmic', 'Linear', 'Discrete'] },
          { id: 'field_dma_ft_cond_temp_method', name: 'dmaFTCondTempMethod', label: 'Conditioning Temperature Method', type: 'combobox', required: false, placeholder: 'Select Method', options: ['Equilibrium', 'Initial', 'Jump'] },
          { id: 'field_dma_ft_cond_temp', name: 'dmaFTCondTemp', label: 'Conditioning Temperature (°C)', type: 'textbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_cond_soak_time', name: 'dmaFTCondSoakTime', label: 'Conditioning Temperature Soak time (s)', type: 'textbox', required: false, placeholder: '', options: [] },
        ],
      },
      {
        id: 'group_dma_ft_test_result',
        title: 'Test Result',
        fields: [
          { id: 'field_dma_ft_rundate', name: 'dmaFTRundate', label: 'rundate', type: 'datepicker', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ft_instrument', name: 'dmaFTInstrument', label: 'Instrument name', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ft_instrument_location', name: 'dmaFTInstrumentLocation', label: 'Instrument location', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ft_operator', name: 'dmaFTOperator', label: 'Operator', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ft_sample_name', name: 'dmaFTSampleName', label: 'Sample name', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ft_geometry', name: 'dmaFTGeometry', label: 'Geometry name', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ft_procedure', name: 'dmaFTProcedure', label: 'Procedure name', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ft_segments', name: 'dmaFTSegments', label: 'proceduresegments', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ft_length', name: 'dmaFTLength', label: 'Length (mm)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ft_width', name: 'dmaFTWidth', label: 'Width (mm)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
          { id: 'field_dma_ft_thickness', name: 'dmaFTThickness', label: 'Thickness (mm)', type: 'textbox', required: false, placeholder: 'Enter Value Automatically', options: [] },
        ],
      },
      {
        id: 'group_dma_ft_data_info',
        title: 'Data Information',
        fields: [
          { id: 'field_dma_ft_tech_record_name', name: 'dmaFTTechRecordName', label: 'Technical Data Record Name', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_tech_data_id', name: 'dmaFTTechDataId', label: 'Technical Data ID', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_sample_type_id', name: 'dmaFTSampleTypeId', label: 'Sample Type ID', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_record_name', name: 'dmaFTRecordName', label: 'DMA Freq-Temp Sweep Data Record Name', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
          { id: 'field_dma_ft_data_id', name: 'dmaFTDataId', label: 'DMA Freq-Temp Sweep Data ID', type: 'generatedtextbox', required: false, placeholder: '', options: [] },
        ],
      },
    ],
  },
};

const DEFAULT_TAB_ORDER = ['technical-data', 'tensile-test', 'dma-strain-sweep', 'dma-freq-temp-sweep'];

const CompanyMaterialCouncilApp = ({ onGoHome }) => {
  // 뷰 모드: 'dashboard' | 'data-management'
  const [viewMode, setViewMode] = useState('data-management');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [isBulkAddTestModalOpen, setIsBulkAddTestModalOpen] = useState(false);
  const [bulkAddTestMaterialId, setBulkAddTestMaterialId] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tabsData, setTabsData] = useState(DEFAULT_TABS_DATA);
  const [tabOrder, setTabOrder] = useState(DEFAULT_TAB_ORDER);

  // Material 데이터 상태
  const [materials, setMaterials] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedMaterialIds, setCheckedMaterialIds] = useState([]);

  // Test Method 상태
  const [testMethods, setTestMethods] = useState([]);
  const [isTestMethodModalOpen, setIsTestMethodModalOpen] = useState(false);
  const [testMethodModalMode, setTestMethodModalMode] = useState('add'); // 'add' | 'edit' | 'view'
  const [selectedTestMethod, setSelectedTestMethod] = useState(null);

  // 모달 모드 (material: Material 추가/수정, test: 테스트 추가/수정)
  const [modalMode, setModalMode] = useState({
    type: 'material',       // 'material' | 'test'
    action: 'add',          // 'add' | 'edit'
    materialId: null,
    testType: null,
    testId: null,
    initialData: null,
  });

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);

  // 초기 데이터 로딩
  const loadInitialData = useCallback(async () => {
    try {
      // 설정 로딩
      const settings = await materialCouncilApi.getSettings();
      if (settings && settings.tabsData && settings.tabOrder) {
        setTabsData(settings.tabsData);
        setTabOrder(settings.tabOrder);
      }

      // Materials 로딩
      const materialsData = await materialCouncilApi.getMaterials();
      setMaterials(materialsData);

      // 첫 번째 Material 선택
      if (materialsData.length > 0) {
        setSelectedMaterialId(materialsData[0].id);
      }

      // Test Methods 로딩
      const testMethodsData = await materialCouncilApi.getTestMethods();
      setTestMethods(testMethodsData);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleAddData = () => {
    setModalMode({
      type: 'material',
      action: 'add',
      materialId: null,
      testType: null,
      testId: null,
      initialData: null,
    });
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleSettings = () => {
    setIsSettingsModalOpen(true);
  };

  const handleCloseSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  // Test Method 핸들러
  const handleAddTestMethod = () => {
    setTestMethodModalMode('add');
    setSelectedTestMethod(null);
    setIsTestMethodModalOpen(true);
  };

  const handleViewTestMethod = (method) => {
    setTestMethodModalMode('view');
    setSelectedTestMethod(method);
    setIsTestMethodModalOpen(true);
  };

  const handleEditTestMethod = (method) => {
    setTestMethodModalMode('edit');
    setSelectedTestMethod(method);
    setIsTestMethodModalOpen(true);
  };

  const handleDeleteTestMethod = async (methodId) => {
    if (window.confirm('정말 이 시험 방법을 삭제하시겠습니까?')) {
      try {
        await materialCouncilApi.deleteTestMethod(methodId);
        setTestMethods(prev => prev.filter(m => m.id !== methodId));
      } catch (error) {
        console.error('Failed to delete test method:', error);
        alert('시험 방법 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleSaveTestMethod = async (data) => {
    try {
      if (testMethodModalMode === 'add') {
        const created = await materialCouncilApi.createTestMethod(data);
        setTestMethods(prev => [created, ...prev]);
      } else if (testMethodModalMode === 'edit') {
        const updated = await materialCouncilApi.updateTestMethod(data.id, data);
        setTestMethods(prev => prev.map(m => m.id === data.id ? updated : m));
      }
      setIsTestMethodModalOpen(false);
    } catch (error) {
      console.error('Failed to save test method:', error);
      alert('시험 방법 저장 중 오류가 발생했습니다.');
    }
  };

  const handleCloseTestMethodModal = () => {
    setIsTestMethodModalOpen(false);
    setSelectedTestMethod(null);
  };

  const handleBulkAdd = () => {
    setIsBulkAddModalOpen(true);
  };

  const handleCloseBulkAddModal = () => {
    setIsBulkAddModalOpen(false);
  };

  const handleBulkAddApply = async (dataList) => {
    try {
      // API를 통해 여러 Material을 한 번에 추가
      const createdMaterials = await materialCouncilApi.bulkCreateMaterials(dataList);

      // 상태 업데이트 (서버에서 반환된 데이터 사용)
      setMaterials(prev => [...prev, ...createdMaterials.map(m => ({ ...m, tests: {} }))]);
      setIsBulkAddModalOpen(false);

      // 마지막으로 추가된 Material 선택
      if (createdMaterials.length > 0) {
        setSelectedMaterialId(createdMaterials[createdMaterials.length - 1].id);
      }

      alert(`${createdMaterials.length}개의 Material이 추가되었습니다.`);
    } catch (error) {
      console.error('Failed to bulk add materials:', error);
      alert('Material 추가 중 오류가 발생했습니다.');
    }
  };

  // JSON 내보내기
  const handleExportJson = () => {
    if (materials.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tabsData: tabsData,
      tabOrder: tabOrder,
      materials: materials,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `material-council-data_${todayLocalYmd()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(`${materials.length}개의 Material 데이터를 내보냈습니다.`);
  };

  // JSON 가져오기
  const handleImportJson = (file) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const importData = JSON.parse(e.target.result);

        // 버전 확인
        if (!importData.version) {
          alert('올바른 형식의 JSON 파일이 아닙니다.');
          return;
        }

        // 기존 데이터 병합 여부 확인
        const shouldMerge = materials.length > 0 &&
          window.confirm(
            `현재 ${materials.length}개의 Material이 있습니다.\n` +
            `가져오기할 데이터: ${importData.materials?.length || 0}개\n\n` +
            `기존 데이터에 추가하시겠습니까?\n` +
            `[확인] 기존 데이터 유지 + 추가\n` +
            `[취소] 기존 데이터 삭제 후 교체`
          );

        if (importData.materials && importData.materials.length > 0) {
          const importCount = importData.materials.length;

          if (shouldMerge) {
            // 기존 데이터에 추가 - 각 Material과 테스트를 API로 저장
            const createdMaterials = [];
            for (const m of importData.materials) {
              // Material 생성
              const createdMaterial = await materialCouncilApi.createMaterial(m.data || {});

              // 테스트가 있으면 추가
              if (m.tests && Object.keys(m.tests).length > 0) {
                for (const [testType, tests] of Object.entries(m.tests)) {
                  if (tests && tests.length > 0) {
                    const testsData = tests.map(t => t.data || {});
                    const createdTests = await materialCouncilApi.bulkCreateTests(createdMaterial.id, testType, testsData);
                    createdMaterial.tests = createdMaterial.tests || {};
                    createdMaterial.tests[testType] = createdTests;
                  }
                }
              } else {
                createdMaterial.tests = {};
              }

              createdMaterials.push(createdMaterial);
            }

            setMaterials(prev => [...prev, ...createdMaterials]);
            alert(`${importCount}개의 Material이 추가되었습니다.`);
          } else {
            // 기존 데이터 교체 - 먼저 기존 데이터 삭제 후 새로 생성
            // 기존 Materials 삭제
            for (const m of materials) {
              await materialCouncilApi.deleteMaterial(m.id);
            }

            // 새 Materials 생성
            const createdMaterials = [];
            for (const m of importData.materials) {
              const createdMaterial = await materialCouncilApi.createMaterial(m.data || {});

              // 테스트가 있으면 추가
              if (m.tests && Object.keys(m.tests).length > 0) {
                for (const [testType, tests] of Object.entries(m.tests)) {
                  if (tests && tests.length > 0) {
                    const testsData = tests.map(t => t.data || {});
                    const createdTests = await materialCouncilApi.bulkCreateTests(createdMaterial.id, testType, testsData);
                    createdMaterial.tests = createdMaterial.tests || {};
                    createdMaterial.tests[testType] = createdTests;
                  }
                }
              } else {
                createdMaterial.tests = {};
              }

              createdMaterials.push(createdMaterial);
            }

            setMaterials(createdMaterials);
            setSelectedMaterialId(null);
            setCheckedMaterialIds([]);
            alert(`${importCount}개의 Material 데이터로 교체되었습니다.`);
          }

          // 설정 데이터도 가져오기 (선택)
          if (importData.tabsData) {
            const shouldImportSettings = window.confirm(
              '탭 설정 데이터도 가져오시겠습니까?'
            );
            if (shouldImportSettings) {
              await materialCouncilApi.saveSettings(importData.tabsData, importData.tabOrder || tabOrder);
              setTabsData(importData.tabsData);
              if (importData.tabOrder) {
                setTabOrder(importData.tabOrder);
              }
            }
          }
        } else {
          alert('가져올 Material 데이터가 없습니다.');
        }
      } catch (error) {
        console.error('JSON 가져오기 오류:', error);
        alert('JSON 파일을 읽는 중 오류가 발생했습니다.');
      }
    };

    reader.onerror = () => {
      alert('파일을 읽는 중 오류가 발생했습니다.');
    };

    reader.readAsText(file, 'utf-8');
  };

  const handleSaveTabsData = async (newTabsData, newTabOrder) => {
    try {
      await materialCouncilApi.saveSettings(newTabsData, newTabOrder);
      setTabsData(newTabsData);
      if (newTabOrder) {
        setTabOrder(newTabOrder);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('설정 저장 중 오류가 발생했습니다.');
    }
  };

  const handleSubmitData = async (tabId, data) => {
    try {
      if (tabId === 'technical-data') {
        if (modalMode.action === 'edit' && modalMode.materialId) {
          // Material 수정
          const updatedMaterial = await materialCouncilApi.updateMaterial(modalMode.materialId, data);
          setMaterials(prev => prev.map(material => {
            if (material.id === modalMode.materialId) {
              return { ...material, data: updatedMaterial.data };
            }
            return material;
          }));
        } else {
          // Material 추가
          const newMaterial = await materialCouncilApi.createMaterial(data);
          setMaterials(prev => [...prev, { ...newMaterial, tests: {} }]);
          setSelectedMaterialId(newMaterial.id);
        }
      } else {
        const materialId = modalMode.materialId;
        if (!materialId) return;

        if (modalMode.action === 'edit' && modalMode.testId) {
          // 테스트 수정
          const updatedTest = await materialCouncilApi.updateTest(modalMode.testId, data);
          setMaterials(prev => prev.map(material => {
            if (material.id === materialId) {
              return {
                ...material,
                tests: {
                  ...material.tests,
                  [tabId]: (material.tests[tabId] || []).map(test =>
                    test.id === modalMode.testId ? updatedTest : test
                  ),
                },
              };
            }
            return material;
          }));
        } else {
          // 테스트 추가
          const newTest = await materialCouncilApi.createTest(materialId, tabId, data);

          setMaterials(prev => prev.map(material => {
            if (material.id === materialId) {
              return {
                ...material,
                tests: {
                  ...material.tests,
                  [tabId]: [...(material.tests[tabId] || []), newTest],
                },
              };
            }
            return material;
          }));
        }
      }
    } catch (error) {
      console.error('Failed to save data:', error);
      alert('데이터 저장 중 오류가 발생했습니다.');
    }
  };

  const handleAddMaterial = () => {
    setModalMode({
      type: 'material',
      action: 'add',
      materialId: null,
      testType: null,
      testId: null,
      initialData: null,
    });
    setIsAddModalOpen(true);
  };

  const handleSelectMaterial = (materialId) => {
    setSelectedMaterialId(materialId);
  };

  const handleEditMaterial = (materialId) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;

    setModalMode({
      type: 'material',
      action: 'edit',
      materialId: materialId,
      testType: null,
      testId: null,
      initialData: material.data || {},
    });
    setIsAddModalOpen(true);
  };

  const handleDeleteMaterial = async (materialId) => {
    if (window.confirm('정말 이 Material을 삭제하시겠습니까? 연결된 모든 테스트도 함께 삭제됩니다.')) {
      try {
        await materialCouncilApi.deleteMaterial(materialId);
        setMaterials(prev => prev.filter(m => m.id !== materialId));
        if (selectedMaterialId === materialId) {
          setSelectedMaterialId(null);
        }
        // 체크 목록에서도 제거
        setCheckedMaterialIds(prev => prev.filter(id => id !== materialId));
      } catch (error) {
        console.error('Failed to delete material:', error);
        alert('Material 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleDeleteSelectedMaterials = async () => {
    if (checkedMaterialIds.length === 0) return;

    const count = checkedMaterialIds.length;
    if (window.confirm(`선택한 ${count}개의 Material을 삭제하시겠습니까?\n연결된 모든 테스트도 함께 삭제됩니다.`)) {
      try {
        // 모든 선택된 Material 삭제
        await Promise.all(checkedMaterialIds.map(id => materialCouncilApi.deleteMaterial(id)));

        setMaterials(prev => prev.filter(m => !checkedMaterialIds.includes(m.id)));

        // 선택된 Material이 삭제 대상에 포함되면 선택 해제
        if (checkedMaterialIds.includes(selectedMaterialId)) {
          setSelectedMaterialId(null);
        }

        // 체크 목록 초기화
        setCheckedMaterialIds([]);
      } catch (error) {
        console.error('Failed to delete materials:', error);
        alert('Material 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleBulkAddTest = (materialId) => {
    setBulkAddTestMaterialId(materialId);
    setIsBulkAddTestModalOpen(true);
  };

  const handleCloseBulkAddTestModal = () => {
    setIsBulkAddTestModalOpen(false);
    setBulkAddTestMaterialId(null);
  };

  const handleBulkAddTestApply = async (testType, dataList, materialId) => {
    try {
      // 파일 파싱 및 테스트 데이터 생성
      const testsData = [];

      for (let i = 0; i < dataList.length; i++) {
        const item = dataList[i];
        let testData = { ...item };
        const uploadedFile = item.file;
        delete testData.file;

        // 파일이 있으면 파싱 및 파일 저장
        if (uploadedFile) {
          testData.uploadedFileName = uploadedFile.name;
          testData.uploadedFileType = uploadedFile.type || (uploadedFile.name.endsWith('.csv') ? 'text/csv' : 'application/octet-stream');

          try {
            // 파일 내용을 Base64로 저장
            const fileBase64 = await readFileAsBase64(uploadedFile);
            testData.uploadedFileData = fileBase64;

            const fileContent = await readFileContent(uploadedFile, testType);

            if (testType === 'tensile-test') {
              const parsed = parseTraFile(fileContent);
              testData = { ...testData, ...parsed.formData };
              if (parsed.measurementData) {
                testData.measurementData = parsed.measurementData;
              }
            } else if (testType === 'dma-strain-sweep') {
              const parsed = parseStrainSweepFile(fileContent);
              testData = { ...testData, ...parsed.formData };
              if (parsed.measurementData) {
                testData.measurementData = parsed.measurementData;
              }
            } else if (testType === 'dma-freq-temp-sweep') {
              const parsed = parseFreqTempFile(fileContent);
              testData = { ...testData, ...parsed.formData };
              if (parsed.tempSweepData) {
                testData.tempSweepData = parsed.tempSweepData;
              }
              if (parsed.shiftFactorsData) {
                testData.shiftFactorsData = parsed.shiftFactorsData;
              }
              if (parsed.masterCurveData) {
                testData.masterCurveData = parsed.masterCurveData;
              }
            }
          } catch (error) {
            console.error(`파일 파싱 오류 (${uploadedFile.name}):`, error);
          }
        }

        testsData.push(testData);
      }

      // API를 통해 테스트 일괄 추가
      const createdTests = await materialCouncilApi.bulkCreateTests(materialId, testType, testsData);

      // Material에 테스트 추가
      setMaterials(prev => prev.map(material => {
        if (material.id === materialId) {
          return {
            ...material,
            tests: {
              ...material.tests,
              [testType]: [...(material.tests[testType] || []), ...createdTests],
            },
          };
        }
        return material;
      }));

      setIsBulkAddTestModalOpen(false);
      setBulkAddTestMaterialId(null);
      alert(`${createdTests.length}개의 ${testType} 시험 데이터가 추가되었습니다.`);
    } catch (error) {
      console.error('Failed to bulk add tests:', error);
      alert('시험 데이터 추가 중 오류가 발생했습니다.');
    }
  };

  // 파일 읽기 헬퍼 (텍스트)
  const readFileContent = (file, testType) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);

      // CSV 파일은 euc-kr, tra 파일은 utf-8
      const encoding = file.name.toLowerCase().endsWith('.csv') ? 'euc-kr' : 'utf-8';
      reader.readAsText(file, encoding);
    });
  };

  // 파일 읽기 헬퍼 (Base64)
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const handleAddTest = (materialId, testType) => {
    setModalMode({
      type: 'test',
      action: 'add',
      materialId: materialId,
      testType: testType || null,
      testId: null,
      initialData: null,
    });
    setIsAddModalOpen(true);
  };

  const handleViewTest = (materialId, testType, testId) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;

    const tests = material.tests[testType] || [];
    const test = tests.find(t => t.id === testId);
    if (!test) return;

    setModalMode({
      type: 'test',
      action: 'edit',
      materialId: materialId,
      testType: testType,
      testId: testId,
      initialData: test.data || {},
    });
    setIsAddModalOpen(true);
  };

  const handleDeleteTest = async (materialId, testType, testId) => {
    if (window.confirm('정말 이 테스트를 삭제하시겠습니까?')) {
      try {
        await materialCouncilApi.deleteTest(testId);
        setMaterials(prev => prev.map(material => {
          if (material.id === materialId) {
            return {
              ...material,
              tests: {
                ...material.tests,
                [testType]: (material.tests[testType] || []).filter(t => t.id !== testId),
              },
            };
          }
          return material;
        }));
      } catch (error) {
        console.error('Failed to delete test:', error);
        alert('시험 데이터 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // 시험 데이터 JSON 내보내기
  const handleExportTests = (materialId) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;

    const testCount = Object.values(material.tests || {}).reduce((sum, tests) => sum + tests.length, 0);
    if (testCount === 0) {
      alert('내보낼 시험 데이터가 없습니다.');
      return;
    }

    const exportData = {
      version: '1.0',
      type: 'tests',
      exportedAt: new Date().toISOString(),
      materialInfo: {
        family: material.data?.family || '',
        category: material.data?.category || '',
        grade: material.data?.grade || '',
      },
      tests: material.tests,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const materialName = [
      material.data?.family,
      material.data?.category,
      material.data?.grade
    ].filter(Boolean).join('_') || 'material';

    const link = document.createElement('a');
    link.href = url;
    link.download = `tests_${materialName}_${todayLocalYmd()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(`${testCount}개의 시험 데이터를 내보냈습니다.`);
  };

  // 시험 데이터 JSON 가져오기
  const handleImportTests = (materialId, file) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const importData = JSON.parse(e.target.result);

        // 버전/타입 확인
        if (!importData.version || importData.type !== 'tests') {
          alert('올바른 시험 데이터 JSON 파일이 아닙니다.');
          return;
        }

        if (!importData.tests || Object.keys(importData.tests).length === 0) {
          alert('가져올 시험 데이터가 없습니다.');
          return;
        }

        const testCount = Object.values(importData.tests).reduce((sum, tests) => sum + tests.length, 0);

        // 기존 테스트 병합 여부 확인
        const material = materials.find(m => m.id === materialId);
        const existingTestCount = Object.values(material?.tests || {}).reduce((sum, tests) => sum + tests.length, 0);

        const shouldMerge = existingTestCount > 0 &&
          window.confirm(
            `현재 ${existingTestCount}개의 시험 데이터가 있습니다.\n` +
            `가져오기할 데이터: ${testCount}개\n\n` +
            `기존 데이터에 추가하시겠습니까?\n` +
            `[확인] 기존 데이터 유지 + 추가\n` +
            `[취소] 기존 데이터 삭제 후 교체`
          );

        if (shouldMerge) {
          // 기존 데이터에 추가 - 각 testType별로 bulkCreateTests 호출
          for (const [testType, tests] of Object.entries(importData.tests)) {
            const testsData = tests.map(t => t.data || {});
            const createdTests = await materialCouncilApi.bulkCreateTests(materialId, testType, testsData);

            setMaterials(prev => prev.map(m => {
              if (m.id === materialId) {
                return {
                  ...m,
                  tests: {
                    ...m.tests,
                    [testType]: [...(m.tests[testType] || []), ...createdTests],
                  },
                };
              }
              return m;
            }));
          }
        } else {
          // 기존 데이터 교체 - replaceTests API 사용
          const testsToReplace = {};
          Object.entries(importData.tests).forEach(([testType, tests]) => {
            testsToReplace[testType] = tests.map(t => ({ data: t.data || {} }));
          });

          const newTests = await materialCouncilApi.replaceTests(materialId, testsToReplace);

          setMaterials(prev => prev.map(m => {
            if (m.id === materialId) {
              return { ...m, tests: newTests };
            }
            return m;
          }));
        }

        alert(`${testCount}개의 시험 데이터를 ${shouldMerge ? '추가' : '가져오기'}했습니다.`);
      } catch (error) {
        console.error('JSON 가져오기 오류:', error);
        alert('JSON 파일을 읽는 중 오류가 발생했습니다.');
      }
    };

    reader.onerror = () => {
      alert('파일을 읽는 중 오류가 발생했습니다.');
    };

    reader.readAsText(file, 'utf-8');
  };

  // AddDataModal에서 사용할 탭 필터링
  const getModalTabsData = () => {
    if (modalMode.type === 'material') {
      // Material 추가 시: technical-data 탭만
      return {
        'technical-data': tabsData['technical-data'],
      };
    } else {
      // 테스트 추가 시: technical-data 제외한 나머지
      const filtered = {};
      tabOrder.forEach(tabId => {
        if (tabId !== 'technical-data') {
          filtered[tabId] = tabsData[tabId];
        }
      });
      return filtered;
    }
  };

  const getModalTabOrder = () => {
    if (modalMode.type === 'material') {
      return ['technical-data'];
    } else {
      return tabOrder.filter(id => id !== 'technical-data');
    }
  };

  const getModalTitle = () => {
    const isEdit = modalMode.action === 'edit';
    if (modalMode.type === 'material') {
      return isEdit ? 'Material 수정' : 'Material 추가';
    } else {
      return isEdit ? '테스트 수정' : '테스트 추가';
    }
  };

  // 대시보드 콘텐츠 렌더링
  const renderDashboardContent = () => (
    <MaterialDashboard
      materials={materials}
      tabsData={tabsData}
    />
  );

  // 시험 방법 콘텐츠 렌더링
  const renderTestMethodsContent = () => (
    <TestMethodsView
      testMethods={testMethods}
      onView={handleViewTestMethod}
      onEdit={handleEditTestMethod}
      onDelete={handleDeleteTestMethod}
    />
  );

  // 데이터 관리 콘텐츠 렌더링
  const renderDataManagementContent = () => (
    <Content>
      <ListPanelWrapper>
        <MaterialListPanel
          materials={materials}
          selectedMaterialId={selectedMaterialId}
          onSelectMaterial={handleSelectMaterial}
          onAddMaterial={handleAddMaterial}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          checkedIds={checkedMaterialIds}
          onCheckedIdsChange={setCheckedMaterialIds}
          onDeleteSelected={handleDeleteSelectedMaterials}
        />
      </ListPanelWrapper>
      <DetailPanelWrapper>
        <MaterialDetailPanel
          material={selectedMaterial}
          tabsData={tabsData}
          tabOrder={tabOrder}
          onEditMaterial={handleEditMaterial}
          onDeleteMaterial={handleDeleteMaterial}
          onAddTest={handleAddTest}
          onBulkAddTest={handleBulkAddTest}
          onViewTest={handleViewTest}
          onDeleteTest={handleDeleteTest}
          onExportTests={handleExportTests}
          onImportTests={handleImportTests}
        />
      </DetailPanelWrapper>
    </Content>
  );

  return (
    <Container>
      <Header
        onGoHome={onGoHome}
        onAddData={handleAddData}
        onBulkAdd={handleBulkAdd}
        onSettings={handleSettings}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddTestMethod={handleAddTestMethod}
      />
      {viewMode === 'dashboard' && renderDashboardContent()}
      {viewMode === 'data-management' && renderDataManagementContent()}
      {viewMode === 'test-methods' && renderTestMethodsContent()}
      <AddDataModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmitData}
        tabsData={getModalTabsData()}
        tabOrder={getModalTabOrder()}
        title={getModalTitle()}
        defaultTab={modalMode.testType}
        initialData={modalMode.initialData}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
        tabsData={tabsData}
        tabOrder={tabOrder}
        onSave={handleSaveTabsData}
      />
      <BulkAddMaterialModal
        isOpen={isBulkAddModalOpen}
        onClose={handleCloseBulkAddModal}
        onApply={handleBulkAddApply}
        tabsData={tabsData}
        existingMaterials={materials.map(m => m.data)}
      />
      <BulkAddTestModal
        isOpen={isBulkAddTestModalOpen}
        onClose={handleCloseBulkAddTestModal}
        onApply={handleBulkAddTestApply}
        tabsData={tabsData}
        materialId={bulkAddTestMaterialId}
      />
      <TestMethodModal
        isOpen={isTestMethodModalOpen}
        onClose={handleCloseTestMethodModal}
        onSave={handleSaveTestMethod}
        initialData={selectedTestMethod}
        mode={testMethodModalMode}
      />
    </Container>
  );
};

export default CompanyMaterialCouncilApp;
