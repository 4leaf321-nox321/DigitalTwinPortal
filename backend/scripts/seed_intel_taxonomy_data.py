# -*- coding: utf-8 -*-
"""디지털 트윈 기술 분류 — **역량과 도구를 처음부터 다시 나눈다** (개발 DB).

⚠️⚠️ 이 파일이 하는 일은 **표를 새로 만드는 것이 아니다.** 이미 있는 도구 116개는
   uuid 그대로 두고 **부모만 바꾼다** — uuid 가 바뀌면 그 도구에 걸린 근거 소식과
   사업부의 「무엇으로 하나」가 통째로 끊긴다.

⚠️ 역량은 이름으로 맞춘다. 없으면 만들고, 있으면 부채꼴ㆍ요약ㆍCPT 를 고쳐 쓴다.
   쓰이지 않게 된 옛 역량은 **자식을 떼어 낸 뒤** 지운다(서비스가 그렇게 한다).

각 줄: (역량, 부채꼴, 한 줄 요약, [CPT…], [얽힌 갈래…], [도구…])
    CPT = Digital Twin Consortium Capabilities Periodic Table v1.1 여섯 묶음
          Data Services · Integration · Intelligence · User Experience ·
          Management · Trustworthiness
"""

SIM = '시뮬레이션·해석'
TRUST = '모델 신뢰·운영'
DATA = '데이터·연결'
AI = 'AI'
PLAT = '플랫폼'
STD = '표준화'

DS, IN, IQ, UX, MG, TW = ('Data Services', 'Integration', 'Intelligence',
                          'User Experience', 'Management', 'Trustworthiness')

