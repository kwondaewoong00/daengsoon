# 댕순 올리기 (맥북 없이 24시간)

서버 코드는 어디에 올려도 같습니다. `Dockerfile` 하나로 화면과 실시간 서버가 함께 뜹니다.
아래 셋 중 **Railway**가 가장 쉽고(5분), 다른 둘은 대안입니다.

## 1순위: Railway (월 5달러 Hobby, 처음엔 무료 크레딧)

1. https://railway.com 에서 GitHub로 가입
2. **New Project → Deploy from GitHub repo → `kwondaewoong00/daengsoon`** 선택
   - 처음이면 "Configure GitHub App"에서 이 저장소에 권한을 줍니다
3. 빌드가 끝나면(2~3분) 서비스 카드 → **Settings → Networking → Generate Domain**
4. 나온 주소(`xxx.up.railway.app`)가 끝. 폰에서 열면 됩니다
5. 내 도메인(예: daengsoon.app)을 쓰려면 같은 화면의 Custom Domain에 붙이고, 도메인 업체에서 CNAME만 추가

이후엔 GitHub `main`에 올릴 때마다 자동으로 다시 배포됩니다.

## 2순위: Render (무료 플랜 있음)

1. https://render.com 가입 → **New → Blueprint** → 이 저장소
2. `render.yaml`을 읽어서 자동으로 만듭니다. 플랜만 고르면 끝
   - **Free**: 15분 손님 없으면 잠듭니다. 다음 손님이 50초쯤 기다림. 테스트용
   - **Starter(월 7달러)**: 항상 켜짐

## 3순위: Fly.io (도쿄 서버, 가장 빠른 응답)

터미널이 필요합니다.
```bash
brew install flyctl && fly auth signup
cd daengsoon && fly launch --copy-config --now
```

## 확인

- `https://내주소/healthz` 를 열어 `{"ok":true,...}` 가 보이면 서버가 살아 있는 겁니다
- 폰 두 대로 들어가 같은 캠프에 모이는지 확인

## 비용 감각

- 접속자 수십 명: 가장 싼 플랜으로 충분. 서버는 1초에 10번 작은 메시지만 보냅니다
- 접속자 수백 명 동시: 같은 플랜에서도 보통 버팁니다. 그때 가서 한 단계 올리면 됩니다
- 돈이 드는 건 "켜져 있는 시간"이지 손님 수가 아닙니다

## 자주 막히는 곳

- **소리가 안 남**: iOS는 첫 터치 전엔 소리를 못 냅니다. "불 앞에 앉으러 가기"를 눌러야 켜집니다
- **다른 캠프로 들어감**: 산/바다, 1~50번 캠프가 자동 배정입니다. 같은 캠프로 모이려면 주소에 `?room=mountain-03` 처럼 붙여 공유
- **인스타 링크**: `https://내주소/?room=mountain-01` 처럼 캠프를 고정해 두면 링크로 들어온 사람들이 한곳에 모입니다
