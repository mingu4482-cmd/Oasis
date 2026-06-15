# OASIS — MCP 알림 메시지 관리

OASIS 프로젝트의 단계별 SMS·Slack 알림 템플릿 편집 및 발송 관리 프런트엔드입니다.

## 시작

```bash
npm install
npm start
```

## 구조

```
src/
├── data.ts                     # 타입, 단계 정의, 템플릿, 헬퍼 함수
├── App.tsx / App.module.css    # 루트 레이아웃
└── components/
    ├── StageTab                # 관심·주의·위험·심각 탭
    ├── TemplateEditor          # 맨홀 정보 입력 + 본문 편집 + 변수 삽입
    ├── PreviewPanel            # 실시간 미리보기 + 채널 선택 + 발송
    └── SendLog                 # 발송 이력 로그
```

## 템플릿 변수

| 변수 | 설명 |
|------|------|
| `{{맨홀ID}}` | 맨홀 식별자 (예: MH-001) |
| `{{위치}}` | 맨홀 위치 주소 |
| `{{수위}}` | 현재 수위 % |
| `{{속도}}` | 수위 상승 속도 (%/분) |
| `{{5분후}}` | 5분 후 예측 수위 % |
| `{{10분후}}` | 10분 후 예측 수위 % |
| `{{시간}}` | 발송 시각 |

## 백엔드 연동

`PreviewPanel`의 `onSend` 콜백에서 Spring Boot API 호출로 교체하면 됩니다.

```ts
async function handleSend(channels: string[]) {
  await fetch('/api/alert/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channels, message: preview, stage: activeKey }),
  });
}
```