TAXONOMY = [
    # ── 시뮬레이션·해석 — **무엇을 푸나** ────────────────────────────────────
    # ⚠️ 「전부 넣어 달라」는 요청대로 물리 도메인을 빠짐없이 편다. 이 부채꼴이
    #    가장 큰 것이 이 회사의 실상이다 — 억지로 줄이면 그림만 예뻐지고 답이 는다.
    ('구조 해석', SIM, '하중을 받는 구조가 얼마나 변형되고 언제 버티지 못하는지 푼다. 선형ㆍ비선형 정적.',
     [IQ], ['FEA', '구조'],
     ['Ansys Mechanical', 'Abaqus', 'Altair OptiStruct', 'MSC Nastran',
      'Simcenter 3D']),
    ('동역학ㆍ진동 해석', SIM, '움직이는 구조의 고유진동ㆍ과도응답ㆍ랜덤 진동을 푼다.',
     [IQ], ['동역학', '진동'],
     ['MSC Adams', 'Simpack', 'Ansys Motion', 'RecurDyn']),
    ('충돌ㆍ고속 비선형 해석', SIM, '짧은 시간에 크게 변형되는 현상(충돌ㆍ낙하ㆍ성형)을 푼다. explicit.',
     [IQ], ['충돌', '비선형'],
     ['LS-DYNA', 'Altair Radioss', 'PAM-CRASH', 'Abaqus/Explicit']),
    ('피로ㆍ파손 해석', SIM, '반복 하중으로 언제 균열이 생기고 얼마나 버티는지 푼다.',
     [IQ, TW], ['피로', '수명'],
     ['nCode DesignLife', 'FEMFAT', 'Simcenter Tecware', 'fe-safe']),
    ('유동 해석 (CFD)', SIM, '유체의 흐름ㆍ압력ㆍ열전달을 푼다.',
     [IQ], ['CFD', '유동'],
     ['Ansys Fluent', 'OpenFOAM', 'Simcenter STAR-CCM+', 'Ansys CFX', 'Cadence Fidelity']),
    ('열ㆍ열관리 해석', SIM, '발열과 방열 — 제품이 얼마나 뜨거워지고 어떻게 식힐지 푼다.',
     [IQ], ['열', '방열'],
     ['Ansys Icepak', 'Simcenter Flotherm', '6SigmaET', 'Ansys Thermal']),
    ('음향ㆍNVH 해석', SIM, '소음ㆍ진동ㆍ음질. 사람이 듣고 느끼는 것을 푼다.',
     [IQ, UX], ['음향', 'NVH'],
     ['Simcenter 3D Acoustics', 'Actran', 'Ansys VRXPERIENCE Sound', 'wave6']),
    ('전자기ㆍEMC 해석', SIM, '안테나ㆍ전자파 간섭ㆍ차폐를 푼다.',
     [IQ], ['전자기', 'EMC'],
     ['CST Studio Suite', 'Ansys HFSS', 'Altair Feko', 'Ansys Maxwell']),
    ('광학ㆍ조명 해석', SIM, '빛의 경로ㆍ밝기ㆍ눈에 보이는 모습을 푼다.',
     [IQ, UX], ['광학', '조명'],
     ['Ansys SPEOS', 'Zemax OpticStudio', 'LightTools', 'Ansys Lumerical']),
    ('반도체ㆍ전자 패키징 해석', SIM, '칩ㆍ패키지ㆍ기판의 열ㆍ응력ㆍ신호 무결성을 푼다.',
     [IQ], ['반도체', '패키징'],
     ['Ansys RedHawk-SC', 'Ansys SIwave', 'Simcenter Flotherm XT', 'Synopsys TCAD']),
    ('멀티피직스 연성', SIM, '서로 다른 물리를 한 모델에서 주고받게 하며 함께 푼다.',
     [IQ, IN], ['멀티피직스', '연성'],
     ['COMSOL Multiphysics', 'preCICE', 'Ansys System Coupling', 'MpCCI']),
    ('재료ㆍ분자 시뮬레이션', SIM, '재료를 원자ㆍ분자 수준에서 풀어 물성을 예측한다.',
     [IQ], ['재료', '분자'],
     ['LAMMPS', 'GROMACS', 'Materials Studio', 'VASP']),
    ('공정 성형 해석', SIM, '사출ㆍ프레스ㆍ주조 — 만들어지는 과정에서 무슨 일이 생기는지 본다.',
     [IQ], ['공정', '성형'],
     ['Moldflow', 'Moldex3D', 'AutoForm', 'MAGMASOFT', 'PAM-STAMP']),
    ('용접ㆍ접합 공정 해석', SIM, '용접 열변형ㆍ잔류응력ㆍ접합부 건전성을 미리 본다.',
     [IQ], ['용접', '잔류응력'],
     ['Simufact Welding', 'Ansys Additive & Welding', 'ESI SYSWELD']),
    ('적층제조(AM) 공정 해석', SIM, '3D 프린팅의 변형ㆍ잔류응력ㆍ지지대를 미리 본다.',
     [IQ], ['적층제조', 'AM'],
     ['Simufact Additive', 'Ansys Additive Suite', 'Altair Inspire Print3D',
      'Autodesk Netfabb']),
    ('분체ㆍ입자 거동 해석 (DEM)', SIM, '가루ㆍ알갱이가 흐르고 쌓이고 섞이는 것을 푼다.',
     [IQ], ['DEM', '분체'],
     ['Altair EDEM', 'Rocky DEM', 'LIGGGHTS']),
    ('1D 시스템 시뮬레이션', SIM, '유압ㆍ열ㆍ전기 계통을 방정식 수준으로 묶어 빠르게 푼다.',
     [IQ, IN], ['1D', '시스템'],
     ['Simcenter Amesim', 'Modelica', 'OpenModelica', 'Dymola', 'MATLAB / Simulink',
      'GT-SUITE']),
    ('제어 설계ㆍ검증 (MIL/SIL/HIL)', SIM, '제어 로직을 모델ㆍ코드ㆍ실물 단계로 올려 가며 검증한다.',
     [IQ, IN, TW], ['제어', 'HIL'],
     ['Simulink Real-Time', 'dSPACE SCALEXIO', 'NI VeriStand', 'TwinCAT 3']),
    ('이산사건 공정 시뮬레이션', SIM, '라인 물류와 처리량을 사건 단위로 검증한다.',
     [IQ], ['이산사건', '물류'],
     ['AnyLogic', 'Plant Simulation', 'FlexSim', 'Visual Components', 'Simio']),
    ('로봇 시뮬레이션', SIM, '로봇 동작ㆍ간섭ㆍ접촉을 물리적으로 재현한다.',
     [IQ], ['로봇'],
     ['Gazebo', 'Isaac Sim', 'MuJoCo', 'Process Simulate', 'RoboDK']),
    ('인체ㆍ인간공학 시뮬레이션', SIM, '사람이 닿고 보고 힘 쓰는 것을 모델로 확인한다.',
     [IQ, UX], ['인간공학', '인체'],
     ['Jack (Siemens)', 'AnyBody Modeling System', 'Santos Human',
      'OpenSim', 'THUMS 인체모델']),

    # ── 모델 신뢰·운영 — **믿고 돌리는 일** ─────────────────────────────────
    # ⚠️⚠️ 여기가 통째로 비어 있었다. 이게 없으면 「시뮬레이션」이지 「트윈」이 아니다.
    ('모델 검증ㆍ보정 (V&V)', TRUST,
     '해석이 실물과 얼마나 맞는지 재고, 안 맞으면 모델을 맞춘다. **트윈의 근간이다.**',
     [TW, IQ], ['V&V', '보정'],
     # ⚠️ ASMEㆍNAFEMS 같은 **표준은 여기 안 둔다** — 표준화 부채꼴의
     #    「해석 신뢰성 표준」이 그 자리다. 역량 밑에는 **쓰는 도구**만 둔다.
     ['FEMtools Model Updating', 'Simcenter Testlab Model Correlation',
      'Ansys Model Calibration', 'MATLAB System Identification Toolbox']),
    ('불확실성 정량화 (UQ)', TRUST, '입력이 흔들릴 때 답이 얼마나 흔들리는지 센다. 「얼마나 믿을 수 있나」.',
     [TW, IQ], ['UQ', '확률'],
     ['Ansys optiSLang UQ', 'Dakota', 'UQLab', 'Monte Carlo / LHS 샘플링']),
    ('실시간 동기화ㆍ상태 추정', TRUST,
     '실물에서 들어오는 값으로 모델의 상태를 계속 맞춘다. **트윈이 실물을 따라가게 하는 장치.**',
     [DS, IQ, IN], ['동기화', '상태추정'],
     ['칼만 필터 / EKF·UKF', '입자 필터 (Particle Filter)',
      '데이터 동화 (Data Assimilation)', '베이지안 모델 업데이팅']),
    ('축약 모델 (ROM)', TRUST, '무거운 해석 모델을 줄여 실시간으로 돌린다. 트윈이 현장 속도를 따라가게 한다.',
     [IQ, IN], ['ROM', '실시간'],
     ['Simcenter ROM / RomAI', 'Executable Digital Twin (xDT)', 'Ansys Twin Builder',
      'pyMOR', 'PGD / POD 축약']),
    ('메시ㆍ형상 준비', TRUST, '해석 전에 형상을 다듬고 격자를 만든다. **해석의 절반이 여기서 갈린다.**',
     [DS], ['메싱', '전처리'],
     ['ANSA', 'Altair HyperMesh', 'Ansys Fluent Meshing', 'cfMesh', 'Pointwise',
      'Simcenter 3D Pre/Post']),
    ('재료 물성 데이터', TRUST, '해석에 넣을 물성을 어디서 가져오고 어떻게 관리하나. 없으면 해석이 시작이 안 된다.',
     [DS, MG], ['재료', '물성'],
     ['Ansys Granta MI', 'MatWeb', 'JAHM Curve Data', '사내 물성 DB']),
    ('해석 자동화ㆍ설계 탐색', TRUST, '해석을 흐름으로 엮고 설계 변수를 자동으로 훑는다. DOEㆍ민감도.',
     [MG, IQ], ['자동화', 'DOE'],
     ['Ansys optiSLang', 'Isight / SIMULIA Process Composer', 'HEEDS', 'modeFRONTIER']),
    ('HPCㆍ계산 자원', TRUST, '해석을 어디서 얼마나 빨리 돌리나. 대기열ㆍGPUㆍ클라우드 확장.',
     [MG], ['HPC', '계산자원'],
     ['Slurm', 'Altair PBS Professional', 'Rescale', 'AWS ParallelCluster',
      'NVIDIA GPU 가속 솔버']),
    ('해석 데이터 관리 (SDM)', TRUST, '해석 모델ㆍ결과ㆍ이력을 정본으로 관리한다. PLM 과 다른 자리다.',
     [MG, DS], ['SDM', 'SPDM'],
     ['Ansys Minerva', 'Simcenter Teamcenter SDM', 'Altair SimManager',
      'SIMULIA SLM']),
    ('시험 계측 연계', TRUST, '실측과 해석을 같은 자리에서 견준다. 검증의 입력이 여기서 온다.',
     [DS, TW], ['시험', '계측'],
     ['Simcenter Testlab', 'HBK / nCode 계측', 'DEWESoft', 'NI LabVIEW']),

    # ── 데이터·연결 ─────────────────────────────────────────────────────────
    ('설비 통신', DATA, '설비에서 데이터를 꺼내 오는 길.',
     [DS, IN, TW], ['통신', '설비'],
     ['OPC UA', 'OPC UA PubSub', 'Modbus TCP', 'PROFINET', 'EtherCAT',
      'TSN (Time-Sensitive Networking)', 'KEPServerEX']),
    ('경량 메시징', DATA, '적은 대역으로 상태를 밀어 올린다.',
     [DS, IN], ['메시징'],
     ['MQTT', 'MQTT Sparkplug B', 'AMQP']),
    ('센서ㆍ계측 하드웨어', DATA, '무엇으로 재나 — 트윈에 들어오는 값의 출처.',
     [DS], ['센서'],
     ['진동 가속도계', '열화상 카메라', '광섬유 센서 (FBG)', '전류ㆍ전력 센서',
      'IO-Link 센서']),
    ('현실 캡처 (3D 스캔)', DATA, '실물 형상을 그대로 떠 온다. **as-built 트윈의 입구.**',
     [DS], ['스캔', '포인트클라우드'],
     ['지상형 LiDAR (FARO·Leica)', '사진측량 (RealityCapture)', 'NavVis 실내 매핑',
      'Autodesk ReCap', 'Gaussian Splatting']),
    ('시계열 저장', DATA, '시간축 데이터를 쌓고 빠르게 되읽는다.',
     [DS], ['시계열'],
     # ⚠️ 한때 「시계열 DB (InfluxDB · TimescaleDB)」 한 줄이었다 — **서로 다른
     #    두 제품**이라 사업부가 「무엇으로 하나」에서 하나만 고를 수가 없었다.
     ['InfluxDB', 'TimescaleDB', 'Apache IoTDB']),
    ('스트리밍 처리', DATA, '흘러오는 사건을 실시간으로 가공한다.',
     [DS, IN], ['스트리밍'],
     ['Apache Kafka', 'Apache Flink', 'Redpanda']),
    ('분석용 데이터 형식', DATA, '대용량을 싸게 저장하고 도구 사이로 옮긴다.',
     [DS], ['데이터형식'],
     ['Apache Parquet', 'Apache Arrow', 'Delta Lake', 'Apache Iceberg', 'HDF5']),
    ('트윈 상태 관리', DATA, '트윈의 현재 상태를 들고 있는 미들웨어.',
     [DS, IN], ['미들웨어'],
     ['Eclipse Ditto', 'Eclipse Hono']),
    ('수집ㆍ연결 도구', DATA, '설비와 시스템을 잇는 손쉬운 배관.',
     [IN, DS, UX], ['수집'],
     ['Node-RED', 'Telegraf', 'Apache NiFi']),
    ('클라우드 IoT', DATA, '기기 연결과 자산 모델을 클라우드에서.',
     [DS, IN, TW], ['클라우드'],
     ['AWS IoT SiteWise', 'Azure IoT Hub', 'Google Cloud IoT']),
    ('모니터링ㆍ대시보드', DATA, '지표를 모아 보고 경보한다.',
     [UX, DS, MG], ['대시보드'],
     ['Grafana', 'Prometheus', 'Apache Superset']),
    ('엣지 컴퓨팅', DATA, '설비 가까이에서 처리해 지연과 대역을 줄인다.',
     [DS, MG], ['엣지'],
     ['Edge Computing (K3s·KubeEdge)', 'AWS IoT Greengrass', 'Azure IoT Edge']),
    ('OTㆍ데이터 보안', DATA, '트윈이 현장에 닿을수록 필요해진다. 망 분리ㆍ인증ㆍ데이터 주권.',
     [TW, MG], ['보안', 'OT'],
     ['망 분리ㆍDMZ 구성', 'PKI ㆍ기기 인증', 'Eclipse Dataspace Connector',
      'Gaia-X / Catena-X 데이터 주권']),

    # ── AI ──────────────────────────────────────────────────────────────────
    ('대리모델 (Surrogate)', AI, '비싼 해석을 학습된 모델로 대신한다.',
     [IQ], ['대리모델'],
     ['PINN (물리정보 신경망)', 'NVIDIA PhysicsNeMo (구 Modulus)',
      'Fourier Neural Operator (FNO)', 'DeepONet', 'Graph Neural Simulator (GNS)',
      'DeepXDE', 'Gaussian Process 대리모델']),
    ('생성형ㆍ위상 최적화', AI, '제약 안에서 형상 자체를 만들어 낸다.',
     [IQ], ['최적화', '생성형'],
     ['생성형 설계 (Generative Design)', '위상 최적화 (Topology Optimization)',
      '베이지안 최적화', 'nTop']),
    ('예지보전', AI, '설비가 언제 어떻게 나빠지는지 미리 안다.',
     [IQ], ['예지보전'],
     ['이상 탐지 (Isolation Forest·LSTM-AE)', '잔여수명 예측 (RUL)',
      'PHM (Prognostics & Health Management)']),
    ('비전 검사', AI, '영상으로 결함을 판정한다.',
     [IQ, DS], ['비전'],
     ['머신비전 결함 검사', '합성 데이터 생성', 'Cognex VisionPro Deep Learning']),
    ('강화학습 제어', AI, '스스로 시도하며 제어 규칙을 배운다.',
     [IQ], ['강화학습'],
     ['강화학습 공정 제어', 'Isaac Lab', 'Stable-Baselines3']),
    ('LLM 활용', AI, '문서와 대화로 엔지니어링 일을 돕는다.',
     [UX, IQ, DS], ['LLM'],
     ['LLM 엔지니어링 보조', 'RAG (문서 검색 증강)', 'Claude / GPT API',
      '사내 폐쇄망 LLM']),
    ('AI 운영ㆍ신뢰 (MLOps)', AI, '모델을 관리하고 판단 근거를 설명한다.',
     [MG, IN, TW, IQ], ['MLOps', 'XAI'],
     ['MLflow', 'ONNX', '설명가능 AI (XAI)', 'Weights & Biases']),

    # ── 플랫폼 ──────────────────────────────────────────────────────────────
    ('산업 3D 플랫폼', PLAT, '여러 도구의 장면을 모아 실시간으로 돌린다.',
     [IN, UX, DS], ['3D플랫폼'],
     ['NVIDIA Omniverse', 'Omniverse DSX Blueprint', 'Hexagon Nexus']),
    ('PLM ㆍ수명주기', PLAT, '설계 데이터와 변경을 정본으로 관리한다.',
     [IN, MG, DS], ['PLM'],
     ['Teamcenter', 'Aras Innovator', 'Windchill', 'Siemens Xcelerator',
      'Dassault 3DEXPERIENCE', 'Dassault 3DEXPERIENCE Virtual Twin']),
    ('IIoT ㆍ운영 트윈 플랫폼', PLAT, '현장 데이터를 모델에 얹어 운영에 쓴다.',
     [DS, UX, IN, MG], ['IIoT'],
     ['PTC ThingWorx', 'Microsoft Azure Digital Twins', 'AWS IoT TwinMaker',
      'SAP Digital Manufacturing']),
    ('실시간 시각화ㆍXR', PLAT, '사람이 보고 만질 수 있게 그린다.',
     [UX, DS], ['XR', '시각화'],
     ['Unity Industry', 'Unreal Engine', 'Cesium', 'Varjo XR']),
    ('가상 시운전', PLAT, '설비를 짓기 전에 제어까지 붙여 돌려 본다.',
     [IQ, IN], ['가상시운전'],
     ['Rockwell Emulate3D', 'Siemens SIMIT', 'ISG-virtuos']),
    ('인프라ㆍ건물 트윈', PLAT, '건물과 대형 자산을 트윈으로.',
     [DS, UX], ['BIM', '건물'],
     ['Bentley iTwin', 'Autodesk Tandem', 'Autodesk Revit / BIM 360']),

    # ── 표준화 ──────────────────────────────────────────────────────────────
    ('3D 데이터 교환 표준', STD, '장면과 형상을 도구 사이에서 잃지 않고 옮긴다.',
     [DS, IN, UX], ['표준', '3D'],
     ['OpenUSD', 'STEP AP242', 'JT', 'glTF']),
    ('모델 교환 표준', STD, '시뮬레이션 모델을 껍데기로 주고받는다.',
     [IN, IQ], ['표준', 'FMI'],
     ['FMI / FMU', 'SSP (System Structure & Parameterization)', 'DCP']),
    ('자산ㆍ설비 정보 표준', STD, '설비 정보를 기계가 읽게 규격화한다.',
     [DS, IN, TW], ['표준', '자산'],
     ['Asset Administration Shell (AAS)',
      'AutomationML', 'MTConnect', 'QIF (Quality Information Framework)']),
    ('트윈 아키텍처 표준', STD, '트윈 시스템을 무엇으로 나눌지 정한다.',
     [MG, DS, IN], ['표준', '아키텍처'],
     ['ISO 23247', 'ISO/IEC 30173', 'DTDL', 'W3C WoT Thing Description', 'NGSI-LD',
      'ISA-95', 'Digital Twin CPT']),
    ('해석 신뢰성 표준', STD, '해석을 얼마나 믿을 수 있다고 말하려면 무엇을 지켜야 하나.',
     [TW, MG], ['표준', 'V&V'],
     ['ASME V&V 10', 'ASME V&V 20', 'ASME V&V 40 (의료기기)', 'NAFEMS 인증',
      'NASA-STD-7009', 'NAFEMS 품질 지침']),
    ('보안ㆍ신뢰성 표준', STD, '트윈이 현장에 닿을수록 필요해진다.',
     [TW], ['표준', '보안'],
     ['IEC 62443', 'ISO/IEC 27001', 'NIST CSF']),
]
"""역량마다 **더 채워 넣는 도구들**.

⚠️ 본 표(`TAXONOMY`)에 직접 이어 붙이지 않고 따로 둔다 — 63줄짜리 튜플을 손대는 것보다
   「무엇을 더 넣었나」가 한눈에 보이고, 나중에 지우거나 옮기기도 쉽다.

⚠️⚠️ **한 도구는 한 역량에만.** 같은 이름을 두 곳에 적으면 적용 스크립트가 아무것도
   건드리기 전에 멈춘다(실제로 한 번 잡혔다 — Abaqus/Explicit).
   그래서 이미 다른 역량에 있는 것은 여기 다시 안 적는다
   (예: Dakota 는 UQ 에 있으므로 해석 자동화에 또 안 적는다).
"""

