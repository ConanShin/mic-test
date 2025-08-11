class AutoProxyMicTest {
    constructor() {
        this.ws = null;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.lastNluResult = null;
        this.isRecording = false;
        
        // WebSocket URL
        this.WEBSOCKET_URL = 'wss://partner-gateway.sktauto.ai/recognition';
        // this.WEBSOCKET_URL = 'ws://localhost:8090/recognition';
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.metaBtn = document.getElementById('meta-btn');
        this.picklistBtn = document.getElementById('picklist-btn');
        this.connectionStatus = document.getElementById('connection-status');
        this.micStatus = document.getElementById('mic-status');
        this.output = document.getElementById('output');
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startRecognition());
        this.stopBtn.addEventListener('click', () => this.stopRecognition());
        this.restartBtn.addEventListener('click', () => this.restart());
        this.metaBtn.addEventListener('click', () => this.sendRecognitionMeta());
        this.picklistBtn.addEventListener('click', () => this.sendPicklist());
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
        
        this.output.appendChild(messageDiv);
        this.output.scrollTop = this.output.scrollHeight;
        
        console.log(`[${timestamp}] ${message}`);
    }

    updateConnectionStatus(status, isConnected) {
        this.connectionStatus.textContent = status;
        this.connectionStatus.className = `status ${isConnected ? 'connected' : 'disconnected'}`;
    }

    updateMicStatus(status, isActive) {
        this.micStatus.textContent = status;
        this.micStatus.className = `status ${isActive ? 'active' : 'inactive'}`;
    }

    async startRecognition() {
        try {
            // 마이크 권한 요청
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.microphone.connect(this.analyser);
            this.analyser.fftSize = 2048;
            
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            // WebSocket 연결
            this.connectWebSocket();
            
            // 오디오 데이터 스트리밍 시작
            this.streamAudioData();
            
            this.isRecording = true;
            this.updateMicStatus('활성', true);
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            
            this.log('음성 인식이 시작되었습니다.', 'success');
            
        } catch (error) {
            this.log(`마이크 접근 오류: ${error.message}`, 'error');
        }
    }

    stopRecognition() {
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.ws) {
            this.ws.close();
        }
        
        this.isRecording = false;
        this.updateMicStatus('비활성', false);
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.picklistBtn.disabled = true;
        
        this.log('음성 인식이 중지되었습니다.', 'info');
    }

    connectWebSocket() {
        // URL에 BMW-Client-Id를 쿼리 파라미터로 추가
        const wsUrl = `${this.WEBSOCKET_URL}?BMW-Client-Id=testId123`;
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.updateConnectionStatus('연결됨', true);
            this.log('WebSocket 연결 성공', 'success');
        };
        
        this.ws.onmessage = (event) => {
            this.log(`서버 응답: ${event.data}`, 'info');
            
            try {
                const response = JSON.parse(event.data);
                
                // NLU 결과인지 확인하고 저장
                if (response.type === 'nlu' && response.result && response.result.intent) {
                    this.lastNluResult = response;
                    
                    // Nav_SetDestinationByContact인지 확인
                    if (response.result.intent.name === 'Nav_SetDestinationByContact') {
                        const contactIds = response.result.intent.slots.filter(slot => slot.Com_ContactID);
                        
                        if (contactIds.length > 1) {
                            this.log('여러 연락처가 발견되었습니다. "연락처 선택" 버튼을 눌러 picklist를 전송하세요.', 'info');
                            this.picklistBtn.disabled = false;
                        }
                    }
                }
            } catch (error) {
                this.log(`JSON 파싱 오류: ${error.message}`, 'error');
            }
        };
        
        this.ws.onerror = (error) => {
            this.log(`WebSocket 오류: ${error}`, 'error');
        };
        
        this.ws.onclose = () => {
            this.updateConnectionStatus('연결 안됨', false);
            this.log('WebSocket 연결 종료', 'info');
            this.lastNluResult = null;
        };
    }

    streamAudioData() {
        if (!this.isRecording || !this.analyser || !this.ws) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const processAudio = () => {
            if (!this.isRecording) return;
            
            this.analyser.getByteFrequencyData(dataArray);
            
            // PCM 데이터로 변환 (16비트)
            const pcmData = new Int16Array(bufferLength);
            for (let i = 0; i < bufferLength; i++) {
                pcmData[i] = (dataArray[i] - 128) * 256;
            }
            
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(pcmData.buffer);
            }
            
            requestAnimationFrame(processAudio);
        };
        
        processAudio();
    }

    restart() {
        this.log('재연결 중...', 'info');
        this.stopRecognition();
        setTimeout(() => {
            this.startRecognition();
        }, 1000);
    }

    sendRecognitionMeta() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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

            this.ws.send(metaPayload);
            this.log(`recognitionmeta 전송: ${metaPayload}`, 'info');
        } else {
            this.log('WebSocket이 열려있지 않습니다. 연결 상태를 확인하세요.', 'error');
        }
    }

    sendPicklist() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.lastNluResult) {
            // Nav_SetDestinationByContact이고 Com_ContactID가 2개 이상인지 확인
            if (this.lastNluResult.result.intent.name === 'Nav_SetDestinationByContact') {
                const contactIds = this.lastNluResult.result.intent.slots.filter(slot => slot.Com_ContactID);
                const contactNames = this.lastNluResult.result.intent.slots.filter(slot => slot.Com_ContactName);
                
                if (contactIds.length > 1) {
                    // picklist 생성
                    const picklist = contactIds.map((contactIdSlot, index) => {
                        const contactName = contactNames[index] || contactNames[0];
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

                    this.ws.send(metaPayload);
                    this.log(`연락처 선택 recognitionmeta 전송: ${metaPayload}`, 'info');
                } else {
                    this.log('선택할 연락처가 2개 이상이 아닙니다.', 'error');
                }
            } else {
                this.log('Nav_SetDestinationByContact 결과가 아닙니다.', 'error');
            }
        } else {
            this.log('WebSocket이 열려있지 않거나 NLU 결과가 없습니다.', 'error');
        }
    }
}

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', () => {
    new AutoProxyMicTest();
});
