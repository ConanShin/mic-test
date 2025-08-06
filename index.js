const WebSocket = require('ws');
const record = require('node-record-lpcm16');
const readline = require('readline');

//const WEBSOCKET_URL = 'wss://partner-gateway.sktauto.ai/recognition';
const WEBSOCKET_URL = 'ws://localhost:8090/recognition';

let ws = null;
let mic = null;
let lastNluResult = null; // 마지막 NLU 결과 저장

function initMic() {
  return record.start({
    sampleRateHertz: 16000,
    threshold: 0,
    verbose: false,
    recordProgram: 'rec',
    silence: '10.0',
  });
}

function startRecognition() {
  ws = new WebSocket(WEBSOCKET_URL, {
    headers: {
      'BMW-Client-Id': 'testId123',
    }
  });

  ws.on('open', () => {
    console.log('WebSocket 연결 성공, 마이크 시작');
    mic = initMic();
    mic.on('data', (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
    mic.on('error', (err) => {
      console.error('마이크 에러:', err);
    });
  });

  ws.on('message', (data) => {
    console.log('서버 응답:', data.toString());
    
    try {
      const response = JSON.parse(data.toString());
      
      // NLU 결과인지 확인하고 저장
      if (response.type === 'nlu' && response.result && response.result.intent) {
        lastNluResult = response;
        
        // Nav_SetDestinationByContact인지 확인
        if (response.result.intent.name === 'Nav_SetDestinationByContact') {
          const contactIds = response.result.intent.slots.filter(slot => slot.Com_ContactID);
          
          if (contactIds.length > 1) {
            console.log('여러 연락처가 발견되었습니다. p를 눌러 picklist를 전송하고 발화를 진행하세요.');
          }
        }
      }
    } catch (error) {
      console.log('JSON 파싱 오류:', error.message);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket 오류:', error);
  });

  ws.on('close', () => {
    console.log('WebSocket 연결 종료');
    if (mic) {
      record.stop();
      mic = null;
    }
    lastNluResult = null; // 연결 종료 시 결과 초기화

    // 자동 재연결 방지는 하고 싶은 경우 주석 처리
    // setTimeout(startRecognition, 1000);
  });
}

// 키 입력 감지
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("음성을 말하세요... (r: 재시작, s: recognitionmeta 전송, p: 연락처 선택, q: 종료)");

startRecognition();

rl.on('line', (input) => {
  const command = input.trim();

  if (command === 'r') {
    console.log('재연결 중...');
    if (ws) ws.close(); // ws.on('close')에서 재시작됨
    setTimeout(startRecognition, 1000); // 1초 후 재연결
  }

  else if (command === 's') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const metaPayload = JSON.stringify({
        type: "recognitionmeta",
        groups: [
          "Navigation",
          "MyModesSet"
        ],
        location: {
          latitude: "25.0000",
          longitude: "-71.0000"
        }
      });

      ws.send(metaPayload);
      console.log('recognitionmeta 전송:', metaPayload);
    } else {
      console.log('WebSocket이 열려있지 않습니다. 연결 상태를 확인하세요.');
    }
  }

  else if (command === 'p') {
    if (ws && ws.readyState === WebSocket.OPEN && lastNluResult) {
      // Nav_SetDestinationByContact이고 Com_ContactID가 2개 이상인지 확인
      if (lastNluResult.result.intent.name === 'Nav_SetDestinationByContact') {
        const contactIds = lastNluResult.result.intent.slots.filter(slot => slot.Com_ContactID);
        const contactNames = lastNluResult.result.intent.slots.filter(slot => slot.Com_ContactName);
        
        if (contactIds.length > 1) {
          // picklist 생성
          const picklist = contactIds.map((contactIdSlot, index) => {
            const contactName = contactNames[index] || contactNames[0]; // 해당하는 이름이 없으면 첫 번째 이름 사용
            return {
              id: contactIdSlot.Com_ContactID.value,
              value: contactName.Com_ContactName.value
            };
          });

          const metaPayload = JSON.stringify({
            type: "recognitionmeta",
            groups: [
              "SelectBy"
            ],
            location: {
              latitude: "25.0000",
              longitude: "-71.0000"
            },
            picklist: picklist
          });

          ws.send(metaPayload);
          console.log('연락처 선택 recognitionmeta 전송:', metaPayload);
        } else {
          console.log('선택할 연락처가 2개 이상이 아닙니다.');
        }
      } else {
        console.log('Nav_SetDestinationByContact 결과가 아닙니다.');
      }
    } else {
      console.log('WebSocket이 열려있지 않거나 NLU 결과가 없습니다.');
    }
  }

  else if (command === 'q') {
    console.log('앱을 종료합니다...');
    if (ws) {
      ws.close();
    }
    if (mic) {
      record.stop();
      mic = null;
    }
    rl.close();
    process.exit(0);
  }
});