EXTRA = {
    # ── 시뮬레이션·해석 ─────────────────────────────────────────────────────
    '구조 해석': ['MSC Marc', 'Altair SimSolid', 'Femap', 'MIDAS NFX',
                 'Code_Aster', 'CalculiX', 'ADINA'],
    '동역학ㆍ진동 해석': ['Simcenter 3D Motion', 'Project Chrono', 'Universal Mechanism'],
    '충돌ㆍ고속 비선형 해석': ['ESI Virtual Performance Solution', 'MADYMO',
                            'IMPETUS Afea'],
    '피로ㆍ파손 해석': ['FRANC3D', 'Ansys SMART Fracture', 'CAEfatigue',
                     'Simcenter 3D Durability'],
    '유동 해석 (CFD)': ['Altair AcuSolve', 'SU2', 'Dassault PowerFLOW',
                      'Convergent Science CONVERGE', 'XFlow', 'Autodesk CFD'],
    '열ㆍ열관리 해석': ['Simcenter FloEFD', 'Cadence Celsius Thermal Solver',
                     'TAITherm', 'ESATAN-TMS'],
    '음향ㆍNVH 해석': ['ESI VA One', 'COMSOL Acoustics Module',
                     'HEAD acoustics ArtemiS', 'Siemens Simcenter Testlab NVH'],
    '전자기ㆍEMC 해석': ['JMAG', 'Ansys Motor-CAD', 'Simcenter MAGNET',
                      'Dassault Opera', 'Sonnet Suites'],
    '광학ㆍ조명 해석': ['Synopsys CODE V', 'Lambda Research TracePro',
                     'Photon Engineering FRED', 'VirtualLab Fusion'],
    '반도체ㆍ전자 패키징 해석': ['Cadence Sigrity', 'Ansys Q3D Extractor',
                            'Ansys Sherlock', 'Silvaco TCAD',
                            'Keysight ADS'],
    '멀티피직스 연성': ['MOOSE Framework', 'Elmer FEM', 'SimScale'],
    '재료ㆍ분자 시뮬레이션': ['Quantum ESPRESSO', 'ABINIT', 'OpenMM',
                        'Thermo-Calc', 'JMatPro', 'MICRESS',
                        'Schrödinger Materials Science'],
    '공정 성형 해석': ['Simufact Forming', 'DEFORM', 'QForm', 'SIGMASOFT',
                    'ESI ProCAST', 'Dynaform', 'Stampack'],
    '용접ㆍ접합 공정 해석': ['GeonX Virfac', 'Hexagon Weld Planner',
                        'Abaqus Welding Interface'],
    '적층제조(AM) 공정 해석': ['Materialise Magics', '3D Systems 3DXpert',
                          'FLOW-3D AM', 'Additive Works Amphyon'],
    '분체ㆍ입자 거동 해석 (DEM)': ['Yade', 'MFiX', 'Barracuda Virtual Reactor',
                             'Siemens Simcenter STAR-CCM+ DEM'],
    '1D 시스템 시뮬레이션': ['ESI SimulationX', 'Wolfram System Modeler', '20-sim',
                        'Simcenter Flomaster', 'Ricardo WAVE'],
    '제어 설계ㆍ검증 (MIL/SIL/HIL)': ['ETAS LABCAR', 'Vector CANoe', 'Speedgoat',
                                  'OPAL-RT', 'Typhoon HIL'],
    '이산사건 공정 시뮬레이션': ['Rockwell Arena', 'SIMUL8', 'Lanner WITNESS',
                          'DELMIA Quest'],
    '로봇 시뮬레이션': ['CoppeliaSim', 'Webots', 'ROS 2', 'ABB RobotStudio',
                    'FANUC ROBOGUIDE', 'DELMIA Robotics'],
    '인체ㆍ인간공학 시뮬레이션': ['RAMSIS', 'DELMIA Ergonomics', 'Siemens Process Simulate Human'],

    # ── 모델 신뢰·운영 ──────────────────────────────────────────────────────
    '모델 검증ㆍ보정 (V&V)': ['Ansys optiSLang Calibration', 'BETA CAE Meta Correlation',
                          'ModelCenter Validation', 'Correlation Toolbox (Simcenter)'],
    '불확실성 정량화 (UQ)': ['SALib', 'OpenTURNS', 'Chaospy', 'PSUADE',
                         'SmartUQ'],
    '실시간 동기화ㆍ상태 추정': ['OpenDA', 'NCAR DART', 'FilterPy', 'PyMC',
                          'Moving Horizon Estimation (MHE)'],
    '축약 모델 (ROM)': ['Ansys Dynamic ROM Builder', 'PySINDy',
                     '동적 모드 분해 (DMD)', 'MOR for ANSYS'],
    # ⚠️ HyperWorks 는 전처리 묶음이라 구조 해석이 아니라 여기가 맞다.
    '메시ㆍ형상 준비': ['Gmsh', 'snappyHexMesh', 'Coreform Cubit', 'Altair SimLab',
                   'SALOME', 'Ansys SpaceClaim', 'Altair HyperWorks'],
    '재료 물성 데이터': ['Total Materia', 'MMPDS', 'Granta EduPack',
                    'NIST 재료 데이터 저장소'],
    '해석 자동화ㆍ설계 탐색': ['Ansys ModelCenter', 'Noesis Optimus', 'pyOptSparse',
                         'Phoenix Integration ModelCenter', 'SmartDO'],
    'HPCㆍ계산 자원': ['IBM Spectrum LSF', 'Altair Grid Engine',
                   'Azure CycleCloud', 'Kubernetes Volcano', 'OpenPBS'],
    '해석 데이터 관리 (SDM)': ['Aras Simulation Management', 'BETA CAE SPDRM',
                          'Ansys Cloud Direct', 'GNS SimDM'],
    '시험 계측 연계': ['imc 계측 시스템', 'Kistler DAQ', 'HBK catman',
                  '디지털 이미지 상관법 (DIC)', 'GOM ARAMIS'],

    # ── 데이터·연결 ─────────────────────────────────────────────────────────
    '설비 통신': ['EtherNet/IP', 'CC-Link IE', 'Matrikon OPC',
               'Softing edgeAggregator', 'BACnet'],
    '경량 메시징': ['CoAP', 'DDS (Data Distribution Service)', 'Eclipse Zenoh',
                'NATS'],
    '센서ㆍ계측 하드웨어': ['레이저 변위 센서', '초음파 두께 센서', '음향 방출(AE) 센서',
                     'RFIDㆍUWB 측위', 'MEMS IMU'],
    '현실 캡처 (3D 스캔)': ['GOM ATOS 구조광 스캐너', 'Matterport', 'Leica BLK2GO',
                        'CloudCompare', 'NeRF (신경 복사장)'],
    '시계열 저장': ['AVEVA PI System', 'ClickHouse', 'QuestDB', 'VictoriaMetrics',
                'Aspen InfoPlus.21'],
    '스트리밍 처리': ['Apache Pulsar', 'RabbitMQ', 'Spark Structured Streaming',
                 'Azure Event Hubs'],
    '분석용 데이터 형식': ['Apache Avro', 'Apache ORC', 'Zarr', 'NetCDF'],
    '트윈 상태 관리': ['FIWARE Orion Context Broker', 'ThingsBoard',
                  'Eclipse Vorto'],
    '수집ㆍ연결 도구': ['Fluent Bit', 'Logstash', 'Benthos', 'Cribl Stream'],
    '클라우드 IoT': ['AWS IoT Core', 'Siemens Insights Hub (구 MindSphere)',
                  'Azure IoT Central', 'Bosch IoT Suite'],
    '모니터링ㆍ대시보드': ['Kibana', 'Zabbix', 'Datadog', 'Microsoft Power BI',
                    'Tableau'],
    '엣지 컴퓨팅': ['NVIDIA Jetson', 'Siemens Industrial Edge', 'EdgeX Foundry',
                'Balena', 'Intel OpenVINO'],
    'OTㆍ데이터 보안': ['Claroty', 'Nozomi Networks', 'Tenable OT Security',
                   '제로 트러스트 (SASE)', 'Fortinet OT Fabric'],

    # ── AI ──────────────────────────────────────────────────────────────────
    '대리모델 (Surrogate)': ['Ansys SimAI', 'Neural Concept Shape', 'SciANN',
                          'NeuralOperator', 'Siemens Simcenter Studio'],
    '생성형ㆍ위상 최적화': ['Autodesk Fusion Generative Design', 'Altair Inspire',
                     'Optuna', 'Rhino Grasshopper'],
    '예지보전': ['Siemens Senseye', 'AVEVA Predictive Analytics',
              'MATLAB Predictive Maintenance Toolbox', 'Uptake', 'Augury'],
    '비전 검사': ['Keyence 비전 시스템', 'MVTec HALCON', 'NVIDIA TAO Toolkit',
              'Landing AI', 'Roboflow'],
    '강화학습 제어': ['Ray RLlib', 'Gymnasium', 'Microsoft Project Bonsai'],
    'LLM 활용': ['LangChain', 'LlamaIndex', 'vLLM', 'Ollama',
              'MCP (Model Context Protocol)'],
    'AI 운영ㆍ신뢰 (MLOps)': ['Kubeflow', 'DVC', 'BentoML', 'NVIDIA Triton',
                          'TensorRT', 'Evidently AI'],

    # ── 플랫폼 ──────────────────────────────────────────────────────────────
    '산업 3D 플랫폼': ['Hexagon HxDR', 'Esri ArcGIS', 'Cesium for Omniverse',
                   'Unity Digital Twin 솔루션'],
    'PLM ㆍ수명주기': ['SAP PLM', 'Oracle Agile PLM', 'Autodesk Fusion Manage',
                   'Duro PLM'],
    'IIoT ㆍ운영 트윈 플랫폼': ['AVEVA System Platform', 'GE Vernova Predix',
                          'Hitachi Lumada', 'Litmus Edge', 'Cognite Data Fusion'],
    '실시간 시각화ㆍXR': ['Three.js', 'Babylon.js', 'Microsoft HoloLens ㆍ Mesh',
                    'Apple Vision Pro', 'PTC Vuforia'],
    '가상 시운전': ['Siemens PLCSIM Advanced', 'CODESYS', 'Simumatik',
                'Beckhoff TwinCAT Simulation'],
    '인프라ㆍ건물 트윈': ['Willow', 'Siemens Building X', 'Johnson Controls OpenBlue',
                   'openBIM (IFC)'],

    # ── 표준화 ──────────────────────────────────────────────────────────────
    '3D 데이터 교환 표준': ['3MF', 'X3D', 'Parasolid', 'ACIS'],
    '모델 교환 표준': ['eFMI', 'Modelica 언어 표준', 'SysML v2'],
    '자산ㆍ설비 정보 표준': ['OPC UA Companion Specification', 'eCl@ss',
                       'IEC 61987', 'ISO 15926'],
    '트윈 아키텍처 표준': ['RAMI 4.0', 'IIRA (산업인터넷 참조 아키텍처)',
                    'ISO/IEC 21823 (상호운용성)', 'ISO 23704 (CPS 제조)'],
    '해석 신뢰성 표준': ['ASME V&V 70 (기계학습)', 'FDA 시뮬레이션 신뢰성 지침',
                   'ISO/IEC 17025', 'NAFEMS Sim Governance'],
    '보안ㆍ신뢰성 표준': ['NIST SP 800-82 (OT 보안)', 'ISO/SAE 21434',
                   'EU 사이버복원력법 (CRA)', 'IEC 62443-4-2'],
}


