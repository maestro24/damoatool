# 다모아툴 — 사다리 · 룰렛 · 팀나누기 · 타이머

회식·수업·회의에서 바로 쓰는 무료 웹 도구 모음. 순수 정적 사이트 (빌드 도구·서버·외부 요청 0).

**운영 URL**: https://maestro24.github.io/damoatool/

## 실행 & 테스트

```bash
python -m http.server 8000        # 로컬 실행
node tests/common.test.mjs        # 공용 로직 (셔플·분배·인코딩)
node tests/ladder.test.mjs        # 사다리 순열 보장
node tests/roulette.test.mjs      # 룰렛 각도·분포
node tests/team.test.mjs          # 팀 분배
node tests/timer.test.mjs         # 시간 포맷
```

## 구조

```
index.html            허브
ladder.html           사다리타기 (js/ladder-core.js: 순수 로직)
roulette.html         원판 룰렛 (js/roulette-core.js)
team.html             팀 나누기
timer.html            대형 타이머 (js/timer-core.js)
js/common.js          공용: 테마·토스트·저장·URL공유·Fisher-Yates
css/style.css         공용 디자인 시스템 (--tool-accent로 도구별 색)
docs/PLAN.md          기획서
```

## 원칙

1. 3초 사용성 — 착지 즉시 사용 가능, 가입·설정 강요 없음
2. 공정한 랜덤 — Fisher-Yates, 사다리 결과는 순열임을 테스트로 증명
3. 프로젝터 대응 — 타이머·룰렛 전체화면 모드
4. 데이터는 localStorage만 — 서버 전송 없음
