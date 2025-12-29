import hangul from 'hangul-js';

// 초성 'ㅇ' 무시를 위한 초성 매핑
const INITIAL_CONSONANTS = {
  'ㄱ': 'ㄱ', 'ㄲ': 'ㄲ', 'ㄴ': 'ㄴ', 'ㄷ': 'ㄷ', 'ㄸ': 'ㄸ',
  'ㄹ': 'ㄹ', 'ㅁ': 'ㅁ', 'ㅂ': 'ㅂ', 'ㅃ': 'ㅃ', 'ㅅ': 'ㅅ',
  'ㅆ': 'ㅆ', 'ㅇ': null, 'ㅈ': 'ㅈ', 'ㅉ': 'ㅉ', 'ㅊ': 'ㅊ',
  'ㅋ': 'ㅋ', 'ㅌ': 'ㅌ', 'ㅍ': 'ㅍ', 'ㅎ': 'ㅎ'
};

// 이중모음 분리 규칙
const DIPHTHONG_MAP = {
  'ㅑ': ['ㅣ', 'ㅏ'],
  'ㅕ': ['ㅣ', 'ㅓ'],
  'ㅛ': ['ㅣ', 'ㅗ'],
  'ㅠ': ['ㅣ', 'ㅜ'],
  'ㅒ': ['ㅣ', 'ㅐ'],
  'ㅖ': ['ㅣ', 'ㅔ'],
  'ㅘ': ['ㅗ', 'ㅏ'],
  'ㅙ': ['ㅗ', 'ㅐ'],
  'ㅝ': ['ㅜ', 'ㅓ'],
  'ㅞ': ['ㅜ', 'ㅔ'],
  'ㅟ': ['ㅜ', 'ㅣ'],
  'ㅢ': ['ㅡ', 'ㅣ']
};

// 7종 종성 법칙: 모든 받침을 [ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ㅂ, ㅇ] 중 하나로 변환
const FINAL_CONSONANT_MAP = {
  'ㄱ': 'ㄱ', 'ㄲ': 'ㄱ', 'ㄳ': 'ㄱ', 'ㄺ': 'ㄱ', 'ㄻ': 'ㄹ', 'ㄼ': 'ㄹ',
  'ㄽ': 'ㄹ', 'ㄾ': 'ㄹ', 'ㄿ': 'ㄹ', 'ㅀ': 'ㄹ', 'ㅁ': 'ㅁ',
  'ㅂ': 'ㅂ', 'ㅄ': 'ㅂ', 'ㅅ': 'ㄷ', 'ㅆ': 'ㄷ', 'ㅇ': 'ㅇ',
  'ㅈ': 'ㄷ', 'ㅊ': 'ㄷ', 'ㅋ': 'ㄱ', 'ㅌ': 'ㄷ', 'ㅍ': 'ㅂ', 'ㅎ': 'ㄷ',
  'ㄴ': 'ㄴ', 'ㄷ': 'ㄷ', 'ㄹ': 'ㄹ'
};

// 유성음화: 받침 뒤의 ㅎ이 유성음으로 변환
const VOICING_MAP = {
  'ㅎ': 'ㅇ'  // ㅎ → ㅇ (유성음화)
};

// 자음 동화 규칙
function applyConsonantAssimilation(phonemes) {
  const result = [...phonemes];
  
  // 받침인지 확인하는 헬퍼 함수
  const isFinalConsonant = (idx) => {
    if (idx < 0 || idx >= result.length) return false;
    const char = result[idx];
    // 자음이고, 다음이 모음이 아니거나 끝이면 받침
    if (hangul.isConsonant(char)) {
      if (idx === result.length - 1) return true;
      if (idx + 1 < result.length && hangul.isVowel(result[idx + 1])) {
        return false;
      }
      return true;
    }
    return false;
  };
  
  for (let i = 0; i < result.length - 1; i++) {
    const current = result[i];
    const next = result[i + 1];
    
    // 비음화: ㄱ, ㄷ, ㅂ + ㄴ, ㅁ → ㅇ, ㄴ, ㅁ
    if ((current === 'ㄱ' || current === 'ㄷ' || current === 'ㅂ') && 
        (next === 'ㄴ' || next === 'ㅁ')) {
      if (current === 'ㄱ') result[i] = 'ㅇ';
      if (current === 'ㄷ') result[i] = 'ㄴ';
      if (current === 'ㅂ') result[i] = 'ㅁ';
    }
    
    // 유음화: ㄴ + ㄹ → ㄹ + ㄹ
    if (current === 'ㄴ' && next === 'ㄹ') {
      result[i] = 'ㄹ';
    }
    
    // 유성음화: 받침 뒤의 ㅎ → ㅇ
    if (isFinalConsonant(i) && next === 'ㅎ') {
      result[i + 1] = 'ㅇ';
    }
  }
  
  return result;
}

