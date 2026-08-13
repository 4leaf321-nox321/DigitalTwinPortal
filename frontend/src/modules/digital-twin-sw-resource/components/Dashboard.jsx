import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Package, Copy, LayoutGrid, Users } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const Container = styled.div`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

/* ---- Filter ---- */
const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const FilterSelect = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  color: #1e293b;
  cursor: pointer;
`;

const FilterLabel = styled.span`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
`;

/* ---- Summary Cards ---- */
const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const Card = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
`;

const CardIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ bg }) => bg || '#e0f2fe'};
  color: ${({ fg }) => fg || '#0369a1'};
  flex-shrink: 0;
`;

const CardInfo = styled.div`
  .value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
  }
  .label {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.125rem;
  }
  .sub {
    font-size: 0.6875rem;
    color: #94a3b8;
  }
`;

/* ---- Chart Sections ---- */
const ChartRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const ChartBox = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
`;

const ChartTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  margin-bottom: 1rem;
`;

/* ---- Heatmap ---- */
const HeatmapWrapper = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  overflow-x: auto;
`;

const HeatmapTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;

  th, td {
    padding: 0.5rem 0.75rem;
    text-align: center;
    border: 1px solid #f1f5f9;
  }

  th {
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    white-space: nowrap;
  }

  th:first-child, td:first-child {
    text-align: left;
    font-weight: 600;
    color: #334155;
    background: #f8fafc;
    position: sticky;
    left: 0;
    z-index: 1;
  }
`;

const HeatCell = styled.td`
  background: ${({ intensity }) =>
    intensity === 0 ? '#ffffff' :
    intensity <= 2 ? '#e0f2fe' :
    intensity <= 5 ? '#7dd3fc' :
    intensity <= 10 ? '#38bdf8' :
    intensity <= 20 ? '#0ea5e9' : '#0369a1'} !important;
  color: ${({ intensity }) => intensity > 5 ? 'white' : '#334155'} !important;
  font-weight: ${({ intensity }) => intensity > 0 ? '600' : '400'} !important;
`;

const HeatmapNote = styled.div`
  font-size: 0.6875rem;
  color: #94a3b8;
  margin-top: 0.75rem;
`;

