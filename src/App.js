import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { convertToBackward } from './utils/hangulConverter';
import AdSense from './components/AdSense';

function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [reversedAudio, setReversedAudio] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const recordedMimeTypeRef = useRef('');

  // 텍스트 변환 함수
  const handleConvert = () => {
    if (!inputText.trim()) {
      alert('텍스트를 입력해주세요.');
      return;
    }
    
    const converted = convertToBackward(inputText);
    setOutputText(converted);
  };

  // 음성 녹음 시작
  const startRecording = async () => {
    try {
      // 이전 녹음 정리
      if (recordedAudio) {
        URL.revokeObjectURL(recordedAudio);
        setRecordedAudio(null);
      }
      if (reversedAudio) {
        URL.revokeObjectURL(reversedAudio);
        setReversedAudio(null);
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      // 브라우저가 지원하는 MIME 타입 찾기
      const mimeTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/wav'];
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, selectedMimeType ? { mimeType: selectedMimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      
      // 실제 사용된 MIME 타입 저장
      recordedMimeTypeRef.current = mediaRecorder.mimeType || selectedMimeType || 'audio/webm';
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // 모든 데이터가 수집될 때까지 약간 대기
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (audioChunksRef.current.length === 0) {
          setIsProcessing(false);
          alert('녹음된 데이터가 없습니다.');
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          return;
        }
        
        // MediaRecorder가 생성한 실제 MIME 타입 사용
        const actualMimeType = recordedMimeTypeRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        
        // Blob 크기 확인
        if (audioBlob.size === 0) {
          setIsProcessing(false);
          alert('녹음된 오디오가 비어있습니다.');
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          return;
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio(audioUrl);
        
        // 역재생 오디오 생성
        await createReversedAudio(audioBlob);
        
        // 스트림 정리
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      // timeslice를 설정하여 주기적으로 데이터 수집
      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (error) {
      console.error('녹음 시작 실패:', error);
      alert('마이크 접근 권한이 필요합니다.');
    }
  };

  // 음성 녹음 중지
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  // 역재생 오디오 생성
  const createReversedAudio = async (audioBlob) => {
    try {
      // 이전 AudioContext 정리
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          await audioContextRef.current.close();
        } catch (e) {
          // 이미 닫혔거나 닫을 수 없는 경우 무시
        }
      }
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const reversedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      // 각 채널을 역전
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        const reversedData = reversedBuffer.getChannelData(channel);
        
        for (let i = 0; i < channelData.length; i++) {
          reversedData[i] = channelData[channelData.length - 1 - i];
        }
      }
      
      // AudioBuffer를 Blob으로 변환
      const wav = audioBufferToWav(reversedBuffer);
      const reversedBlob = new Blob([wav], { type: 'audio/wav' });
      const reversedUrl = URL.createObjectURL(reversedBlob);
      
      setReversedAudio(reversedUrl);
      setIsProcessing(false);
    } catch (error) {
      console.error('역재생 오디오 생성 실패:', error);
      setIsProcessing(false);
      alert('오디오 처리 중 오류가 발생했습니다.');
    }
  };

  // AudioBuffer를 WAV로 변환
  const audioBufferToWav = (buffer) => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // WAV 헤더 작성
    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(pos + i, str.charCodeAt(i));
      }
      pos += str.length;
    };

    writeString('RIFF');
    view.setUint32(pos, 36 + length * numberOfChannels * 2, true);
    pos += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(pos, 16, true);
    pos += 4;
    view.setUint16(pos, 1, true);
    pos += 2;
    view.setUint16(pos, numberOfChannels, true);
    pos += 2;
    view.setUint32(pos, sampleRate, true);
    pos += 4;
    view.setUint32(pos, sampleRate * numberOfChannels * 2, true);
    pos += 4;
    view.setUint16(pos, numberOfChannels * 2, true);
    pos += 2;
    view.setUint16(pos, 16, true);
    pos += 2;
    writeString('data');
    view.setUint32(pos, length * numberOfChannels * 2, true);
    pos += 4;

    // 채널 데이터 작성
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < arrayBuffer.byteLength) {
      for (let i = 0; i < numberOfChannels; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return arrayBuffer;
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // AudioContext 정리
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {
          // 닫기 실패 시 무시
        });
      }
      // 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // 오디오 URL 정리
      if (recordedAudio) {
        URL.revokeObjectURL(recordedAudio);
      }
      if (reversedAudio) {
        URL.revokeObjectURL(reversedAudio);
      }
    };
  }, [recordedAudio, reversedAudio]);
  
  // 녹음 중지 시 스트림 정리
  useEffect(() => {
    if (!isRecording && streamRef.current) {
      // 약간의 지연 후 정리 (onstop 이벤트가 완료되도록)
      const timer = setTimeout(() => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            if (track.readyState === 'live') {
              track.stop();
            }
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isRecording]);

  // ESC 키로 모달 닫기 및 body 스크롤 제어
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
      }
    };
    
    // 모달이 열릴 때 body 스크롤 방지
    if (showHelp) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showHelp]);

  return (
    <div className="app">
      <header className="header" role="banner">
        <h1>한국어 역재생 발음 생성기</h1>
        <p>한글 텍스트를 역재생 발음으로 변환하거나 음성을 녹음하여 역재생하세요!</p>
      </header>
      
      {/* 상단 광고 영역 */}
      <AdSense 
        adSlot="" 
        className="ad-top"
        style={{ margin: '20px auto', maxWidth: '800px' }}
      />
      
      <main className="container" role="main">
        {/* 도움말 버튼 */}
        <button 
          className="help-button"
          onClick={() => setShowHelp(true)}
          aria-label="도움말 열기"
        >
          📖 사용 방법
        </button>

        {/* 모달 오버레이 */}
        {showHelp && (
          <div 
            className="modal-overlay"
            onClick={() => setShowHelp(false)}
            aria-label="모달 닫기"
          >
            <div 
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>📖 사용 방법</h2>
                <button 
                  className="modal-close"
                  onClick={() => setShowHelp(false)}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
              
              <div className="modal-body">
              <div className="help-item">
                  <h4>🎯 사용 팁</h4>
                  <ul>
                    <li>변환된 역재생 발음을 <strong>음성으로 녹음</strong>한 후, 그 녹음을 <strong>역재생</strong>으로 재생하면 원래의 한글 발음으로 들립니다!</li>
                    <li>예: "안녕하세요" → "오예상어인나" (변환) → 녹음 → 역재생 → "안녕하세요" (원래 발음)</li>
                    <li>이는 실제 발음의 시간축을 뒤집는 원리를 활용한 것입니다.</li>
                  </ul>
                </div>

                <div className="help-item">
                  <h4>1️⃣ 텍스트 변환</h4>
                  <ul>
                    <li>한글 텍스트를 입력 필드에 입력하세요.</li>
                    <li>"변환하기" 버튼을 클릭하거나 Enter 키를 누르세요.</li>
                    <li>변환된 역재생 발음이 출력 영역에 표시됩니다.</li>
                  </ul>
                </div>

                <div className="help-item">
                  <h4>2️⃣ 음성 녹음 및 역재생</h4>
                  <ul>
                    <li>"음성 녹음" 버튼을 클릭하여 녹음을 시작하세요.</li>
                    <li>마이크 접근 권한이 필요합니다.</li>
                    <li>원하는 음성을 녹음한 후 "녹음 중지" 버튼을 클릭하세요.</li>
                    <li>원본 녹음과 역재생된 오디오를 재생할 수 있습니다.</li>
                  </ul>
                </div>

                <div className="help-item">
                  <h4>💡 변환 예시</h4>
                  <ul>
                    <li><strong>"안녕하세요"</strong> → <strong>"오예상어인나"</strong></li>
                    <li><strong>"거꾸로"</strong> → <strong>"오룪억"</strong></li>
                    <li><strong>"안돼"</strong> → <strong>"애옫나"</strong></li>
                  </ul>
                </div>

                <div className="help-item">
                  <h4>⚙️ 적용되는 음운 규칙</h4>
                  <ul>
                    <li><strong>초성 'ㅇ' 무시</strong>: 소리 없는 초성 'ㅇ'은 분해 시 제외</li>
                    <li><strong>이중모음 분리</strong>: ㅑ→ㅣ+ㅏ, ㅕ→ㅣ+ㅓ, ㅛ→ㅣ+ㅗ 등</li>
                    <li><strong>유성음화</strong>: 받침 뒤의 ㅎ이 유성음으로 변환</li>
                    <li><strong>7종 종성 법칙</strong>: 모든 받침을 [ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ㅂ, ㅇ] 중 하나로 발음</li>
                    <li><strong>자음 동화</strong>: 비음화, 유음화 등 음운 변동 규칙 적용</li>
                  </ul>
                </div>

                <div className="help-item">
                  <h4>⚠️ 주의사항</h4>
                  <ul>
                    <li>이 도구는 실제 발음의 시간축을 뒤집는 것을 구현합니다.</li>
                    <li>단순히 문자를 뒤집는 것이 아닙니다.</li>
                    <li>브라우저가 마이크 접근을 지원해야 합니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="input-section" aria-label="텍스트 입력 섹션">
          <label htmlFor="text-input">한글 텍스트 입력</label>
          <input
            id="text-input"
            type="text"
            className="text-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="예: 안녕하세요"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleConvert();
              }
            }}
          />
        </section>

        <div className="button-group">
          <button className="btn btn-primary" onClick={handleConvert}>
            변환하기
          </button>
          <button
            className="btn btn-secondary"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            {isRecording ? '녹음 중지' : '음성 녹음'}
          </button>
        </div>

        {(isRecording || isProcessing) && (
          <div className={`recording-status ${isRecording ? 'recording' : 'processing'}`}>
            {isRecording ? '🔴 녹음 중...' : '⏳ 처리 중...'}
          </div>
        )}

        {/* 콘텐츠 사이 광고 영역 */}
        <AdSense 
          adSlot="" 
          className="ad-inline"
          style={{ margin: '30px 0' }}
        />

        <section className="output-section" aria-label="변환 결과 섹션">
          <label htmlFor="output-text">변환된 역재생 발음</label>
          <div id="output-text" className="output-text" role="region" aria-live="polite">
            {outputText || '(변환 결과가 여기에 표시됩니다)'}
          </div>
          {outputText && (
            <p className="output-hint">🎤 음성 녹음을 누르고 직접 발음해보세요!</p>
          )}
        </section>

        {(recordedAudio || reversedAudio) && (
          <div className="audio-controls">
            {recordedAudio && (
              <div>
                <p>원본 녹음</p>
                <audio 
                  controls 
                  preload="auto"
                  key={recordedAudio}
                >
                  <source src={recordedAudio} type={recordedMimeTypeRef.current || 'audio/webm'} />
                  브라우저가 오디오 재생을 지원하지 않습니다.
                </audio>
              </div>
            )}
            {reversedAudio && (
              <div>
                <p>역재생</p>
                <audio 
                  controls 
                  preload="auto"
                  key={reversedAudio}
                >
                  <source src={reversedAudio} type="audio/wav" />
                  브라우저가 오디오 재생을 지원하지 않습니다.
                </audio>
              </div>
            )}
          </div>
        )}

        {/* 오디오 컨트롤 아래 광고 영역 */}
        {(recordedAudio || reversedAudio) && (
          <AdSense 
            adSlot="" 
            className="ad-after-audio"
            style={{ margin: '30px 0' }}
          />
        )}
      </main>
      
      {/* 푸터 위 광고 영역 */}
      <AdSense 
        adSlot="" 
        className="ad-bottom"
        style={{ margin: '20px auto', maxWidth: '800px' }}
      />
      
      <footer className="footer">
        <p>© 2025 Cheolwoon Park. All rights reserved.</p>
        <p className="subtitle">한국어 역재생 발음 생성기</p>
      </footer>
    </div>
  );
}

export default App;

