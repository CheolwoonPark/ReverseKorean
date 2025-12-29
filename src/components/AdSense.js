import React, { useEffect } from 'react';

// 구글 애드센스 컴포넌트
// 사용법: <AdSense adSlot="1234567890" adFormat="auto" />
const AdSense = ({ adSlot, adFormat = 'auto', style = {}, className = '' }) => {
  useEffect(() => {
    // 애드센스 스크립트가 로드되었는지 확인
    if (window.adsbygoogle && window.adsbygoogle.loaded) {
      return;
    }

    // 애드센스 스크립트 로드
    const script = document.createElement('script');
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX';
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);

    return () => {
      // 클린업은 필요시에만
    };
  }, []);

  useEffect(() => {
    // 광고 푸시
    try {
      if (window.adsbygoogle) {
        window.adsbygoogle.push({});
      }
    } catch (e) {
      console.error('AdSense error:', e);
    }
  }, []);

  if (!adSlot) {
    // 개발 모드에서는 플레이스홀더 표시
    return (
      <div 
        className={`adsense-placeholder ${className}`}
        style={{
          ...style,
          minHeight: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
          border: '1px dashed #ccc',
          borderRadius: '4px',
          color: '#666',
          fontSize: '0.9rem'
        }}
      >
        [구글 애드센스 광고 영역]
        <br />
        <small>adSlot: {adSlot || '설정 필요'}</small>
      </div>
    );
  }

  return (
    <div className={`adsense-container ${className}`} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', ...style }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdSense;