// 한글을 음소 배열로 분해
function decomposeToPhonemes(text) {
  const phonemes = [];
  
  for (let char of text) {
    if (!hangul.isComplete(char)) {
      // 완성형이 아닌 경우 그대로 추가
      if (hangul.isConsonant(char) || hangul.isVowel(char)) {
        phonemes.push(char);
      }
      continue;
    }
    
    const disassembled = hangul.disassemble(char);
    
    if (disassembled.length === 0) {
      continue;
    }
    
    // 초성 처리 (ㅇ 무시)
    const initial = disassembled[0];
    if (INITIAL_CONSONANTS[initial] !== null) {
      phonemes.push(initial);
    }
    
    // 중성 처리 (이중모음 분리)
    if (disassembled.length > 1) {
      const medial = disassembled[1];
      if (DIPHTHONG_MAP[medial]) {
        phonemes.push(...DIPHTHONG_MAP[medial]);
      } else {
        phonemes.push(medial);
      }
    }
    
    // 종성 처리 (7종 종성 법칙 적용)
    if (disassembled.length > 2) {
      const final = disassembled[2];
      const normalizedFinal = FINAL_CONSONANT_MAP[final] || final;
      phonemes.push(normalizedFinal);
    }
  }
  
  return phonemes;
}

// 음소 배열을 한글로 재조합
function recomposeFromPhonemes(phonemes) {
  if (phonemes.length === 0) return '';
  
  const result = [];
  let i = 0;
  
  while (i < phonemes.length) {
    const current = phonemes[i];
    
    // 자음인 경우
    if (hangul.isConsonant(current)) {
      // 다음이 모음인지 확인 (초성으로 사용)
      if (i + 1 < phonemes.length && hangul.isVowel(phonemes[i + 1])) {
        const initial = current;
        let medial = phonemes[i + 1];
        i += 2;
        
        // 다음이 모음이면 이중모음 처리
        if (i < phonemes.length && hangul.isVowel(phonemes[i])) {
          const secondMedial = phonemes[i];
          const diphthong = Object.keys(DIPHTHONG_MAP).find(
            key => DIPHTHONG_MAP[key][0] === medial && DIPHTHONG_MAP[key][1] === secondMedial
          );
          if (diphthong) {
            medial = diphthong;
            i++;
          }
        }
        
        // 종성이 있는지 확인
        if (i < phonemes.length && hangul.isConsonant(phonemes[i])) {
          const final = phonemes[i];
          try {
            const assembled = hangul.assemble([initial, medial, final]);
            result.push(assembled);
          } catch (e) {
            // 조합 실패 시 초성+중성만
            result.push(hangul.assemble([initial, medial]));
            result.push(final);
          }
          i++;
        } else {
          result.push(hangul.assemble([initial, medial]));
        }
      } else {
        // 단독 자음 - 이전 글자에 받침으로 추가 시도
        let addedAsFinal = false;
        if (result.length > 0) {
          const lastItem = result[result.length - 1];
          if (typeof lastItem === 'string' && hangul.isComplete(lastItem)) {
            const disassembled = hangul.disassemble(lastItem);
            if (disassembled.length === 2) {
              // 받침이 없는 경우 받침 추가 시도
              try {
                const assembled = hangul.assemble([...disassembled, current]);
                result[result.length - 1] = assembled;
                addedAsFinal = true;
              } catch (e) {
                // 조합 실패
              }
            }
          }
        }
        
        if (!addedAsFinal) {
          // 받침으로 추가하지 못한 경우 그대로 추가
          result.push(current);
        }
        i++;
      }
    } else if (hangul.isVowel(current)) {
      // 모음인 경우 (초성이 없으므로 ㅇ 추가)
      if (i + 1 < phonemes.length && hangul.isVowel(phonemes[i + 1])) {
        // 이중모음 처리
        const secondMedial = phonemes[i + 1];
        const diphthong = Object.keys(DIPHTHONG_MAP).find(
          key => DIPHTHONG_MAP[key][0] === current && DIPHTHONG_MAP[key][1] === secondMedial
        );
        if (diphthong) {
          result.push(hangul.assemble(['ㅇ', diphthong]));
          i += 2;
        } else {
          result.push(hangul.assemble(['ㅇ', current]));
          i++;
        }
      } else {
        result.push(hangul.assemble(['ㅇ', current]));
        i++;
      }
    } else {
      // 기타 문자 (공백, 특수문자 등)
      result.push(current);
      i++;
    }
  }
  
  return result.join('');
}

// 역재생 발음 변환 메인 함수
export function convertToBackward(text) {
  if (!text || text.trim() === '') {
    return '';
  }
  
  // 1. 텍스트 → 음소 단위 분해
  let phonemes = decomposeToPhonemes(text);
  
  // 2. 실제 발음 적용 (음운 변동)
  phonemes = applyConsonantAssimilation(phonemes);
  
  // 3. 음소 배열 완전 역전
  phonemes = phonemes.reverse();
  
  // 4. 역전된 음소를 한글 유사 발음으로 재조합
  const result = recomposeFromPhonemes(phonemes);
  
  return result;
}