const EmptyDashboard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  p { font-size: 1rem; }
`;

/* ---- Colors ---- */
const BAR_COLORS = [
  '#0ea5e9', '#38bdf8', '#7dd3fc', '#0284c7', '#0369a1',
  '#06b6d4', '#14b8a6', '#10b981', '#f59e0b', '#8b5cf6',
];

const PIE_COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

const Dashboard = ({ resources, divisions, selectedDivision, onDivisionChange }) => {
  const filtered = useMemo(() => {
    if (!selectedDivision) return resources;
    return resources.filter(r => r.division === selectedDivision);
  }, [resources, selectedDivision]);

  const baseOnly = useMemo(() =>
    filtered.filter(r => r.licenseNature !== 'addon'),
  [filtered]);

  // 요약 카드 데이터
  const summary = useMemo(() => {
    const allCats = new Set();
    const allUsingDepts = new Set();
    let totalCopy = 0;

    baseOnly.forEach(r => {
      (r.category || []).forEach(c => allCats.add(c));
      (r.usingDepartments || []).forEach(d => allUsingDepts.add(d));
      totalCopy += (r.copyCount || 0);
    });

    const totalCats = new Set();
    resources.forEach(r => (r.category || []).forEach(c => totalCats.add(c)));

    return {
      swCount: filtered.length,
      baseCount: baseOnly.length,
      totalCopy,
      coveredCats: allCats.size,
      totalCats: totalCats.size,
      usingDeptCount: allUsingDepts.size,
    };
  }, [filtered, baseOnly, resources]);

  // 카테고리별 카피 수 (Base만, 중복 집계)
  const categoryBarData = useMemo(() => {
    const map = {};
    baseOnly.forEach(r => {
      const copy = r.copyCount || 0;
      (r.category || []).forEach(cat => {
        map[cat] = (map[cat] || 0) + copy;
      });
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [baseOnly]);

  // 라이선스 유형 비율 (S/W 건수 기준)
  const licenseTypePieData = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const type = r.licenseType || '미분류';
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // 히트맵: 부서(사용 부서) × 카테고리 (Base 카피 수)
  const heatmapData = useMemo(() => {
    const deptCatMap = {};
    const allCats = new Set();

    baseOnly.forEach(r => {
      const copy = r.copyCount || 0;
      const depts = (r.usingDepartments || []).length > 0
        ? r.usingDepartments
        : (r.department ? [r.department] : []);

      depts.forEach(dept => {
        if (!deptCatMap[dept]) deptCatMap[dept] = {};
        (r.category || []).forEach(cat => {
          allCats.add(cat);
          deptCatMap[dept][cat] = (deptCatMap[dept][cat] || 0) + copy;
        });
      });
    });

    const cats = [...allCats].sort();
    const rows = Object.entries(deptCatMap)
      .map(([dept, catMap]) => {
        const total = Object.values(catMap).reduce((s, v) => s + v, 0);
        return { dept, catMap, total };
      })
      .sort((a, b) => b.total - a.total);

    return { cats, rows };
  }, [baseOnly]);

  if (resources.length === 0) {
    return (
      <EmptyDashboard>
        <p>등록된 S/W 자원이 없습니다.</p>
      </EmptyDashboard>
    );
  }

  return (
    <Container>
      {/* 필터 */}
      <FilterBar>
        <FilterLabel>사업부</FilterLabel>
        <FilterSelect
          value={selectedDivision}
          onChange={e => onDivisionChange(e.target.value)}
        >
          <option value="">전체</option>
          {divisions.map(d => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </FilterSelect>
      </FilterBar>

      {/* 요약 카드 */}
      <CardGrid>
        <Card>
          <CardIcon bg="#e0f2fe" fg="#0369a1">
            <Package size={22} />
          </CardIcon>
          <CardInfo>
            <div className="value">{summary.swCount}</div>
            <div className="label">보유 S/W</div>
            <div className="sub">Base {summary.baseCount}건</div>
          </CardInfo>
        </Card>
        <Card>
          <CardIcon bg="#dcfce7" fg="#166534">
            <Copy size={22} />
          </CardIcon>
          <CardInfo>
            <div className="value">{summary.totalCopy}</div>
            <div className="label">총 카피 수</div>
            <div className="sub">Base 기준</div>
          </CardInfo>
        </Card>
        <Card>
          <CardIcon bg="#ede9fe" fg="#5b21b6">
            <LayoutGrid size={22} />
          </CardIcon>
          <CardInfo>
            <div className="value">{summary.coveredCats} / {summary.totalCats}</div>
            <div className="label">커버 카테고리</div>
          </CardInfo>
        </Card>
        <Card>
          <CardIcon bg="#fef3c7" fg="#92400e">
            <Users size={22} />
          </CardIcon>
          <CardInfo>
            <div className="value">{summary.usingDeptCount}</div>
            <div className="label">활용 부서 수</div>
          </CardInfo>
        </Card>
      </CardGrid>

      {/* 차트 행 */}
      <ChartRow>
        {/* 카테고리별 카피 수 */}
        <ChartBox>
          <ChartTitle>카테고리별 카피 수 (Base)</ChartTitle>
          {categoryBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, categoryBarData.length * 36)}>
              <BarChart data={categoryBarData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" fontSize={12} stroke="#94a3b8" />
                <YAxis type="category" dataKey="name" width={100} fontSize={12} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}
                  formatter={(value) => [`${value} 카피`, '카피 수']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {categoryBarData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>데이터 없음</div>
          )}
        </ChartBox>

        {/* 라이선스 유형 비율 */}
        <ChartBox>
          <ChartTitle>라이선스 유형 분포</ChartTitle>
          {licenseTypePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={licenseTypePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={true}
                  fontSize={12}
                >
                  {licenseTypePieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}
                  formatter={(value) => [`${value}건`, 'S/W 수']}
                />
                <Legend
                  wrapperStyle={{ fontSize: '0.75rem' }}
                  formatter={(value) => <span style={{ color: '#475569' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>데이터 없음</div>
          )}
        </ChartBox>
      </ChartRow>

      {/* 히트맵 */}
      <HeatmapWrapper>
        <ChartTitle>부서 × 카테고리 카피 수 히트맵 (Base)</ChartTitle>
        {heatmapData.rows.length > 0 ? (
          <>
            <HeatmapTable>
              <thead>
                <tr>
                  <th>부서</th>
                  {heatmapData.cats.map(cat => (
                    <th key={cat}>{cat}</th>
                  ))}
                  <th>합계</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.rows.map(({ dept, catMap, total }) => (
                  <tr key={dept}>
                    <td>{dept}</td>
                    {heatmapData.cats.map(cat => {
                      const val = catMap[cat] || 0;
                      return (
                        <HeatCell key={cat} intensity={val}>
                          {val || '-'}
                        </HeatCell>
                      );
                    })}
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{total}</td>
                  </tr>
                ))}
              </tbody>
            </HeatmapTable>
            <HeatmapNote>
              * Base 라이선스의 카피 수(환산) 기준 집계. 복수 카테고리 S/W는 각 카테고리에 중복 집계됩니다.
            </HeatmapNote>
          </>
        ) : (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>데이터 없음</div>
        )}
      </HeatmapWrapper>
    </Container>
  );
};

export default Dashboard;