"""2026-08-27 조사분 — **기존 역량에 더 채워 넣는 도구들.**

⚠️ 첫 판(`EXTRA`)과 같은 규칙이다: 한 도구는 한 역량에만, 이미 어딘가 있는 이름은
   다시 안 적는다. 판을 따로 두는 이유도 같다 — 언제 무엇이 들어왔는지가 보인다.
"""

EXTRA_2 = {
    # ── 시뮬레이션·해석 ─────────────────────────────────────────────────────
    # GPU 세대 CFD — 판을 바꾸는 중이라 따로 눈에 띄어야 한다.
    '유동 해석 (CFD)': ['FLOW-3D', 'Altair ultraFluidX', 'Flexcompute Flow360',
                      'Luminary Cloud'],
    '멀티피직스 연성': ['Ansys Discovery'],
    '1D 시스템 시뮬레이션': ['PLECS', 'Altair PSIM'],
    '로봇 시뮬레이션': ['Drake', 'PyBullet',
                    # 휴머노이드 쪽 — 전신 동역학ㆍ최적 제어ㆍGPU 물리.
                    'Genesis (물리 시뮬레이터)', 'Pinocchio', 'Crocoddyl'],
    '이산사건 공정 시뮬레이션': ['SimPy'],

    # ── 모델 신뢰·운영 ──────────────────────────────────────────────────────
    '불확실성 정량화 (UQ)': ['UQpy'],
    '재료 물성 데이터': ['Materials Project', 'NIMS MatNavi'],
    'HPCㆍ계산 자원': ['NVIDIA Run:ai'],

    # ── 데이터·연결 ─────────────────────────────────────────────────────────
    # ⚠️ SECS/GEM — 반도체ㆍ디스플레이 장비는 OPC UA 이전에 이 말로 말한다.
    '설비 통신': ['SECS/GEM (SEMI E30)',
               # 가전ㆍ스마트홈 — 집 안의 기기는 이 말로 말한다.
               'Matter (스마트홈 표준)', 'Thread (스마트홈 무선)'],
    '시계열 저장': ['TDengine'],
    '트윈 상태 관리': ['Eclipse BaSyx', 'AASX Package Explorer'],
    'OTㆍ데이터 보안': ['Dragos', 'Microsoft Defender for IoT'],
    # OLED 소자ㆍ화질 — 디스플레이(VDㆍMX)의 광학은 렌즈만이 아니다.
    '광학ㆍ조명 해석': ['Fluxim Setfos', 'Fluxim Laoss'],
    '클라우드 IoT': ['SmartThings'],
    '트윈 아키텍처 표준': ['ITU-T Y.3090 (네트워크 트윈)'],
    '현실 캡처 (3D 스캔)': ['Leica Cyclone', 'Trimble RealWorks',
                        'Bentley iTwin Capture'],

    # ── AI ──────────────────────────────────────────────────────────────────
    '예지보전': ['Bently Nevada System 1', 'Emerson AMS Machine Works'],
    '비전 검사': ['Ultralytics YOLO', 'Anomalib'],
    # 에이전트 짜는 틀 — 2025년부터 실무에 들어온 것들.
    'LLM 활용': ['LangGraph', 'Microsoft AutoGen', 'Semantic Kernel', 'CrewAI',
              'GitHub Copilot'],
    'AI 운영ㆍ신뢰 (MLOps)': ['Hugging Face', 'NVIDIA NIM', 'LiteLLM'],

    # ── 플랫폼 ──────────────────────────────────────────────────────────────
    'IIoT ㆍ운영 트윈 플랫폼': ['Inductive Automation Ignition',
                          'Siemens WinCC Unified'],
    '실시간 시각화ㆍXR': ['Twinmotion', 'NVIDIA CloudXR'],
    '가상 시운전': ['Siemens NX MCD'],

    # ── 표준화 ──────────────────────────────────────────────────────────────
    '자산ㆍ설비 정보 표준': ['IEC 63278 (AAS)', 'IDTA 서브모델 템플릿'],
    '보안ㆍ신뢰성 표준': ['ISO/IEC 42001 (AI 경영)', 'EU AI 법 (AI Act)'],
}

