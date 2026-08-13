// 타입 설정과 노드 데이터 동기화 디버깅 스크립트

console.log('=== 타입 설정 저장소 디버깅 ===');

// localStorage에서 현재 타입 설정 확인
const savedSettings = localStorage.getItem('knowledgeGraphTypeSettings');
if (savedSettings) {
  const settings = JSON.parse(savedSettings);
  console.log('현재 저장된 타입 설정:', settings);
} else {
  console.log('저장된 타입 설정이 없음');
}

// 문제 분석
console.log('\n=== 문제 분석 ===');
console.log('1. person 타입을 설정에서 삭제함');
console.log('2. 하지만 기존 노드 인스턴스는 여전히 person 타입을 가지고 있음');
console.log('3. 타입 변경 로직이 제대로 작동하지 않을 가능성');

// 해결 방법
console.log('\n=== 해결 방법 ===');
console.log('1. 타입 설정 변경 시 즉시 기존 노드 데이터를 업데이트');
console.log('2. 페이지 로드 시에도 타입 설정과 노드 데이터 동기화');
console.log('3. 삭제된 타입을 가진 노드를 자동으로 "unknown"으로 변경');
