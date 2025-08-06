# 음성 인식 WebSocket 클라이언트

이 프로젝트는 Node.js를 사용하여 WebSocket 서버에 음성 데이터를 전송하고, 음성 인식 결과를 받아 출력하는 간단한 클라이언트 예제입니다.  

---

## 주요 기능

- 마이크에서 음성 입력을 실시간 스트리밍하여 WebSocket 서버로 전송
- 서버로부터 음성 인식 결과 수신 및 콘솔 출력
- `r` 키 입력 시 기존 연결 종료 후 재연결 및 음성 인식 재시작
- `s` 키 입력 시 recognitionmeta 전송 (Navigation, MyModesSet 그룹)
- `p` 키 입력 시 연락처 선택 recognitionmeta 전송 (SelectBy 그룹, picklist 포함)

---

## 키보드 명령어

- **r**: WebSocket 연결 재시작 및 음성 인식 재시작
- **s**: Navigation, MyModesSet 그룹의 recognitionmeta 전송
- **p**: 연락처 선택을 위한 SelectBy 그룹의 recognitionmeta 전송 (picklist 포함)
- **q**: WebSocket 연결 종료 및 앱 종료

---

## 사전 준비

### 공통 요구사항
- Node.js (버전 12 이상 권장) 설치
- WebSocket 음성 인식 서버 구동 중이어야 함 (`wss://partner-gateway.sktauto.ai/recognition` 사용 예시)

### Node.js 설치

#### Windows
- **공식 설치 파일** (권장):
  1. [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전 다운로드
  2. 설치 파일 실행 후 기본 설정으로 설치
  3. 설치 완료 후 명령 프롬프트에서 `node --version` 실행하여 설치 확인

#### macOS
- **Homebrew를 통한 설치** (권장):
  ```bash
  brew install node
  ```

- **공식 설치 파일**:
  1. [Node.js 공식 사이트](https://nodejs.org/)에서 macOS용 설치 파일 다운로드
  2. 설치 파일 실행 후 기본 설정으로 설치

#### Linux (Ubuntu/Debian)
- **NodeSource 저장소를 통한 설치** (권장):
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

- **apt를 통한 설치**:
  ```bash
  sudo apt-get update
  sudo apt-get install nodejs npm
  ```

#### 설치 확인
모든 운영체제에서 설치 후 다음 명령어로 설치를 확인하세요:
```bash
node --version
npm --version
```

### 운영체제별 녹음 프로그램 설치

#### Windows
- **Sox 설치** (권장):
  1. [Sox 공식 사이트](https://sox.sourceforge.net/)에서 Windows용 설치 파일 다운로드
  2. 또는 Chocolatey를 사용하여 설치: `choco install sox`
  3. 또는 Scoop을 사용하여 설치: `scoop install sox`

- **대안: FFmpeg 설치**:
  1. [FFmpeg 공식 사이트](https://ffmpeg.org/download.html)에서 Windows용 다운로드
  2. 또는 Chocolatey를 사용: `choco install ffmpeg`

#### macOS
- **Homebrew를 통한 Sox 설치** (권장):
  ```bash
  brew install sox
  ```

#### Linux (Ubuntu/Debian)
- **Sox 설치**:
  ```bash
  sudo apt-get update
  sudo apt-get install sox
  ```

- **또는 arecord 사용** (ALSA 기반):
  ```bash
  sudo apt-get install alsa-utils
  ```

---

## 설치 및 실행 방법

1. 프로젝트 폴더로 이동 후 필요한 패키지 설치
```bash
npm install
```

2. 다음 명령어로 앱 실행
```bash
node index.js
```

3. 실행 후 "음성을 말하세요... (r: 재시작, s: recognitionmeta 전송, p: 연락처 선택, q: 종료)" 문구가 출력되면 음성 입력 대기 상태입니다.  
   음성을 말하면 서버가 인식 결과를 응답합니다.

4. 음성 인식을 중단하고 WebSocket 연결을 재시작하려면 터미널에서 `r`을 입력하고 엔터를 누르세요.

5. "철민이네로 가자"와 같은 음성 인식 결과에서 여러 연락처가 발견되면 `p`를 눌러 선택 목록을 전송할 수 있습니다.

6. 앱을 종료하려면 `q`를 입력하고 엔터를 누르세요.

---

## 연락처 선택 기능 (p 키)

`Nav_SetDestinationByContact` 인텐트에서 `Com_ContactID`가 2개 이상일 때 `p` 키를 누르면 다음과 같은 형식의 recognitionmeta가 전송됩니다:

```json
{
  "type": "recognitionmeta",
  "groups": [
    "SelectBy"
  ],
  "location": {
    "latitude": "25.0000",
    "longitude": "-71.0000"
  },
  "picklist": [
    {
      "id": "2",
      "value": "철민"
    },
    {
      "id": "5", 
      "value": "철민"
    }
  ]
}
```

---

## 운영체제별 문제 해결

### Windows에서 녹음이 안 되는 경우
1. **마이크 권한 확인**: Windows 설정 > 개인정보 > 마이크에서 앱이 마이크에 접근할 수 있도록 허용
2. **기본 오디오 장치 설정**: 제어판 > 소리 > 녹음 탭에서 마이크가 기본 장치로 설정되어 있는지 확인
3. **Sox 설치 확인**: 명령 프롬프트에서 `sox --version` 실행하여 설치 확인
4. **대안 명령어 사용**: 코드에서 Windows용 녹음 명령어로 변경 필요할 수 있음

### macOS에서 녹음이 안 되는 경우
1. **마이크 권한 확인**: 시스템 환경설정 > 보안 및 개인정보 > 개인정보 > 마이크에서 터미널 앱 허용
2. **Sox 설치 확인**: 터미널에서 `sox --version` 실행

### Linux에서 녹음이 안 되는 경우
1. **ALSA 설정 확인**: `alsamixer` 명령어로 마이크 볼륨 및 설정 확인
2. **권한 문제**: `sudo usermod -a -G audio $USER` 실행 후 재로그인

---

## 코드 설명

- `node-record-lpcm16` 라이브러리를 이용하여 마이크에서 16kHz 샘플링 음성을 스트리밍  
- `ws` 라이브러리로 WebSocket 연결 수립 및 데이터 송수신  
- `readline` 모듈을 사용해 터미널 입력 감지(`r`, `s`, `p`, `q` 키 입력 시 각각 다른 동작)
- NLU 결과 파싱 및 저장을 통한 연락처 선택 기능 구현

---

## 주의 사항

- 마이크 녹음 프로그램(`sox`, `arecord`, `ffmpeg`)이 정상 동작해야 합니다.  
- WebSocket 서버 주소(`WEBSOCKET_URL`)와 헤더(`BMW-Client-Id`)는 환경에 맞게 수정하세요.  
- `r` 입력 시 기존 연결이 종료되므로 서버 간 연결 제한이 있을 경우 주의하세요.
- Windows에서는 마이크 권한 설정이 중요합니다.
- `p` 키는 `Nav_SetDestinationByContact` 인텐트에서만 동작하며, `Com_ContactID`가 2개 이상일 때만 유효합니다.
- `q` 키를 누르면 WebSocket 연결이 종료되고 앱이 완전히 종료됩니다.

---