"""2026-08-27 조사분 — **새로 세우는 역량들.**

⚠️ 도구 몇 개를 꽂을 데가 없어서 만드는 것이 아니라, **물음이 다른 곳**이라서
   만든다 — 배터리ㆍ네트워크ㆍ전력ㆍ건물은 각각 다른 사업부의 본업이고, 후처리ㆍ
   측정ㆍ최적화ㆍML 틀은 여러 역량이 딛고 서는 바탕이다.
"""

NEW_CAPS = [
    ('배터리 해석', SIM,
     '셀ㆍ팩의 전기화학ㆍ열ㆍ노화를 푼다. 충방전 곡선부터 열폭주까지.',
     [IQ], ['배터리', '전기화학'],
     ['PyBaMM', 'COMSOL Battery Design Module', 'Simcenter Battery Design Studio',
      'GT-AutoLion', 'AVL CRUISE M']),
    ('네트워크 시뮬레이션', SIM,
     '5GㆍTSN 등 통신망의 지연ㆍ용량을 패킷 수준으로 푼다.',
     [IQ], ['네트워크', '5G'],
     ['ns-3', 'OMNeT++', 'Keysight EXata', 'Tetcos NetSim', 'MATLAB 5G Toolbox',
      'srsRAN Project', 'OpenAirInterface']),
    ('전력 계통 시뮬레이션', SIM,
     '수배전ㆍ계통의 조류ㆍ고장ㆍ보호협조를 푼다. 공장 전력과 ESS 가 이 위에 선다.',
     [IQ], ['전력', '에너지'],
     ['ETAP', 'DIgSILENT PowerFactory', 'PSCAD', 'OpenDSS', 'Siemens PSS/E']),
    ('건물 에너지 시뮬레이션', SIM,
     '건물의 부하ㆍ공조ㆍ에너지 소비를 시간 단위로 푼다. 건물 트윈의 해석 짝이다.',
     [IQ], ['건물', '에너지'],
     ['EnergyPlus', 'OpenStudio', 'TRNSYS', 'IES VE', 'DesignBuilder']),
    ('화학ㆍ공정 플랜트 시뮬레이션', SIM,
     '유틸리티ㆍ화학 공정의 물질ㆍ에너지 수지를 푼다. 팹의 가스ㆍ초순수 공급이 여기다.',
     [IQ], ['공정', '화학'],
     ['Aspen Plus', 'Aspen HYSYS', 'gPROMS', 'DWSIM', 'Ansys Chemkin-Pro']),
    ('해석 후처리ㆍ가시화', TRUST,
     '해석 결과를 자르고 겹쳐 보이게 만든다. 대용량 결과의 마지막 관문.',
     [UX], ['후처리', '가시화'],
     ['ParaView', 'Tecplot 360', 'Ansys EnSight', 'FieldView', 'VisIt']),
    ('정밀 측정ㆍ검사', TRUST,
     '측정 점군을 설계 형상과 맞대어 as-built 편차를 잰다. 트윈과 실물의 맞춤 검사.',
     [TW], ['측정', '품질'],
     ['PolyWorks', 'ZEISS Calypso', 'Hexagon PC-DMIS', 'GOM Inspect', 'Verisurf']),
    ('수리 최적화 (OR)', AI,
     '일정ㆍ배치ㆍ경로를 제약 아래에서 최적으로 푼다. 시뮬레이션이 재고 이것이 정한다.',
     [IQ], ['최적화', '스케줄링'],
     ['Gurobi', 'IBM CPLEX', 'Google OR-Tools', 'HiGHS', 'SCIP', 'Hexaly']),
    ('머신러닝 프레임워크', AI,
     '학습 모델을 만들고 굴리는 바탕. 대리모델ㆍ예지보전ㆍ비전이 이 위에 선다.',
     [IQ], ['머신러닝', '프레임워크'],
     ['PyTorch', 'TensorFlow', 'JAX', 'scikit-learn', 'XGBoost', 'LightGBM']),
    # ── 2026-08-27 사업부 도메인 보강 — NWㆍ의료기기ㆍMXㆍVDㆍDAㆍ로봇 ──────
    ('전파ㆍ무선망 설계', SIM,
     '기지국ㆍ실내 전파를 광선추적으로 풀어 커버리지를 설계한다. 망의 자리 잡기.',
     [IQ], ['전파', '무선망'],
     ['Forsk Atoll', 'iBwave Design', 'Remcom Wireless InSite', 'Altair WinProp',
      'NVIDIA Aerial Omniverse Digital Twin']),
    ('의료 영상 기반 모델링', SIM,
     'CTㆍMRI 를 환자 맞춤 3D 모델로 만든다. 인실리코 시험의 입구.',
     [IQ], ['의료영상', '환자맞춤'],
     ['Materialise Mimics', 'Synopsys Simpleware', '3D Slicer', 'ITK-SNAP']),
    ('인실리코 시험 (생리 모델)', SIM,
     '장기ㆍ생리를 계산으로 재현해 임상 전 근거를 만든다. FDA 가 받는 가상 시험.',
     [IQ], ['인실리코', '생리'],
     ['SIMULIA Living Heart', 'UVA/Padova 당뇨 시뮬레이터', 'HumMod']),
    ('인체 전자기ㆍSAR 해석', SIM,
     '전자기가 몸에 미치는 영향을 인체 모델로 푼다. 폰ㆍ웨어러블ㆍ의료기기의 인증 관문.',
     [IQ], ['SAR', '인체'],
     ['Sim4Life', 'Remcom XFdtd', "IT'IS Virtual Population"]),
    ('냉동ㆍ공조 사이클 시뮬레이션', SIM,
     '냉매 사이클과 열교환기를 부품 수준으로 푼다. 냉장고ㆍ에어컨의 본업.',
     [IQ], ['냉동', '공조'],
     ['IMST-ART', 'CoilDesigner', 'EES (Engineering Equation Solver)',
      'TIL Suite (TLK-Thermo)']),
    ('로봇 학습ㆍ조작 AI', AI,
     '로봇이 시뮬레이션과 시연에서 조작을 배운다. 휴머노이드의 두뇌 쪽.',
     [IQ], ['휴머노이드', '파운데이션 모델'],
     ['NVIDIA Isaac GR00T', 'Hugging Face LeRobot', 'Physical Intelligence openpi']),
    ('의료기기 규격', STD,
     '의료기기 SWㆍ위험관리 규격. 인실리코 근거가 심사에 서려면 이 틀 안이어야 한다.',
     [TW], ['의료기기', '규격'],
     ['IEC 62304', 'ISO 13485', 'ISO 14971', 'IEC 60601-1']),
    ('데이터 레이크ㆍ웨어하우스', DATA,
     '트윈이 쌓는 큰 자료를 한곳에 모아 분석하게 한다. 시계열 너머의 저장소.',
     [DS], ['데이터', '분석'],
     ['Databricks', 'Snowflake', 'Google BigQuery', 'Azure Synapse Analytics',
      'MinIO', 'Dremio']),
    ('워크플로 오케스트레이션', DATA,
     '수집ㆍ학습ㆍ보고 파이프라인을 예약하고, 끊긴 자리부터 되돌린다.',
     [IN], ['파이프라인', '자동화'],
     ['Apache Airflow', 'Prefect', 'Dagster', 'Temporal', 'n8n']),
]

"""
⚠️ 덧붙임을 본 표에 합친다. 여기서 합쳐 두면 쓰는 쪽(`seed_intel_taxonomy.py`)은
   `TAXONOMY` 하나만 보면 된다 — 「본 표와 덧붙임 중 어느 것을 봐야 하나」가
   생기지 않는다.
"""
TAXONOMY = [
    (name, sector, summary, cpt, tags, tools + [
        t for t in EXTRA.get(name, []) + EXTRA_2.get(name, [])
        if t not in tools])
    for (name, sector, summary, cpt, tags, tools) in TAXONOMY
]

# ⚠️ 새 역량은 덧붙임 판이 아니라 **표에 통째로 늘어선다** — 도구까지 한 줄에 들고
#    있어서 접붙일 것이 없다. 접기(fold) 뒤에 이어 붙이는 이유다.
TAXONOMY = TAXONOMY + NEW_CAPS
