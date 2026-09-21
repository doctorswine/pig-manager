# 피그매니저

피그플랜·피그온·피그지오처럼 양돈장의 개체, 번식, 생산, 재고와 작업을 한곳에서 관리하는 웹 기반 농장 운영 시스템입니다.

## 목표

- 현장에서는 휴대폰으로 빠르게 기록한다.
- 사무실에서는 농장·돈사·그룹별 생산성을 분석한다.
- 모든 데이터는 농장 단위로 격리하고 사용자 역할별로 접근을 제한한다.
- 기록을 수정하거나 삭제해도 누가 언제 무엇을 바꿨는지 추적할 수 있다.

## 기술 방향

- Next.js App Router + TypeScript
- Supabase Postgres, Auth, Storage
- Vercel 배포
- 모바일 우선 반응형 UI
- 한국어 기본, 다국어 확장 가능

## 현재 단계

`모돈 번식관리 프로토타입 구현`

- 반응형 농장 현황 대시보드 구현
- 전입·초발정·교배·임신사고·분만·포유자돈·이유 화면 구현
- 기록 간 모돈·분만 데이터 연결과 자동 계산 구현
- 전입·교배·분만·이유 엑셀 일괄등록 구현
- 예시 데이터와 브라우저 `localStorage` 기반 프로토타입
- Supabase·Vercel 연결 전

상세 내용은 다음 문서를 참고하세요.

- [제품 정의](docs/PRODUCT_SPEC.md)
- [현장 사용자 흐름](docs/USER_FLOWS.md)
- [데이터 모델과 ERD](docs/DATA_MODEL.md)
- [개발 로드맵](docs/ROADMAP.md)
- [피그플랜 첫 화면 참고 분석](docs/references/PIGPLAN_HOME.md)
- [피그지오 첫 화면 참고 분석](docs/references/PIGGIO_HOME.md)
- [첫 화면 요구사항](docs/DASHBOARD_REQUIREMENTS.md)
- [생산관리 모듈](docs/PRODUCTION_MANAGEMENT.md)
- [현재 구현 상태와 다음 작업](docs/PROJECT_HANDOFF.md)

## 로컬 개발 준비 상태

- Node.js 22 설치 확인
- Git 설치 확인
- Vercel CLI 실행 확인, 계정 로그인 필요
- Supabase CLI 미설치
- Supabase/Vercel 프로젝트 연결 전

외부 프로젝트와 환경 변수가 준비되기 전에는 데이터베이스 마이그레이션이나 개발 서버를 실행하지 않습니다.
